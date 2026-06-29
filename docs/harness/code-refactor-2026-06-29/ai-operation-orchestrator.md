# Code Refactor — AI Operation Orchestrator
> Total: 5
> Critical: 0 | High: 0 | Medium: 3 | Low: 2

> Scope note / headline: the high-value question — "do any token-charged routes
> bypass `executeAiOperation` and hand-roll parse/charge/guard?" — resolves CLEAN.
> The orchestrator now backs **8** declarative specs, not 5: `/api/qualify`,
> `/api/draft` (draftSpec), `/api/rfe`, `/api/guidance`, `/api/evidence/categorize`,
> plus `/api/rfe/forecast` (forecastSpec), `/api/draft/critique` (critiqueSpec) and
> `/api/qualify/best-path`. Every one is a one-liner `return executeAiOperation(request, spec)`
> (verified at draft/route.ts:23, rfe/forecast/route.ts:14, draft/critique/route.ts:16,
> etc.). None re-implements the charge / reclaim / DISCLAIMER / rate-limit pipeline.
> `operation.ts` itself has no dead exports, no debug `console.log`, no commented-out
> code (the `console.error` calls are intentional reclaim/guard/persist failure logs).
> The 2026-06-23 pass did its job. The 5 findings below are residual cross-spec
> duplication + one stale docstring, ordered by impact ÷ effort.

## 1. Repeated `source as Parameters<typeof buildX>[1]) as unknown as Record<string, unknown>` double-cast in every spec's `build`
- **Severity**: Medium
- **Category**: consolidation
- **File**: src/lib/ai/operation.ts:132 (the `build` signature) — instances at src/app/api/qualify/route.ts:67, src/app/api/rfe/route.ts:101, src/app/api/evidence/categorize/route.ts:98, src/features/drafting/draftOperation.ts:197 & 201, src/features/rfe/forecastOperation.ts:118, src/features/drafting/critiqueOperation.ts:106 (7 occurrences / 6 specs; guidance/route.ts:69-73 and qualify/best-path carry the `source as Parameters<…>` half too).
- **Scenario**: Every route's `build` hook casts twice to satisfy the orchestrator's loose types: `source as Parameters<typeof buildXResult>[1]` and then `... as unknown as Record<string, unknown>`. The `as unknown as` form is the strongest "I am erasing the type system" cast there is, and it sits on the response body of all 8 paid routes.
- **Root cause**: `AiOperationSpec.build` declares `source: string` and returns `Record<string, unknown>` (operation.ts:132). But the orchestrator only ever sets `source` to `"mock"` or `llm.name` (operation.ts:357/413) — structurally a `ModelSource` (`"mock" | engine-name`) union, which is exactly what every `buildXResult(value, source)` wants. The width mismatch forces the first cast at all 8 sites; the second cast bridges the typed domain result to the untyped body.
- **Impact**: A real type regression in any `buildXResult` (wrong field name, dropped DISCLAIMER) is silently swallowed by `as unknown as` at the boundary — the cast that exists to consolidate the pipeline is also defeating its type checks. 8 copies of identical cast noise.
- **Fix sketch**: Export a `ModelSource = "mock" | (string & {})` (or import the feature union) from operation.ts and type `build`'s `source` (and `persist`/`adjudicate`'s `source`) as it — this deletes the `source as Parameters<…>[1]` half at all 8 sites with zero behaviour change. Optionally make `build` generic over its return (`build: (…) => TBody`) so the `as unknown as Record` half can drop too; that is the larger half and can be deferred.

## 2. The `adjudicate` hook re-threads `source` + `result: body` into `runAdjudication({…})` in 4 specs
- **Severity**: Medium
- **Category**: duplication
- **File**: src/lib/ai/operation.ts:138-143 (the `adjudicate` signature) — call sites at src/app/api/qualify/route.ts:70-81, src/app/api/rfe/route.ts:108-119, src/app/api/guidance/route.ts:79-87, src/features/drafting/draftOperation.ts:205-228.
- **Scenario**: Four specs implement `adjudicate` and each builds the same `runAdjudication({ operation, classification, source, result: body, ... inputText, outputText })` envelope. The orchestrator (operation.ts:463) already passes `source` and `body` *into* the hook purely so the hook can pass them *back* into `runAdjudication`. Only `operation`, `classification`, `inputText`/`outputText` (and draft's `unresolvedCitations`) genuinely vary.
- **Root cause**: The hook contract is "score it and return a report" but the report construction (the `runAdjudication` call + the constant `source`/`result: body` plumbing) was left in each route instead of in the orchestrator, so 4 routes import and couple to `runAdjudication` directly.
- **Impact**: 4× repeated `source, result: body` plumbing; 4 routes coupled to the adjudication engine's call signature, so a change to that envelope (e.g. a new required field) is a 4-file edit. Moderate, but it is the one piece of "pipeline shape" still living in the routes.
- **Fix sketch**: Narrow the hook to return the varying parts only — `adjudicate?: (output, input) => { operation; classification; inputText; outputText; unresolvedCitations? } | null` — and have the orchestrator call `runAdjudication({ ...fields, source, result: responseBody })` itself (it already holds both). Removes the 4 `import { runAdjudication }` lines from the routes and centralizes the call. (Note: categorize/forecast/critique correctly have NO `adjudicate` — that asymmetry is by design, not a finding.)

## 3. rfe-route `parse` and draftOperation `parse` duplicate the DB-path case-context skeleton
- **Severity**: Medium
- **Category**: duplication
- **File**: src/app/api/rfe/route.ts:53-85 vs src/features/drafting/draftOperation.ts:98-155 (forecastOperation.ts has a third, lighter variant of the same skeleton).
- **Scenario**: Both `parse` hooks run the identical case-resolution sequence before charge: `parseCaseId(record)` → `resolveCaseForParse(resolveUser, caseId, …)` → bail on `!r.ok` → `petitions.getCriteria(access, caseId)` → bail on `!criteria.ok` via `toErrorResponse` → `parseXRequest({ petitioner: r.case.petitioner, classification: r.case.classification, criteria: criteria.value, … })` → `evidence.getDocuments(access, caseId)` → `attach…(parsed.value, docs.value)` → optionally `petitions.getLatestDraft(access, caseId)`. ~25 lines of orchestration repeated, differing only in the parse/attach function names and draft's extra 409 merge-base gate.
- **Root cause**: The "resolve an owned/attorney case, load its criteria + exhibits + latest draft, fail-closed before charge" workflow is a reusable unit, but each spec re-expresses it inline because the only shared helpers extracted so far are the leaf calls (`resolveCaseForParse`, `parseCaseId`), not the sequence.
- **Impact**: A change to the pre-charge gate ordering (e.g. load exhibits before criteria, or add a new best-effort fuse) must be made and kept in lockstep across rfe + draft + forecast. This is exactly the class of drift the orchestrator was built to prevent, just one layer down in `parse`.
- **Fix sketch**: Extract `loadCaseContext(resolveUser, caseId, { unauthenticatedError, ownerOnly? })` into `lib/data/adapters/parse-gate.ts` returning `{ access, petitioner, classification, criteria, exhibits, latestDraft }` (or the error response). rfe/draft/forecast `parse` then call it and only own their `parseXRequest` + attach + (draft's) 409 gate. Larger than #1/#2 but removes the highest-LOC duplication in the cluster.

## 4. rfe + draft `persist`/`onPersistError` repeat the `{ caseId, version, saveFailed }` result envelope
- **Severity**: Low
- **Category**: duplication
- **File**: src/app/api/rfe/route.ts:122-140 vs src/features/drafting/draftOperation.ts:233-278.
- **Scenario**: Both persist hooks return the same three-field shape on every branch — success `{ caseId, version: saved.value, saveFailed: false }`, failure `{ caseId, version: null, saveFailed: true }` (with a `console.error`) — and both end with the byte-identical `onPersistError: (input) => ({ caseId: input.caseId, version: null, saveFailed: true })` (rfe:140, draftOperation:278). The grep shows this `version: null, saveFailed: true` envelope 6× in draftOperation alone.
- **Root cause**: The "version-save result → response fields" mapping is a small shared concern with no helper, so each save branch hand-writes the object literal.
- **Impact**: Low — small literals — but the `onPersistError` lines are an exact duplicate, and the success/failure shapes must stay in sync with the draft/save recovery route that reads `saveFailed`.
- **Fix sketch**: A `versionSaveResult(caseId, saved)` helper returning the success/failure shape, plus a shared `versionSaveOnPersistError` constant, used by both specs. Trivial, removes the exact-dup `onPersistError`.

## 5. Stale present-tense docstring in operation.ts claims the routes "all hand-implement the SAME pipeline" and undercounts to "five"
- **Severity**: Low
- **Category**: cleanup
- **File**: src/lib/ai/operation.ts:22-31 (also the "five AI endpoints" lists at operation.ts:24 and the class doc at operation.ts:36).
- **Scenario**: The module header reads, in present tense, "The five AI endpoints (`draft`, `rfe`, `qualify`, `guidance`, `evidence/categorize`) all hand-implement the SAME pipeline … (~500 lines duplicated)." Post-migration this is the opposite of true — those routes now delegate to THIS module and hand-implement nothing — and the count is stale: the orchestrator backs **8** specs (the three missing ones: `rfe/forecast`, `draft/critique`, `qualify/best-path`).
- **Root cause**: The docstring was written to describe the pre-refactor motivation and never re-tensed after the migration completed; the two later additions (forecast/critique/best-path) never updated the hard-coded "five".
- **Impact**: A reader auditing the pipeline trusts "five endpoints" and "all hand-implement" — both now misleading — and may miss forecast/critique/best-path when reasoning about cross-cutting invariants. Documentation-as-lie, the cheapest to fix.
- **Fix sketch**: Reword to past tense ("previously each AI endpoint hand-implemented this pipeline … ~500 lines duplicated; this module owns it once") and drop the hard count or say "the AI endpoints (currently 8: qualify, draft, rfe, guidance, evidence/categorize, rfe/forecast, draft/critique, qualify/best-path)". No code change.
