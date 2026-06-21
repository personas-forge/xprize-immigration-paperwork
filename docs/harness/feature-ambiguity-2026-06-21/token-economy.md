# Token Economy & Ledger — Feature Scout + Ambiguity Guardian

> Context #13 · Group: Billing & Token Economy
> Total: 5 findings

## 1. No token-ledger history / per-operation spend view
- **Lens**: feature-scout
- **Priority**: High
- **Category**: feature
- **File**: `src/app/billing/page.tsx:75` (balance card) · `src/lib/db/store.ts:181` (Store interface)
- **Observation**: The billing page shows a single current-balance number and a static "what a token buys" price table, but the `token_ledger` table/collection already records every debit, credit, reclaim, refund and grant with `operation`, `delta`, `balance_after`, `ref` and `created_at` (pglite-store.ts:53-68, firestore-store.ts:191-213). None of that history is ever read back: `Store` exposes `getBalance` but no `getLedger`/`listTransactions`, so a paying user cannot see where their tokens went, which case consumed a 12-token draft, or that a failed op was reclaimed. For a prepaid, charge-then-reclaim economy this is the single most-requested trust feature.
- **Proposal**: Add `Store.getLedgerForUser(userId, limit)` (one indexed query per driver — `token_ledger_user` index already exists) and render a paginated "Recent activity" list under the balance card: date, operation label (via `labelOf`), signed delta, running balance, and a "refunded" badge for reclaim rows. Group by case where `metadata.operation`/case id is present.
- **Value / Risk-if-ignored**: Spend transparency is table-stakes for prepaid credit products; without it users dispute charges they cannot self-verify, and support has to read the raw ledger by hand. Directly reduces refund/chargeback pressure called out in the billing footnote.
- **Effort**: M

## 2. "Is metering on?" is decided three different ways — Firestore prod shows "∞" while being billed
- **Lens**: ambiguity-guardian
- **Priority**: High
- **Category**: edge_case
- **File**: `src/app/billing/page.tsx:51` · `src/lib/tokens/economy.ts:23` · `src/lib/tokens/guard.ts:40-44`
- **Observation**: Three modules answer "is the token economy enforced?" with three different predicates. The guard enforces when `isStoreConfigured() && (isFirebaseConfigured() || isDevAuth())` — and `isStoreConfigured()` returns true for Firestore prod **without** any `DATABASE_URL` (config.ts:32-45). But `isMeteringBypassed` keys purely on `!env.DATABASE_URL` (economy.ts:23), and the billing page decides whether to show a real balance with `user && process.env.DATABASE_URL` (page.tsx:51). In the actual prod driver (Firestore, no `DATABASE_URL`), the guard **charges** the user while the billing page renders the balance as "∞" and `isMeteringBypassed` claims metering is off. The three predicates silently disagree on the canonical prod configuration.
- **Proposal**: Make `isStoreConfigured()` (or a single new `isMeteringEnforced()`) the one source of truth and have all three call sites use it; delete the ad-hoc `DATABASE_URL` checks in billing/page.tsx:51 and the `!DATABASE_URL` branch in `isMeteringBypassed`. Add a test asserting all three agree for the Firestore-prod env shape.
- **Value / Risk-if-ignored**: A charged user seeing "∞ tokens" is a billing-trust and support incident, and `isMeteringBypassed` (used by callers as the off-switch) being wrong for prod risks code paths assuming free-pass when the user is actually metered.
- **Effort**: S

## 3. `charge` idempotency dedup key (`reason='debit'`) is undocumented and unenforced by the unique index
- **Lens**: ambiguity-guardian
- **Priority**: High
- **Category**: edge_case
- **File**: `src/lib/db/pglite-store.ts:313-317` · `src/lib/db/pglite-store.ts:66-67`
- **Observation**: `charge` dedupes a retry by `select 1 from token_ledger where ref = $1 and reason = 'debit'` (pglite-store.ts:314), but the only unique index is `token_ledger_ref_once on token_ledger(ref, reason) where ref is not null` (line 66). The debit's idempotency therefore relies on a **read-then-write inside a `FOR UPDATE` row lock on `token_accounts`**, not on the index — which holds only because every charge for a user serializes on that one account row. This invariant ("two concurrent charges with the same `ref` are safe only because they contend on the account lock") is the load-bearing assumption of the whole debit path and is written nowhere; the index comment doesn't mention `debit`, and a future reader could "optimize" the lock away or move the seen-check outside the transaction and reintroduce double-debits. The Firestore driver gets this guarantee structurally via the deterministic `debit_${ref}` doc id (firestore-store.ts:191), so the two drivers protect the same invariant by **different** mechanisms, also undocumented.
- **Proposal**: Document at pglite-store.ts:299 that debit idempotency is provided by the account-row `FOR UPDATE` lock + the `(ref, reason)` partial unique index together, and that the seen-check MUST stay inside the locked transaction. State explicitly that `ref` is the per-request `requestId` and that charge/reclaim never collide because their `reason` differs (`debit` vs `reclaim`).
- **Value / Risk-if-ignored**: A wrong-money outcome: a refactor that breaks the lock/transaction coupling silently double-debits a paying user, and nothing in the code or tests would flag it because the index alone does not cover the in-transaction read.
- **Effort**: S

## 4. Self-service refund-on-bad-output is invisible to users
- **Lens**: feature-scout
- **Priority**: Medium
- **Category**: user_benefit
- **File**: `src/lib/ai/operation.ts:306-318` · `src/lib/tokens/guard.ts:60`
- **Observation**: The orchestrator already auto-reclaims a charge when the model throws or returns unusable output and serves a mock instead (operation.ts:351,372,386). But when the reclaim itself fails, the code deliberately leaves the charge debited and only `console.error`s ("charge left debited", operation.ts:316) — the user silently overpaid for a mock with no record they can act on and no path to recover it. There is also no user-facing affordance to flag "this draft was unusable, refund me," even though the ledger has a first-class `refund` reason ready (store.ts:39).
- **Proposal**: When `reclaim()` fails, write a ledger/metadata marker (e.g. `metadata.reclaim_failed: requestId`) so a sweep or support tool can later credit it, and surface a "Report a bad result" action on AI outputs that files a refund request keyed to the op's `requestId` (dedup-safe via the existing `(ref, reason='refund')` index).
- **Value / Risk-if-ignored**: Silent overcharges on degraded outputs are exactly the failure that drives chargebacks; a visible, idempotent refund path turns a trust-eroding silent loss into a recoverable, audited event.
- **Effort**: M

## 5. Magic constants `FREE_SIGNUP_GRANT=150` and `MAX_LEDGER_AMOUNT=1_000_000` carry no recorded reasoning or drift guard
- **Lens**: ambiguity-guardian
- **Priority**: Medium
- **Category**: code_quality
- **File**: `src/lib/tokens/economy.ts:11` · `src/lib/tokens/ledger.ts:33`
- **Observation**: `FREE_SIGNUP_GRANT = 150` is asserted only to be "a positive integer" (economy.test.ts:90) — nothing ties it to what 150 tokens actually *buys* (e.g. it is 12.5 full drafts at the xl tier, or 150 light ops), so a future tier reprice in `TIER_COST` silently changes the economic value of the free grant with no test catching it. `MAX_LEDGER_AMOUNT = 1_000_000` is documented as "well above the largest bundle (30k) and matches the dev-route clamp" (ledger.ts:32), but that coupling to `BUNDLES` (max 30000) and the dev-route clamp (grant-tokens/route.ts:28) is by comment only — repricing the Scale bundle above 1M, or changing one clamp, would diverge them with no failing test.
- **Proposal**: Add a comment/ADR note stating the intended economic value of the free grant (e.g. "≈ N full screenings / 1 draft, enough to evaluate the product") and a test asserting `FREE_SIGNUP_GRANT >= costOf('draft')` and `MAX_LEDGER_AMOUNT > max(BUNDLES.tokens)` so the documented relationships are machine-enforced rather than comment-only.
- **Proposal note**: keep it to the two invariants above — no broader doc expansion needed.
- **Value / Risk-if-ignored**: Low-probability but real money/UX drift: a tier reprice could make the free grant worthless (or absurdly generous) or push a bundle past the ledger cap so that purchase throws, and today nothing would fail to warn the team.
- **Effort**: S
