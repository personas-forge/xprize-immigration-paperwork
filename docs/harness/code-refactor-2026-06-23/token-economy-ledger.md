# Code Refactor — Token Economy & Ledger
> Total: 5 (C0/H2/M2/L1)

## 1. `MAX_LEDGER_AMOUNT` cap (1,000,000) duplicated as an inline literal in the dev grant route
- **Severity**: High
- **Category**: duplication
- **File**: src/app/api/dev/grant-tokens/route.ts:28 ↔ src/lib/tokens/ledger.ts:33
- **Scenario**: The ledger declares the kernel-wide bound `const MAX_LEDGER_AMOUNT = 1_000_000;` (ledger.ts:33) and validates every credit/charge against it. The dev grant route re-clamps the requested amount with a *hand-copied* literal: `Math.max(1, Math.min(1_000_000, Math.trunc(raw)))` (route.ts:28). The ledger comment even admits the coupling — "1,000,000 … matches the dev-route clamp". Confirmed both occurrences via `grep -n "1_000_000|1000000|MAX_LEDGER_AMOUNT" src/` (only these two source sites; the third hit is `rate-limit.test.ts` as an unrelated timestamp, the fourth is an unrelated `features/review/actions.ts` random-number range).
- **Root cause**: The bound is a shared invariant of the money kernel, but it is a non-exported module-private const in ledger.ts, so the only way another module can honor "the same cap" is to retype the number.
- **Impact**: Two sources of truth for the ledger's hard ceiling. If the cap is ever raised/lowered in ledger.ts, the dev route silently keeps the stale clamp — the route would either reject values the ledger now accepts, or (worse, if the route's literal were raised independently) pass values the ledger then throws on, turning a dev top-up into a 500. The "matches the dev-route clamp" comment is a maintenance landmine: a reviewer must remember to update a second file.
- **Fix sketch**: `export const MAX_LEDGER_AMOUNT` from ledger.ts and import it in the dev route: `Math.min(MAX_LEDGER_AMOUNT, …)`. Delete the literal and the "matches the dev-route clamp" coupling comment.

## 2. `assertChargeCost` / `assertCreditAmount` are near-identical bound validators
- **Severity**: Medium
- **Category**: duplication
- **File**: src/lib/tokens/ledger.ts:37-43 and :47-53
- **Scenario**: Two private validators differ only in whether negatives are allowed and the error-string wording:
  - `assertChargeCost`: `!Number.isInteger(cost) || cost < 0 || cost > MAX` → "charge cost must be an integer in [0, MAX]".
  - `assertCreditAmount`: `!Number.isInteger(amount) || Math.abs(amount) > MAX` → "credit amount must be an integer in [-MAX, MAX]".
  The integer check, the magnitude check, the throw shape, and the `MAX_LEDGER_AMOUNT` reference are copy-pasted across both.
- **Root cause**: The only real axis of variation is "may this amount be negative?" — but instead of one parameterized assertion, the variation was forked into two whole functions.
- **Impact**: Low blast radius today, but any future tightening of the boundary contract (e.g. a different upper bound for credits, or surfacing the bad value differently) has to be edited in two places and can drift. It also obscures that the two share one invariant.
- **Fix sketch**: One helper, e.g. `assertBoundedInt(value, { allowNegative, what })`, returning/throwing the same shape; `assertChargeCost` passes `allowNegative:false`, `assertCreditAmount` passes `allowNegative:true`. Keeps the distinct error wording via the `what` arg.

## 3. `isMeteringBypassed` is a redundant inverse wrapper with no production caller
- **Severity**: Medium
- **Category**: dead-code
- **File**: src/lib/tokens/economy.ts:23-27
- **Scenario**: `isMeteringBypassed(env)` is a one-line `return !isMeteringEnforced(env)`. Verified callers with `grep -n "isMeteringBypassed\(" src/`: the only call sites are inside `economy.test.ts`. Every *production* "is metering off?" decision calls the canonical `isMeteringEnforced` directly — guard.ts:40 (`if (!isMeteringEnforced())`), billing/page.tsx:76, and config.ts itself. Even guard.ts's own comment (line 38) name-drops `isMeteringBypassed` for "the three can't disagree", yet the code there does NOT call it. (Note: the TOKENS_BYPASS free-pass *behavior* is intentional and stays — this flags only the unused inverse wrapper, not the feature.)
- **Root cause**: The wrapper predates centralizing the switch in `isMeteringEnforced` (config.ts). Once callers migrated to the canonical predicate, the inverse became a test-only artifact that the bypass test suite still pins.
- **Impact**: A third name for the same boolean ("bypassed" vs "enforced" vs the raw `!`), exported from a second module, that readers must reconcile. The doc comment claims it unifies "every is-metering-off caller" — but there are none, so the comment is misleading. Carries its own test block (economy.test.ts:96-122) maintaining a function nothing ships against.
- **Fix sketch**: Delete `isMeteringBypassed` (and its import of `isMeteringEnforced` if now unused in economy.ts), and either drop the bypass tests or re-point them at `isMeteringEnforced` directly (asserting the same env matrix with inverted expectations). Update the guard.ts:38 comment to reference `isMeteringEnforced`, since that's what it actually calls.

## 4. Free-pass / "no store → unmetered" semantics are open-coded across guard.ts and ledger.ts
- **Severity**: Medium
- **Category**: structure
- **File**: src/lib/tokens/guard.ts:15-20, :40, :45 ↔ src/lib/tokens/ledger.ts:78-81
- **Scenario**: The "metering is off, let it through free" outcome is constructed independently in two layers. guard.ts builds a `FREE_PASS` object with `balance: Number.POSITIVE_INFINITY` and returns it from three branches. ledger.ts's `charge` separately returns `{ ok: true, balance: Number.POSITIVE_INFINITY }` when `getStore()` is null. Both encode the same convention ("free pass == ok with an infinite balance"), but neither references the other; `Number.POSITIVE_INFINITY` as the sentinel appears in both files (confirmed via `grep -n "POSITIVE_INFINITY|FREE_PASS" src/lib/tokens`).
- **Root cause**: The free-pass concept lives at two altitudes (route guard and ledger delegator) and was expressed ad hoc at each, rather than one shared notion of "unmetered success".
- **Impact**: The "infinite balance signals free pass" contract is implicit and unenforced. A change to how free-pass is represented (e.g. a distinct `metered:false` flag instead of `Infinity`, to stop `Infinity` leaking into a UI balance render) must be found and updated in both files; missing one yields divergent free-pass shapes between the guard and the ledger.
- **Fix sketch**: Lift the sentinel/shape into one place — e.g. an exported `FREE_PASS_BALANCE` const (or a small `freePassOutcome()` factory) in ledger.ts that guard.ts's `FREE_PASS` consumes — so both layers point at one definition of "unmetered success".

## 5. Stale "(was only a code comment before)" / migration breadcrumbs left in shipped doc comments
- **Severity**: Low
- **Category**: cleanup
- **File**: src/lib/tokens/registry.ts:24, :32-36; src/lib/tokens/economy.ts:19-21
- **Scenario**: Several doc comments narrate the *history of a past refactor* rather than the current contract:
  - registry.ts:24 — "Human-readable name, for UI and logs (was only a code comment before)."
  - registry.ts:32-36 — prose explaining the `qualify→orchestrator migration (ADR-0005, PR #12)` and "gained its 40/window cap", which restates git/ADR history inline.
  - economy.ts:19-21 — a paragraph in `isMeteringBypassed`'s JSDoc explaining that it "previously this keyed on `!DATABASE_URL` … that wrongly reported 'bypassed'". This describes a bug that no longer exists in the code.
- **Root cause**: Refactor rationale was parked in the source as comments instead of in the commit/ADR, then never pruned once the change landed.
- **Impact**: Purely cosmetic, but it inflates the comment-to-code ratio and dates the file ("before", "previously", PR numbers), making the current behavior harder to read at a glance. The economy.ts breadcrumb is doubly redundant with finding #3 (it documents a wrapper that has no callers).
- **Fix sketch**: Trim each comment to the present-tense contract (e.g. registry.ts:24 → just "Human-readable name, for UI and logs."). Keep the ADR-0005 *reference* as a one-liner pointer; move the narrative to the ADR. If finding #3 is taken, the economy.ts paragraph deletes with the function.
