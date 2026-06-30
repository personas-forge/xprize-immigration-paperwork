# Code Refactor — Data Adapter Layer
> Total: 5
> Critical: 0 | High: 0 | Medium: 2 | Low: 3

_Context note: the 2026-06-23 refactor (PR #114) already closed 4 of its 5 prior findings here — `makeCached`/`storeConfigured` are now shared in `access.ts`; `restoreDocument` is wired (`features/evidence/actions.ts:49`, `EvidenceVault.tsx:178`); `getLatestRfeResponse` was deleted; `wrapStore` exists in `result.ts`. The layer is genuinely clean — these 5 are residual tail items, no Criticals/Highs. The `src/lib/result.ts` (Result envelope, ADR-0011) vs `adapters/result.ts` (AdapterResult, ADR-0010) pair was checked end-to-end and is **NOT** a duplicate: one carries `data + disclaimer + source` for AI responses, the other is an `ok/error` discriminated union — different concerns, explicitly cross-noted (`src/lib/result.ts:13-15`)._

## 1. `wrapStore` left two whole families of try/catch envelope un-absorbed (bool→not_found ×3, null→unconfigured ×2)
- **Severity**: Medium
- **Category**: duplication
- **File**: src/lib/data/adapters/evidence.ts:134-142, 154-159, 172-177 and src/lib/data/adapters/petition.ts:193-198, 223-233 (helper: result.ts:48-54)
- **Scenario**: `wrapStore<T>(fn)` (result.ts:48) was added 2026-06-23 to kill the per-method `try { ok(await fn()) } catch { store_error }` tail, and it IS used by the plain reads (`listOwnedCases`, `listReviewQueue`, `getCriteria`, `getLatestDraft`, `getDocuments`). But it only covers the `ok(value)` shape, so the two methods that map a *nullable version* and the three that map a *boolean* still hand-roll the identical envelope. The three boolean mutators are byte-identical but for the store call: `try { const b = await deps.removeCaseDocument/restoreCaseDocument/refileCaseDocument(...); return b ? ok(undefined) : err("not_found"); } catch (cause) { return err("store_error", cause); }`. The two writers are likewise identical: `try { const version = await deps.saveDraft/saveRfeResponse(...); return version === null ? err("unconfigured") : ok(version); } catch (cause) { return err("store_error", cause); }`.
- **Root cause**: `wrapStore` was scoped to the no-mapping case only; the boolean→not_found and null→unconfigured variants were never given their own wrapper, so 5 methods kept the explicit form.
- **Impact**: 5 copies of the same catch arm across two files. The error contract (e.g. adding a trace id to the logged cause, or distinguishing a timeout) must be edited in 5+ places and any miss diverges — the exact drift the adapter seam exists to prevent. The one line that actually varies (the store call) is buried in boilerplate.
- **Fix sketch**: Add two siblings to `wrapStore` in `result.ts`: `wrapFound(fn: () => Promise<boolean>)` → `b ? ok(undefined) : err("not_found")`, and `wrapVersion(fn: () => Promise<number | null>)` → `v === null ? err("unconfigured") : ok(v)`, both catching to `store_error`. Collapses `removeDocument`/`restoreDocument`/`refileDocument` and `saveDraft`/`saveRfeResponse` to one-liners. (`removeDocument` keeps its `access.userId` arg inside the passed lambda.)

## 2. "Configured store but write returned null" is classified two different ways across adapters
- **Severity**: Medium
- **Category**: consolidation
- **File**: src/lib/data/adapters/petition.ts:151,161-166 and src/lib/data/adapters/evidence.ts:107
- **Scenario**: Both `createCase` and `addDocument` face the same situation — a store was configured, yet the insert resolved to `null` (not a throw) — and resolve it divergently. `createCase` checks `storeConfigured()` up front (petition.ts:151) and on a null write returns `err("store_error", new Error("…returned null despite a configured store"))` → **500**. `addDocument` does NOT pre-check; on a null insert it **re-probes** `storeConfigured()` and returns `err("store_error")` if still up, else `err("unconfigured")` → **503** (evidence.ts:107). So an identical root cause (null write after a store flip mid-request) surfaces as a non-retryable 500 in one path and a retryable 503 in the other, and only one attaches a descriptive `cause`. Both methods carry long comments justifying their own choice in isolation.
- **Root cause**: The two null-write decisions were authored independently; `createCase` predates the re-probe idiom that `addDocument` later adopted, and neither was reconciled to a single rule.
- **Impact**: Same failure, two user-facing outcomes (alarming non-retryable 500 vs reassuring retryable 503) and two ops signals (cause vs no cause). A reader can't tell which is canonical, and a third write method will copy whichever it happens to sit next to.
- **Fix sketch**: Pick one policy for "configured store, null write" and share it — e.g. a `wrapInsert(fn, storeConfigured)` helper that re-probes once and returns `unconfigured` on a vanished store, `store_error` (with a uniform cause) otherwise. Apply to both `createCase` and `addDocument` so the 500-vs-503 decision lives in one place.

## 3. Identical `constructor(injected?)` + `private deps()` duplicated across both adapter classes
- **Severity**: Low
- **Category**: duplication
- **File**: src/lib/data/adapters/petition.ts:83-87 and src/lib/data/adapters/evidence.ts:70-74
- **Scenario**: Both adapter classes open with the byte-identical (modulo the `…Deps` type param) injection scaffold: `constructor(private readonly injected?: XDeps) {}` and `private deps(): Promise<XDeps> { return this.injected ? Promise.resolve(this.injected) : defaultDeps(); }`. The 2026-06-23 report (#1) extracted `makeCached`/`storeConfigured` but explicitly left "Optionally lift `constructor`/`deps()` into a small `BaseAdapter`" undone.
- **Root cause**: The class shell was copy-pasted when the second adapter was authored; only the free-function helpers were later hoisted, not the class members.
- **Impact**: Low — two small copies. But every future adapter pays the same copy, and a change to the inject/cache contract (e.g. eager validation of injected deps) must be made in each class.
- **Fix sketch**: Introduce `abstract class BaseAdapter<D> { constructor(protected readonly injected?: D) {} protected deps(): Promise<D> { return this.injected ? Promise.resolve(this.injected) : this.loadDefault(); } protected abstract loadDefault(): Promise<D>; }` and have both adapters extend it. Marginal; fine to leave if a base class feels heavier than the duplication.

## 4. Two different shapes for "gate then act" — PetitionAdapter resolves deps twice per method
- **Severity**: Low
- **Category**: structure
- **File**: src/lib/data/adapters/petition.ts:90-95,177-179,206-208 and src/lib/data/adapters/evidence.ts:76-82,96-99,119-121
- **Scenario**: The two adapters express the same "resolve the gate, then load deps and act" preamble differently. `PetitionAdapter` exposes a public `resolveCase(access, caseId)` that internally does `resolveCase(await this.deps(), …)`; its gated methods then call `this.resolveCase(...)` AND, separately, `await this.deps()` again — so `this.deps()` is awaited twice per method (e.g. `getCriteria` 177-179, `getLatestDraft` 206-208). `EvidenceAdapter` instead loads deps once and threads them into a `private gate(deps, access, caseId)` (evidence.ts:76-82), so deps resolve exactly once. Because `deps()` is memoized (`makeCached`) / an injected ref, the double-await is cheap (no double dynamic import) — this is a consistency/redundancy smell, not a perf bug.
- **Root cause**: `PetitionAdapter` needed a *public* `resolveCase` for `parse-gate.ts`/review actions and reused it internally; `EvidenceAdapter` only needed it privately and chose the deps-threading shape. The two were never reconciled.
- **Impact**: Low — a reader comparing the two adapters sees two idioms for the same step and an avoidable second `this.deps()`. New methods copy whichever class they live in.
- **Fix sketch**: Standardize on one. Simplest: give `PetitionAdapter` an internal `gate(deps, access, caseId)` like Evidence's, load deps once at the top of each method, and keep the public `resolveCase` as a thin wrapper that loads deps then delegates to `gate`.

## 5. `ErrorEnvelope` / `adapterErrorBody` / `httpStatusForError` remain exported for tests only (known, kept-by-design)
- **Severity**: Low
- **Category**: cleanup
- **File**: src/lib/data/adapters/http.ts:35-49
- **Scenario**: Re-confirming the prior reports (2026-06-14 #5, 2026-06-23 #5): `httpStatusForError`, `adapterErrorBody`, and the `ErrorEnvelope` type are still `export`ed, but a full-repo grep shows the only consumers outside `http.ts` are `http.test.ts`. The single production export is `toErrorResponse` (used by `draft/save/route.ts:86`, `rfe/route.ts:66`, `draftOperation.ts:121`, `parse-gate.ts:69`), which composes the other two internally. The comment is already candid ("test-only exports … no client fetch wrapper consumes this type today").
- **Root cause**: The pure status/body mapping was split into separately-exported pieces so they're unit-testable without the framework — a reasonable seam that was deliberately kept after two prior reviews.
- **Impact**: Cosmetic API-surface bloat only; the honest comment already prevents a reader from wiring a phantom client contract. Listed for completeness, not action — flagging it again is low value since it was reviewed and kept twice.
- **Fix sketch**: Leave as-is (the test seam is legitimate and documented). If a future cleanup wants zero test-only exports, collapse `adapterErrorBody`+`httpStatusForError` into `toErrorResponse` and assert via the returned `NextResponse` in `http.test.ts`.
