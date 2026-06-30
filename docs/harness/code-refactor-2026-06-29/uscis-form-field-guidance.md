# Code Refactor — USCIS Form-Field Guidance
> Total: 5
> Critical: 0 | High: 0 | Medium: 1 | Low: 4

_Note: the prompt listed `src/features/guidance/components/CitationNote.tsx` and `DisclaimerStamp.tsx` — these do NOT exist there. The guidance feature owns only `guidance.ts`, `guidance.test.ts`, `index.ts`, `components/FieldGuidancePanel.tsx` (+ `FieldGuidancePanel.test.ts`). `CitationNote`/`DisclaimerStamp`/`AdjudicationBadge` are shared primitives in `src/components/legal/` (correctly placed — they belong to the whole app, not guidance). The module is genuinely clean after the 2026-06-23 pass; the findings below are modest._

## 1. Untrusted-body validation guard duplicated across all 5 AI parsers
- **Severity**: Medium
- **Category**: consolidation
- **File**: src/features/guidance/guidance.ts:61-63 (twins: src/features/rfe/rfe.ts:94, src/features/evidence/evidence.ts:62, src/features/qualification/qualification.ts:90, src/features/drafting/drafting.ts:114)
- **Scenario**: `parseGuidanceRequest` opens with the verbatim block `if (typeof body !== "object" || body === null) { return { ok: false, error: "Request body must be a JSON object." }; }` followed by `const record = body as Record<string, unknown>` and a series of `typeof x !== "string" || x.trim() === ""` per-field checks. The exact same object-guard string and the same per-field string/blank pattern are hand-rolled in four sibling parsers — grep confirms the identical error string in 5 files.
- **Root cause**: The AI orchestrator (`lib/ai/operation.ts`) was consolidated, but each route's `parse*Request` body validation was left untouched, so the "is this a JSON object?" + "is this field a non-blank string within N chars?" boilerplate replicated per feature.
- **Impact**: Five copies of the same envelope check drift independently (one already varies its wording: evidence/qualification say "That's too long — please trim…", guidance says "Input is too long."). A change to the contract (e.g. returning a field name) must be made in 5 places.
- **Fix sketch**: Add a tiny shared helper in `lib/result` or a new `lib/validation.ts` — `asObjectRecord(body): Record<string,unknown> | null` and `requireString(record, key, { max }): { ok; value } | { ok:false; error }`. Each parser keeps its domain rules but drops the duplicated object-guard and per-field string plumbing. Scoped impact on guidance: ~10 lines shrink to ~4.

## 2. `T & { adjudication?: AdjudicationReport }` augmentation re-declared in 4 panels
- **Severity**: Low
- **Category**: consolidation
- **File**: src/features/guidance/components/FieldGuidancePanel.tsx:17 (twins: src/features/rfe/components/RfeStudio.tsx:45, src/features/qualification/components/QualifyPanel.tsx:32, src/features/drafting/components/DraftStudio.tsx:65,77)
- **Scenario**: The panel locally re-types the response to attach the orchestrator's best-effort report: `type GuidanceResult = GuidanceResponse & { adjudication?: AdjudicationReport };`. The identical `& { adjudication?: AdjudicationReport }` intersection is repeated in four other panels (5 occurrences total), each with the same explanatory comment about the orchestrator attaching `{ adjudication }`.
- **Root cause**: `adjudicate` was wired into the shared orchestrator, but the type augmentation was copied into each consumer rather than exported once next to `AdjudicationReport`.
- **Impact**: Low, but it is genuine type duplication: every panel re-explains and re-declares the same envelope extension; a rename of the field touches 5 sites.
- **Fix sketch**: Export `type WithAdjudication<T> = T & { adjudication?: AdjudicationReport }` from `@/lib/llm/adjudication-gates` (where `AdjudicationReport` lives) and have panels write `WithAdjudication<GuidanceResponse>`.

## 3. Dead `blocked: true` field on the guidance route's blocked-output body
- **Severity**: Low
- **Category**: dead-code
- **File**: src/app/api/guidance/route.ts:94-97
- **Scenario**: `onBlocked` returns `{ ...buildGuidanceResponse(mockGuidance(req), "mock"), blocked: true }`. On the blocked path the orchestrator still attaches the `adjudication` report (computed at step 8 before the engine source was overwritten), and the panel renders the block solely from `result.adjudication` via `AdjudicationBadge`. The panel's `GuidanceResult` type does not include `blocked`, and nothing reads `result.blocked` — grep for `.blocked`/`blocked:` across `src` finds only this assignment, the orchestrator's generic `operation.test.ts` fake, and an unrelated `blocked` key in `AdjudicationBadge`'s tone map.
- **Root cause**: `blocked: true` was added as a signal but the panel was wired to read the richer `adjudication` report instead, leaving the boolean redundant with `adjudication.attorneyReady === false`.
- **Impact**: Minimal — an unconsumed boolean on the wire. Mildly misleading: a reader assumes some consumer branches on `blocked`.
- **Fix sketch**: Drop `blocked: true` (the badge already conveys the block via `adjudication`), or, if a machine-readable flag is wanted, document it as the public contract and consume it. Don't leave it half-wired.

## 4. "back-compat" comment mislabels a live `DISCLAIMER` re-export
- **Severity**: Low
- **Category**: cleanup
- **File**: src/features/guidance/guidance.ts:30-32
- **Scenario**: The comment reads "`DISCLAIMER` re-exported for back-compat." But this is not a legacy shim — it is a live dependency: `FieldGuidancePanel.tsx:9` imports `DISCLAIMER` from `"../guidance"`, and `lib/result.test.ts:5` imports it as `GUIDANCE_DISCLAIMER` to assert the re-export still equals the canonical const (a drift guard).
- **Root cause**: After `DISCLAIMER` was relocated to `@/lib/result` (ADR-0011), the surviving re-export was annotated as "back-compat" rather than "the feature's public re-export," which it actually is.
- **Impact**: A future cleanup pass may read "back-compat" and delete the re-export, breaking the panel import and the drift test. The comment understates the export's role.
- **Fix sketch**: Reword to state it is the guidance feature's public re-export consumed by the panel + result.test drift guard (not legacy). Optionally point the panel directly at `@/lib/result` and keep the re-export only for the test — but the comment fix alone removes the trap.

## 5. Stale pre-orchestrator migration narration in the route header
- **Severity**: Low
- **Category**: cleanup
- **File**: src/app/api/guidance/route.ts:29-34
- **Scenario**: The header block narrates the migration that already happened: "This is a behaviour-preserving refactor with ONE consistency fix… The pre-orchestrator route returned the templated fallback stamped with the engine name and kept the charge (billing a mock as a model answer)." This describes how the route behaved *before* the ADR-0004 orchestrator move.
- **Root cause**: Migration commentary useful in the diff/PR was committed into the source and not pruned once the migration settled.
- **Impact**: Low — archival prose about a no-longer-existent code path inflates the header and forces a reader to mentally discard "what it used to do." The genuinely useful invariant (mock is labelled `source:"mock"` and not billed) is already stated and enforced by the orchestrator.
- **Fix sketch**: Trim lines 29-34 to a one-line statement of the current contract ("empty/blank model text → reclaim charge + templated fallback labelled `source:"mock"`"); drop the "pre-orchestrator route did X" narration.
