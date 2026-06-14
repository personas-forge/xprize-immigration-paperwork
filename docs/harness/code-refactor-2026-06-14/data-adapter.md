# Code Refactor Scan — Data Adapter Layer

> Total: 5 (C0 / H2 / M2 / L1)

## 1. EvidenceAdapter add/get + PetitionAdapter create/RFE methods are built but never wired — routes still call the raw data layer
- **Severity**: high
- **Category**: dead-code
- **File**: src/lib/data/adapters/evidence.ts:81 (addDocument), src/lib/data/adapters/evidence.ts:104 (getDocuments); src/lib/data/adapters/petition.ts:113 (createCase), petition.ts:187 (saveRfeResponse), petition.ts:211 (getLatestRfeResponse)
- **Scenario**: These five public adapter methods exist, are unit-tested, and gate through `resolveCase`, but no production caller invokes them. The routes/pages that perform the matching operations bypass the adapter and import the raw `@/lib/data/*` fns directly: `app/api/evidence/categorize/route.ts:21,133` calls `addCaseDocument`; `app/dashboard/cases/[id]/page.tsx:13,56` calls `getCaseDocuments`; `app/api/qualify/route.ts:11,73` calls `createCaseWithCriteria`; `app/api/rfe/route.ts:16,175` calls `saveRfeResponse`; `cases/[id]/page.tsx:10,55` calls `getLatestRfeResponse`.
- **Root cause**: ADR-0010 adoption is partial. Only `draft`/`draft/save` routes, `review/actions.ts` and `evidence/actions.ts` (remove/refile) were migrated; the categorize, qualify, rfe routes and the case-detail server component were never cut over.
- **Impact**: This is the security payoff of the whole layer going unrealized, not mere dead weight. `categorize/route.ts` and `cases/[id]/page.tsx` write/read evidence and read RFE/criteria for a case while re-applying (or relying on a route guard for) the owner-or-attorney check by hand instead of the single fail-closed `resolveCase` gate the adapter centralizes — the exact copy-paste ADR-0010 exists to kill. Carrying tested-but-unused gated methods is also misleading: a reviewer assumes the seam is enforced everywhere.
- **Verification**: Repo-wide grep for `.addDocument(`, `.getDocuments(`, `.createCase(`, `.saveRfeResponse(`, `.getLatestRfeResponse(` outside `src/lib/data/adapters/**` and `*.test.ts` returns zero hits; the raw-fn call sites above are confirmed by reading each route/page. NOT dead in the strict sense — this is "not yet adopted." Do not delete; the correct resolution is to finish adoption.
- **Fix sketch**: Migrate the four bypassing call sites to the adapter (`evidence.addDocument`, `evidence.getDocuments`, `petitions.createCase`, `petitions.saveRfeResponse`/`getLatestRfeResponse`) with `toErrorResponse` mapping in routes. If a deliberate decision is made NOT to adopt a given method, delete that method + its test rather than leaving enforced-looking-but-unused surface.

## 2. `cases/[id]/page.tsx` hand-rolls the owner-or-attorney gate the adapter exists to centralize
- **Severity**: high
- **Category**: duplication
- **File**: src/app/dashboard/cases/[id]/page.tsx:42-48
- **Scenario**: The case-detail server component recreates the precise decision tree of `resolveCase`: `const owned = await getCaseForUser(user.id, id); const stored = owned ?? (attorney ? await getCaseAnyOwner(id) : null); if (!stored) notFound();`. That is the `isConfiguredAttorney` owner-or-attorney fallback the adapter's `access.ts` was built to own exactly once.
- **Root cause**: The page predates ADR-0010 adoption and was not migrated; `PetitionAdapter.resolveCase` (petition.ts:91) is the intended single home for this logic.
- **Impact**: A fifth live copy of the gate the ADR's own header (access.ts:6-13) claims was consolidated to one. Any future change to the access rule (e.g. tightening the attorney fallback) must be remembered here too, and this is a cross-tenant PII read path — the highest-risk place to let the gate drift.
- **Verification**: Read of cases/[id]/page.tsx:36-57 confirms the inline gate and the subsequent unguarded `Promise.all` of `getCriteriaForCase`/`getLatestDraft`/`getCaseDocuments` after the manual check. `petitions.resolveCase` is invoked elsewhere (review/actions.ts:47,80) proving the seam is the established pattern. Behaviour is currently correct, so this is duplication risk, not an active bug.
- **Fix sketch**: Replace lines 42-48 with `const gate = await petitions.resolveCase({ userId: user.id, email: user.email ?? null }, id); if (!gate.ok) notFound();` then read the gated case from `gate.value`, deriving `isOwner` from a second `getCaseForUser` or an adapter-returned flag.

## 3. `getOwnedCases` adapter method is fully unused while two call sites use raw `getCasesForUser`
- **Severity**: medium
- **Category**: dead-code
- **File**: src/lib/data/adapters/petition.ts:99
- **Scenario**: `PetitionAdapter.getOwnedCases` wraps `getCasesForUser` with the `forbidden`/`unconfigured`/`store_error` contract, but nothing consumes it. The two places that list a user's cases — `app/dashboard/page.tsx:28` and `src/lib/data/saved-cases.ts:29` — both call raw `getCasesForUser` directly.
- **Root cause**: Speculative surface added with the adapter for symmetry; the list pages were never migrated.
- **Impact**: Lower-risk than #1/#2 (read of caller's own cases, no cross-tenant gate involved), but it is exported, tested dead surface that inflates the adapter's apparent footprint.
- **Verification**: Grep for `getOwnedCases` outside the adapter dir and tests returns no hits; `getCasesForUser` raw callers confirmed at dashboard/page.tsx:28 and saved-cases.ts:29. Not-yet-adopted, not strictly dead.
- **Fix sketch**: Either migrate dashboard/page.tsx + saved-cases.ts to `petitions.getOwnedCases`, or drop the method and its test if those callers intentionally stay on the raw fn (they need no gate, so keeping raw is defensible).

## 4. `isOk` type guard is exported and tested but has zero production callers
- **Severity**: medium
- **Category**: cleanup
- **File**: src/lib/data/adapters/result.ts:63
- **Scenario**: `isOk(result)` is defined and covered by result.test.ts, but every real consumer narrows the union via the `.ok` discriminant directly (`if (!gate.ok) return gate;`, `if (!result.ok) return;`, `if (!saved.ok) return toErrorResponse(...)`). The helper is never imported by non-test code.
- **Root cause**: Provided as an ergonomic alternative that the codebase's established `.ok`-discriminant style never picked up.
- **Impact**: Cosmetic-to-moderate: a redundant public export plus a test guarding code nothing uses. The `{ ok: true; value: T }` discriminated union already narrows perfectly on `.ok`, so the guard adds no capability.
- **Verification**: Grep for `isOk` across `src` shows only the definition (result.ts:63) and its own test (result.test.ts:9,26); all production sites use `.ok` directly (draft/route.ts:125, evidence/actions.ts:41, draft/save/route.ts:91, review/actions.ts:80).
- **Fix sketch**: Remove `isOk` and its two test assertions, or keep it only if a future fluent style is planned — but don't leave an unused public helper that suggests a convention the code doesn't follow.

## 5. `httpStatusForError` / `adapterErrorBody` / `ErrorEnvelope` are exported but consumed only internally by `toErrorResponse`
- **Severity**: low
- **Category**: cleanup
- **File**: src/lib/data/adapters/http.ts:36 (httpStatusForError), http.ts:42 (ErrorEnvelope), http.ts:45 (adapterErrorBody)
- **Scenario**: All three are `export`ed. Outside http.ts itself they appear only in http.test.ts. The single live consumer is `toErrorResponse` (http.ts:50), which composes the other two internally; routes import only `toErrorResponse`.
- **Root cause**: Exported individually so the pure status/body mapping is unit-testable without the framework (a reasonable seam) — but the JSDoc on `ErrorEnvelope` claims it exists "so client fetch wrappers can type a failed adapter response," and no client wrapper imports it.
- **Impact**: Low. Over-exported surface; mildly misleading doc comment. No correctness or security effect.
- **Verification**: Grep for the three names across `src` shows hits only in http.ts and http.test.ts; no client wrapper or route imports `ErrorEnvelope`/`adapterErrorBody`/`httpStatusForError`.
- **Fix sketch**: Keep the exports (they are legitimately tested) but correct the `ErrorEnvelope` comment to "exported for testability" until a client consumer actually exists, or downgrade `adapterErrorBody`/`httpStatusForError` to module-private if the test is reworked to assert through `toErrorResponse`. Note: `src/lib/result.ts` (`Result<T>`/ResultEnvelope, ADR-0011) was checked as a possible duplication of `AdapterResult<T>` — it is NOT a duplicate (AI-response envelope with DISCLAIMER vs. data ok/error union; both files document the distinction). No consolidation finding there.
