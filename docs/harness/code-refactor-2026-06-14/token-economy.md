# Code Refactor Scan — Token Economy & Ledger

> Total: 4 (C0 / H1 / M2 / L1)

## 1. `OPERATIONS` export is dead — no production consumer, only a self-referential test
- **Severity**: high
- **Category**: dead-code
- **File**: src/lib/tokens/economy.ts:25-27
- **Scenario**: `OPERATIONS` (a `Record<string, OpTier>` derived from `OPERATION_REGISTRY` via `Object.fromEntries`) was the old op→tier map. After the registry consolidation, nothing reads it except the test that asserts it mirrors the registry.
- **Root cause**: When the per-op config moved into `OPERATION_REGISTRY` (the single source of truth), `economy.ts` kept re-deriving `OPERATIONS` as a back-compat shim — but every real consumer that needed an op's tier now reads the registry (or `costOf`) directly. The only remaining importer is `registry.test.ts:11,76-85`, which tests that `OPERATIONS` equals the registry's tiers. That test validates a surface that exists only for the test.
- **Impact**: Dead exported surface plus a circular validation: the registry test imports from `economy.ts` purely to assert economy mirrors the registry. ~3 lines of code + ~10 lines of test exist with no runtime purpose. Adds a non-obvious economy→registry coupling that a reader must trace.
- **Verification**: Grepped the whole repo for `\bOPERATIONS\b`. Only hits: the declaration (economy.ts:25), and `registry.test.ts:11,78,82` (import + the `economy.ts OPERATIONS maps every op to its registry tier` test). No `src/app/**`, `src/features/**`, `guard.ts`, `rate-limit.ts`, or `ledger.ts` reference. Rate-limit derives from `OPERATION_REGISTRY` directly (rate-limit.ts:19,44-50); UI reads `costOf`/`TIER_COST`.
- **Fix sketch**: Delete the `OPERATIONS` const from economy.ts and the `economy.ts OPERATIONS maps...` test in registry.test.ts. If a consumer ever needs the op→tier map, derive it inline from `OPERATION_REGISTRY`. No breaking-change risk: zero non-test importers.

## 2. `economy.ts` re-exports of `costOf` / `OpTier` are a bypassable indirection over `registry.ts`
- **Severity**: medium
- **Category**: structure
- **File**: src/lib/tokens/economy.ts:14-15
- **Scenario**: `economy.ts` does `export { costOf } from "./registry"` and `export type { OpTier } from "./registry"`. Callers (`guard.ts:8`, `QualifyPanel.tsx:6`, `FieldGuidancePanel.tsx:6`) import `costOf` from `@/lib/tokens/economy`, yet the identical symbol lives in `registry.ts` and the registry is documented as the single source of truth.
- **Root cause**: The re-exports are a deliberate back-compat shim so existing imports stayed green during the registry consolidation. The shim still works, but it makes `economy.ts` a partial pass-through for registry symbols — a reader of `guard.ts` follows the import to economy.ts only to be bounced to registry.ts. Note `OpTier` re-export has zero importers anywhere (grepped `\bOpTier\b` repo-wide: only declared in registry.ts:12 and re-exported in economy.ts:12,14).
- **Impact**: Indirection without value: two-hop import resolution for `costOf`, and a fully-unused `OpTier` re-export. Not large or buggy, but it muddies which module owns the metering vocabulary. Genuinely-owned economy exports (`BUNDLES`, `bundleByKey`, `FREE_SIGNUP_GRANT`, `isMeteringBypassed`, etc.) remain and justify the file's existence — so this is a trim, not a merge.
- **Verification**: `costOf` importers from economy: guard.ts, QualifyPanel.tsx, FieldGuidancePanel.tsx (3). All would resolve identically against `@/lib/tokens/registry`. `OpTier` re-export: no importer outside the tokens dir.
- **Fix sketch**: Point the 3 `costOf` importers at `@/lib/tokens/registry`, then drop the `costOf` and `OpTier` re-export lines from economy.ts (low-churn, 3 import edits). Safe — same function reference, idempotency/free-pass semantics untouched. Optional; the shim is harmless, so leave if churn is unwanted.

## 3. `OP_COST` is a pure alias of `TIER_COST` consumed only by tests
- **Severity**: medium
- **Category**: duplication
- **File**: src/lib/tokens/economy.ts:21
- **Scenario**: `export const OP_COST = TIER_COST;` exposes the registry's tier→cost table under a second name. Production code that wants tier costs already imports `TIER_COST` from the registry directly (`TokenExplainerBanner.tsx:4,22` → `TIER_COST.xl`). `OP_COST` is imported only by the two test files.
- **Root cause**: `OP_COST` was the original cost table name; after the table moved to the registry as `TIER_COST`, `economy.ts` aliased it to preserve the public name. The alias is now a synonym kept alive purely so the existing tests (`economy.test.ts:7`, `registry.test.ts:11,72-73`) can assert `OP_COST === TIER_COST`.
- **Impact**: Two names for one table is a readability/duplication tax: a reader must learn `OP_COST` and `TIER_COST` are the same object, and the test `economy.ts OP_COST is the registry's TIER_COST` asserts a tautology (`deepEqual` of an object with itself by reference). No runtime consumer benefits.
- **Verification**: Grepped `\bOP_COST\b` repo-wide: declaration (economy.ts:21) + only test files (economy.test.ts ×10 uses, registry.test.ts:11,73). No `src/app/**` or `src/features/**` consumer. `TIER_COST` is the name production UI uses.
- **Fix sketch**: Remove `OP_COST` from economy.ts and update `economy.test.ts` to import `TIER_COST` from `./registry` (the assertions read identically — `costOf("draft") === TIER_COST.xl`). Drop the redundant `OP_COST === TIER_COST` test in registry.test.ts. Pure rename consolidation; no behavior change.

## 4. Stale "inline config" provenance comments now point at code that no longer exists
- **Severity**: low
- **Category**: cleanup
- **File**: src/lib/tokens/registry.ts:33-37 (and economy.ts:6-9)
- **Scenario**: registry.ts:34 says values are "byte-identical to the prior inline config (economy.ts OP_COST/OPERATIONS + rate-limit.ts RATE_LIMITS)". economy.ts:6-9 describes itself as DERIVING `OP_COST, OPERATIONS, OpTier, costOf` to "keep the same public surface... so the existing tests stay green unchanged." These comments document a migration that is finished and reference the very shims flagged above for removal.
- **Root cause**: Migration-era provenance comments were left in place. They are accurate today but describe transitional scaffolding, and they will be actively wrong once findings #1–#3 land (they name `OPERATIONS`/`OP_COST` as the public surface to preserve).
- **Impact**: Cosmetic. Mild reader confusion (points to "inline config in economy.ts" that is no longer inline) and a comment-maintenance hazard coupled to the shim removals above.
- **Verification**: Read both file headers. The "prior inline config" they cite is no longer in the tree; the surface they promise to preserve (`OPERATIONS`, `OP_COST`) has only test consumers (findings #1, #3).
- **Fix sketch**: When/if #1–#3 are applied, trim these comments to state simply that the registry is the single source of truth and economy.ts owns bundles/grant/bypass. If the shims are kept, leave the comments. Do not touch in isolation — fold into the shim cleanup to avoid a churn-only commit.
