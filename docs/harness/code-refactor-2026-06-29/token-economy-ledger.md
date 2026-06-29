# Code Refactor — Token Economy & Ledger
> Total: 5
> Critical: 0 | High: 1 | Medium: 2 | Low: 2

Context is in good shape after the 2026-06-23 pass: `economy.ts` (purchase side) and
`registry.ts` (per-op tier/cost/rate-limit) are cleanly single-sourced — no duplicated
OPERATION_REGISTRY, no duplicated tier table, and the `FREE_SIGNUP_GRANT` constant is
imported (not re-typed) at every call site. The findings below are the remaining cruft:
one confirmed dead export that divergently duplicates a live code path, plus consistency
/ naming / stale-comment tail items.

## 1. Dead `insufficientResponse` divergently duplicates the live 402 path (and drops the UPL disclaimer)
- **Severity**: High
- **Category**: dead-code
- **File**: src/lib/tokens/guard.ts:66-71
- **Scenario**: `insufficientResponse(cost, balance)` builds the `{ error: "insufficient_tokens", cost, balance }` 402 body. Grep across the WHOLE repo (`immigration-paperwork`) finds zero callers — the only other reference is a stale claim in `docs/plans/feature-roadmap-2026-06-13.md:67` that "draft/rfe/categorize routes already emit … (`guard.ts insufficientResponse`)". They do not: the real money path, `src/lib/ai/operation.ts:324-332`, hand-builds its own 402 inline.
- **Root cause**: When the per-route charge flow was consolidated into the `executeAiOperation` orchestrator, the orchestrator inlined the 402 envelope and `insufficientResponse` was left behind, never deleted.
- **Impact**: A misleading dead export sitting in the money kernel: it LOOKS like the canonical 402 builder, so a future dev may wire a new route to it — but it OMITS the `disclaimer: DISCLAIMER` field that `operation.ts` deliberately includes on the 402 path as a UPL (not-legal-advice) safeguard. Two divergent definitions of the same wire contract, one of them silently non-compliant.
- **Fix sketch**: Delete `insufficientResponse` (lines 66-71) and fix the stale doc reference. If a shared 402 builder IS wanted, hoist the orchestrator's version (with `disclaimer`) into one exported helper and have `operation.ts` call it — mirroring how `tooManyRequestsResponse` already centralizes the 429.

## 2. `labelOf` throws on an unknown op while its sibling `costOf` defends — latent billing-page crash through an unsound cast
- **Severity**: Medium
- **Category**: consolidation
- **File**: src/lib/tokens/registry.ts:65-67 (call site: src/app/billing/page.tsx:47)
- **Scenario**: `labelOf(op)` is `return OPERATION_REGISTRY[op].label`. The billing activity list calls it as `labelOf(e.operation as OperationKey)` where `e.operation` is a RAW string read off a `debit` ledger row. The `as OperationKey` cast is unsound — if a row carries an operation string that is not a current registry key (e.g. an op renamed/removed, as already happened in the qualify→orchestrator migration, ADR-0005), `OPERATION_REGISTRY[op]` is `undefined` and `.label` throws, crashing the server render of the billing page.
- **Root cause**: `costOf` in the SAME file was hardened to default unknown keys to the light tier (+`console.warn`), but its sibling `labelOf` never got the same defensive treatment, and the caller papers over the gap with a cast instead of a runtime guard.
- **Impact**: A stale/renamed op string in any historical ledger row takes down `/billing` for that user. Inconsistent: two lookups over the same registry, one safe and one not.
- **Fix sketch**: Make `labelOf` total like `costOf`: `return OPERATION_REGISTRY[op as OperationKey]?.label ?? op;` (accept `op: string`), then drop the unsound `as OperationKey` cast at billing/page.tsx:47.

## 3. Three `Charge*` types, two of them named `ChargeOutcome` with different shapes; `operation.ts` hand-mirrors guard's `ChargeResult`
- **Severity**: Medium
- **Category**: naming
- **File**: src/lib/ai/operation.ts:64-68 (vs src/lib/tokens/guard.ts:10-13 and src/lib/db/store.ts re-exported via src/lib/tokens/ledger.ts:9,12)
- **Scenario**: `operation.ts` declares `export type ChargeOutcome = …` as the 3-variant union `{ ok; cost; balance; reclaim } | { unauthenticated } | { insufficient }`, commented "Mirror of `ChargeResult` from `@/lib/tokens/guard`, decoupled for testing." But `ChargeOutcome` is ALSO the name of the store's charge return type (`{ ok; balance }`), re-exported through `ledger.ts`. So the identifier `ChargeOutcome` denotes two structurally different shapes in two modules, and the orchestrator's copy must be kept byte-identical to guard's `ChargeResult` by hand.
- **Root cause**: Deliberate decoupling for unit-testability, but the mirror reused the store's type NAME and never references the guard type it must track, so nothing flags drift (e.g. a new `reason` variant added to guard won't surface here).
- **Impact**: Confusing for readers (same name, two shapes), and a silent-drift risk on the money kernel's most important type. The actual `chargeForOperation` return (`guard.ChargeResult`) is what `operation.ts` consumes at runtime.
- **Fix sketch**: Rename the orchestrator's mirror to `ChargeResult` (matching what it mirrors) to end the name collision, and/or have it `import type { ChargeResult }` from guard so the two can't diverge — the "decoupled for testing" goal only needs the test's spy to be structurally compatible, not a separately-named duplicate.

## 4. Read path (`getBalance`/`getLedgerForUser`) silently returns 0/[] on a configured-but-null store, while the write path (`charge`) warns
- **Severity**: Low
- **Category**: consolidation
- **File**: src/lib/tokens/ledger.ts:59-62 and 65-71 (vs the `warnIfMeteringExpected` guard at 18-24, 82-85)
- **Scenario**: `charge()` calls `warnIfMeteringExpected("charge")` when a store IS configured (prod) but `getStore()` flapped to null — a deliberate "metering silently opened" alarm. The read helpers in the same file, `getBalance` (`store ? … : 0`) and `getLedgerForUser` (`store ? … : []`), take the identical null-store branch but stay SILENT — so on the same admin-init flap the dashboard/billing pages render "0 tokens" / empty history with no operator signal.
- **Root cause**: The observability hook was added only to the write path when the revenue-leak concern was raised; the read paths were left as plain ternaries.
- **Impact**: A transient store outage shows users a scary, wrong "0 balance / no history" with zero log breadcrumb to correlate, while the very next charge in the same window logs loudly — inconsistent observability for one root cause.
- **Fix sketch**: Route the null-store branch of `getBalance`/`getLedgerForUser` through the existing `warnIfMeteringExpected("getBalance"|"getLedgerForUser")` before returning the empty default, so the read and write paths share one alarm.

## 5. Stale comment in `costOf` points at `economy.ts costOf`, a function that no longer lives there
- **Severity**: Low
- **Category**: cleanup
- **File**: src/lib/tokens/registry.ts:50-51
- **Scenario**: The `costOf` doc says unknown ops "never throws (matches the prior behavior of economy.ts `costOf`)." `costOf` was MOVED out of `economy.ts` into this file; grepping `economy.ts` for `costOf` now returns nothing, so the cross-reference points at a function that no longer exists where it says.
- **Root cause**: The cost logic migrated `economy.ts` → `registry.ts` (the file header even instructs callers to import `costOf` from here), but the in-body comment kept its historical phrasing.
- **Impact**: Minor — a reader who follows the breadcrumb to `economy.ts` finds nothing and wastes a lookup; the comment implies a duplicate still exists.
- **Fix sketch**: Reword to "(preserves the original costOf fallback behavior)" — drop the dangling `economy.ts` file reference.
