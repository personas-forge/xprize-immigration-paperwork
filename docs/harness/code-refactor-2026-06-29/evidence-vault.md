# Code Refactor — Evidence Vault & Categorization
> Total: 5
> Critical: 0 | High: 0 | Medium: 3 | Low: 2

Context cleaned 2026-06-23; every finding below re-verified against current file
contents. The known FP `parseCategorizeResponse` (live via `scripts/llm-eval/run.ts`)
is deliberately NOT flagged. No console.logs, commented-out code, or stale TODOs
were found in the eight context files — they are clean on that axis.

## 1. JSON-object body guard duplicated verbatim across all 5 AI validators
- **Severity**: Medium
- **Category**: duplication
- **File**: src/features/evidence/evidence.ts:61-64
- **Scenario**: `parseCategorizeRequest` opens with the exact four lines —
  `if (typeof body !== "object" || body === null) { return { ok: false, error: "Request body must be a JSON object." }; } const record = body as Record<string, unknown>;`
- **Root cause**: The same guard + identical error string + identical narrowing
  cast is hand-copied into every per-route validator: `rfe.ts:93-96`,
  `qualification.ts:89-92`, `guidance.ts:61-64`, `drafting.ts:113-116`, and here.
  Five copies, one shape. There is no shared `asObjectBody(body)` primitive even
  though the orchestrator (`operation.ts`) already centralizes the rest of the
  pipeline these validators feed.
- **Impact**: Five places to keep in sync. If the error copy or the null/object
  semantics ever change (e.g. rejecting arrays, which `typeof [] === "object"`
  currently lets through), one site silently drifts. Pure boilerplate noise at the
  top of every validator.
- **Fix sketch**: Add `asObjectBody(body): Record<string,unknown> | null` (or a
  `{ok}`-returning variant) to a shared body-parse util (next to
  `parse-gate.ts`/`result.ts`); each validator becomes
  `const record = asObjectBody(body); if (!record) return {ok:false,error:…}`.
  Evidence-scoped change: replace lines 61-64.

## 2. Evidence route resolves the same case twice per categorize request
- **Severity**: Medium
- **Category**: consolidation
- **File**: src/app/api/evidence/categorize/route.ts:77-80
- **Scenario**: For a request that carries a `caseId` and a signed-in user, the
  parse stage calls `petitions.resolveCase(access, caseId)` (line 77, to read the
  server-authoritative classification) and then `evidence.getDocuments(access, caseId)`
  (line 79). `getDocuments` re-runs the owner/attorney gate internally —
  `EvidenceAdapter.getDocuments` → `this.gate` → `resolveCase`
  (src/lib/data/adapters/evidence.ts:119-121).
- **Root cause**: Two gated round-trips resolve the identical case. The case object
  fetched at line 77 is discarded after pulling `.classification`; `getDocuments`
  then fetches/gates the case again to list documents. There is no adapter method
  that returns case + documents (or accepts an already-resolved case).
- **Impact**: Every categorize-into-a-case request pays a redundant
  `storeConfigured` + `getCaseForUser`/`getCaseAnyOwner` resolution (extra
  Firestore/PGlite reads on the hot path) and a second cross-tenant gate evaluation
  of the same access decision — duplicated work that can also drift if one gate
  changes.
- **Fix sketch**: Add an `evidence` adapter method like
  `getCaseAndDocuments(access, caseId)` that resolves once and returns
  `{ case, documents }`, or have `getDocuments` accept the already-resolved
  `StoredCase`. The route then reads `classification` and `existingBuckets` from a
  single gated call.

## 3. Inlined string-field coercion instead of the existing shared `str()` helper
- **Severity**: Medium
- **Category**: duplication
- **File**: src/features/evidence/evidence.ts:65-71
- **Scenario**: `parseCategorizeRequest` hand-rolls "string field → trim → slice to
  max" twice — `name` (lines 65-68: `typeof record.name === "string" && … ? record.name.trim().slice(0, MAX_NAME) : ""`) and `content` (line 71). The
  categorize route re-inlines the same idea a third time for classification:
  `typeof record.classification === "string" ? record.classification : "O-1A"`
  (route.ts:63-64).
- **Root cause**: A `str(value, max)` helper that is exactly this logic already
  exists at `src/features/drafting/criteria-text.ts:18-20` and is reused by both
  `drafting.ts` and `rfe.ts` (e.g. `str(record.rfeText, MAX_RFE)`,
  `str(record.petitioner, MAX_PETITIONER)`). The evidence validator/route never
  adopted it, so the same coercion is reimplemented inline.
- **Impact**: Same trim/slice semantics expressed three different ways in one
  context; a future change (e.g. NFC-normalizing input) has to find every inline
  copy. The `name` branch is also more verbose than the helper for no behavioral
  gain (`str` returns `""` for non-strings, which is exactly the `name === ""`
  rejection path here).
- **Fix sketch**: Import `str` from `@/features/drafting/criteria-text` (or hoist it
  to a shared text util since it now serves 3 features) and use
  `str(record.name, MAX_NAME)` / `str(record.content, MAX_CONTENT)`; in the route,
  `str(record.classification, 40) || "O-1A"` (mirrors drafting.ts:119).

## 4. `CaseAccess` literal `{ userId, email: user.email ?? null }` rebuilt 5× in this context
- **Severity**: Low
- **Category**: consolidation
- **File**: src/app/api/evidence/categorize/route.ts:73
- **Scenario**: The identical access-context literal is constructed at route.ts:73,
  route.ts:108 (the `addDocument` call), and actions.ts:40, 55, 68 — five sites in
  the evidence context alone, all spelling out `{ userId: user.id, email: user.email ?? null }`.
- **Root cause**: `access.ts` defines the `CaseAccess` type but ships no
  constructor from an `AuthUser`/`AppUser`, so every caller re-derives the
  `email ?? null` normalization by hand.
- **Impact**: Low individually, but this literal drives a security-relevant
  decision (the `email` leg is the configured-attorney cross-tenant leg). Five
  copies is five chances for one to drop the `?? null` or pass the wrong field;
  centralizing makes the access-context shape single-sourced.
- **Fix sketch**: Add `caseAccessFor(user: {id:string; email?:string|null}): CaseAccess`
  to `access.ts` and call it at each site (route parse, route persist, and the
  three server actions).

## 5. Redundant barrel re-exports of `DISCLAIMER` / `O1A_CRITERIA` (and unused `Bucket`/`CategorizeResult` types)
- **Severity**: Low
- **Category**: dead-code
- **File**: src/features/evidence/evidence.ts:26
- **Scenario**: `evidence.ts:26` re-exports `{ DISCLAIMER, O1A_CRITERIA, criteriaNames }`
  and `index.ts` re-exports them again plus `type Bucket` (index.ts:16) and
  `type CategorizeResult` (index.ts:19). Grep shows no external module imports
  `DISCLAIMER` or `O1A_CRITERIA` *from* `@/features/evidence`: the component pulls
  `DISCLAIMER` from `@/lib/result` directly, and the only consumer of evidence's
  re-exports is `evidence.test.ts` (which could import them from their true sources
  `@/lib/result` / `@/features/qualification`). `type Bucket` and
  `type CategorizeResult` have no importer anywhere (Bucket is used only internally
  as a `string` alias; the rate-limit `Bucket` is an unrelated local interface).
- **Root cause**: Convenience re-exports that outlived their consumers; the
  multi-product refactor moved the canonical `DISCLAIMER`/`O1A_CRITERIA` sources
  elsewhere but left the pass-through exports behind.
- **Impact**: Minor — a misleading public surface that suggests these are the
  module's own symbols and invites new code to import the criteria/disclaimer from
  the wrong place. Pure surface-area cruft, no correctness risk.
- **Fix sketch**: Drop `DISCLAIMER`/`O1A_CRITERIA` from the evidence.ts:26 and
  index.ts re-export lists (keep `criteriaNames`, which the component genuinely
  uses via the barrel) and remove the unused `type Bucket` / `type CategorizeResult`
  barrel exports; point the test at the canonical sources. Verify with a grep gate
  before deleting.
