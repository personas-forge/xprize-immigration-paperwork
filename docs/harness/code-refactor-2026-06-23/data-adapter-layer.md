# Code Refactor — Data Adapter Layer
> Total: 5 (C0/H2/M2/L1)

## 1. `defaultDeps()` dependency-injection boilerplate duplicated verbatim across two adapters
- **Severity**: High
- **Category**: duplication
- **File**: src/lib/data/adapters/petition.ts:64-88 and src/lib/data/adapters/evidence.ts:49-70
- **Scenario**: Both adapters carry an identical module-level lazy-DI scaffold: a `let cached: …Deps | null = null` singleton, an `async function defaultDeps()` that opens with `if (cached) return cached;`, a `Promise.all([... import("@/lib/db/store")])`, the same field-by-field assignment of `data.*` functions, the same `isConfiguredAttorney` wiring, and the byte-identical line `storeConfigured: async () => (await store.getStore()) !== null`. The `EvidenceAdapter` also repeats the whole `constructor(injected?)` + `private deps()` + `private gate()` shape that `PetitionAdapter` has. Confirmed by reading both files end-to-end; the two `storeConfigured` arrows are character-for-character equal.
- **Root cause**: The ADR-0010 "lazy dynamic import so the `server-only` data layer loads under `tsx --test`" pattern was copy-pasted when the second adapter was authored rather than factored into a shared helper.
- **Impact**: Two copies of the store-resolution contract drift independently. If the `storeConfigured` definition or the cache-reset semantics ever change (e.g. store-init flap handling), one adapter can silently diverge from the other — exactly the divergence the adapter seam exists to prevent. Every future adapter pays the same copy cost.
- **Fix sketch**: Extract a tiny `makeCached<T>(build: () => Promise<T>)` memoizer and a shared `storeConfigured = async () => (await getStore()) !== null` into a new `adapters/deps.ts` (or `access.ts`, which already owns `CaseGateDeps`). Each adapter's `defaultDeps` then only lists its own domain functions. Optionally lift `constructor/deps()` into a small `BaseAdapter`.

## 2. `EvidenceAdapter.restoreDocument` is built and tested but never wired
- **Severity**: High
- **Category**: dead-code
- **File**: src/lib/data/adapters/evidence.ts:153-167
- **Scenario**: `restoreDocument` (plus its `restoreCaseDocument` dep field at evidence.ts:41,62) is referenced ONLY by its own unit test (evidence.test.ts:124-145) and the store-layer implementations. Greps `\.restoreDocument\(` and `restoreCaseDocument` across `src/` (excluding `adapters/`) return no route, no server action, and no UI: `features/evidence/actions.ts` wires only `removeDocument`/`refileDocument`; `EvidenceVault.tsx` has no restore affordance (its only "restore" hit is an unrelated comment at line 108). The sibling soft-delete (`removeDocument`) WAS wired 2026-06-21 (evidence/actions.ts:40), but the recovery half was not — so this is genuinely unreferenced, not a now-wired method.
- **Root cause**: Soft-delete shipped with a recoverable design (`removeDocument` records `deletedBy`, doc comment promises "recoverable via restoreDocument"), but the user-facing restore/undo path was never built, leaving the adapter method stranded.
- **Impact**: Carries a full method + dep + interface field + green test that assert a capability the product cannot reach, overstating coverage of the soft-delete feature. A reader trusts the "recoverable" comment though no surface exposes it.
- **Fix sketch**: Either wire it (an undo action in `features/evidence/actions.ts` + a restore control in `EvidenceVault`, the obvious intended use), or, if recovery is out of scope, delete `restoreDocument`, the `restoreCaseDocument` dep field/wiring, and the test — and soften the "recoverable via {@link restoreDocument}" comment on `removeDocument`.

## 3. `PetitionAdapter.getLatestRfeResponse` is unwired; the one consumer calls the raw data fn instead
- **Severity**: Medium
- **Category**: dead-code
- **File**: src/lib/data/adapters/petition.ts:249-261
- **Scenario**: Grep `getLatestRfeResponse` shows the only production reader, `dashboard/cases/[id]/page.tsx:67`, imports and calls the RAW `getLatestRfeResponse` from `@/lib/data/petitions` (page.tsx:8), NOT `petitions.getLatestRfeResponse`. The adapter method is hit only by petition.test.ts. Its sibling `saveRfeResponse` IS wired (rfe/route.ts:152), and `getLatestDraft`/`getCriteria` ARE used as adapter methods — so the read-side RFE method is the lone unwired one, not the whole RFE feature.
- **Root cause**: The case-detail page already routes its access decision through `petitions.resolveCase` and is therefore inside the gate, so it fetches the RFE body with the un-gated raw fn in its `Promise.all`; the adapter's gated read wrapper was provided but never adopted there.
- **Impact**: Inconsistent seam usage (this read bypasses the `AdapterResult`/`store_error` contract its neighbors honor) and a dead wrapper. Lower than #2 because the data IS reached, just not through the adapter.
- **Fix sketch**: Switch page.tsx:67 to `petitions.getLatestRfeResponse(access, id)` (it has already resolved the gate, so this is a small change consistent with the other adapter reads) and handle the `AdapterResult`; OR, if the page deliberately stays raw for its batched `Promise.all`, delete the unused adapter method + dep field + test.

## 4. Per-method `try { … } catch (cause) { return err("store_error", cause); }` repeated ~12 times
- **Severity**: Medium
- **Category**: duplication
- **File**: src/lib/data/adapters/petition.ts (e.g. 115-119, 184-188, 217-221, 256-260) and src/lib/data/adapters/evidence.ts (e.g. 124-128, 141-148, 161-166, 179-184)
- **Scenario**: Almost every adapter method ends with the identical store-call-then-catch envelope: `const deps = await this.deps();` then `try { return ok(await deps.someCall(...)); } catch (cause) { return err("store_error", cause); }`. The body that differs is a single expression (the store call and its ok/not_found/unconfigured mapping); the surrounding try/catch is boilerplate repeated across both classes.
- **Root cause**: No shared "run a store call, normalize a throw to `store_error`" helper, so the catch arm is hand-written per method.
- **Impact**: ~12 copies of the same catch. If the error contract changes (e.g. distinguish a timeout, or add a trace id to the logged cause), every copy must be edited and any miss diverges. Verbose methods obscure the one line that actually varies.
- **Fix sketch**: Add a `wrapStore<T>(fn: () => Promise<T>): Promise<AdapterResult<T>>` (or `tryStore`) in `result.ts`/a base, collapsing each tail to `return wrapStore(() => deps.getCriteriaForCase(caseId));`. Methods needing not_found/unconfigured mapping pass a small post-processor or keep their explicit form.

## 5. `ErrorEnvelope` type and `adapterErrorBody`/`httpStatusForError` exported despite no external consumer
- **Severity**: Low
- **Category**: cleanup
- **File**: src/lib/data/adapters/http.ts:36-48
- **Scenario**: `httpStatusForError`, `adapterErrorBody`, and the `ErrorEnvelope` type are all `export`ed, but grep shows they're referenced only inside http.ts itself (consumed by `toErrorResponse`) and in http.test.ts. The code comment is candid: ErrorEnvelope is "Exported for testability … no client fetch wrapper consumes this type today." Only `toErrorResponse` has real external callers (draft/save, rfe/route, draftOperation).
- **Root cause**: The status/body mapping was split into separately-exported pure pieces to unit-test them without the framework — a reasonable testability seam, but the public export surface now advertises three helpers no production code outside this file uses.
- **Impact**: Cosmetic / API-surface bloat: the module looks like it offers a client-side envelope contract that nothing consumes, inviting confusion about whether a fetch wrapper exists. Genuinely test-only exports widen the maintenance surface.
- **Fix sketch**: Keep the functions exported (tests need them) but tighten intent — e.g. group them under a `// test-only export` banner already half-present, or collapse `adapterErrorBody`+`httpStatusForError` into `toErrorResponse` and assert via the `NextResponse` in the test. At minimum, leave the honest "no consumer today" note so the next reader doesn't wire a phantom contract. (Per grounding, this is NOT the adapter-vs-raw-layer distinction — it's an intra-module export-surface cleanup.)
