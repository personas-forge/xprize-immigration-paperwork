# Checkout & Token Bundles — Feature Scout + Ambiguity Guardian

> Context #12 · Group: Billing & Token Economy
> Total: 5 findings

## 1. Partial / amount-mismatched refund claws back the FULL bundle, not the refunded amount
- **Lens**: ambiguity-guardian
- **Priority**: High
- **Category**: edge_case
- **File**: `src/app/api/polar/webhook/route.ts:117`
- **Observation**: The clawback unconditionally debits `-b.tokens` (the bundle's full token grant) for any `refund.created` / `order.refunded`, regardless of the actual `refunded_amount` / `amount` on the payload. Polar supports partial refunds, and `relay-revenue.ts:77` already reads `refunded_amount ?? amount` for the revenue relay — so a partial dollar refund here silently reverses 100% of the tokens. There is no recorded decision that "any refund = full bundle reversal"; the comment only addresses the dedupe-key bug, not the amount. The 0-floor in the store (`pglite-store.ts:354`) hides the over-debit by clamping to zero, so it's invisible unless the ledger is audited.
- **Proposal**: Derive the clawback from the refunded cents on the payload (proportional: `round(b.tokens * refundedCents / b.priceCents)`, capped at `b.tokens`), or explicitly document and assert "refunds are full-bundle only; partial refunds unsupported" and reject/alert on a partial. Record the chosen policy in a comment so an auditor can recover intent.
- **Value / Risk-if-ignored**: A $5 goodwill partial refund on the Scale bundle wipes all 30,000 tokens — a wrong money outcome that over-penalizes the customer and corrupts reconciliation against Polar's dollar ledger.
- **Effort**: M

## 2. Self-serve billing history / receipts page (only a live balance exists today)
- **Lens**: feature-scout
- **Priority**: High
- **Category**: feature
- **File**: `src/app/billing/page.tsx:75`
- **Observation**: The billing page shows only the current balance number and the bundle grid. Every purchase, reclaim, refund and grant is already written to `token_ledger` with `delta`, `reason`, `ref`, `balance_after`, `metadata` and timestamps (`pglite-store.ts:359`), but there is no UI to view it. A paying applicant cannot see what they bought, when, for how much, or download a receipt — and `PurchaseToast` only says tokens "will appear momentarily" with no confirmation row to point to.
- **Proposal**: Add a "Ledger history" section (paginated read of `token_ledger` for the user) listing date, reason, delta, running balance, and the Polar order id, with a per-purchase receipt link (Polar hosts order receipts) or a generated invoice. The data layer already exists; this is mostly a read endpoint + table.
- **Value / Risk-if-ignored**: Receipts/history are table-stakes for a prepaid product people expense to employers or attorneys; absence drives support tickets ("where did my tokens go?") and undermines trust in the metering.
- **Effort**: M

## 3. `recurring` "Monthly" bundle is sold via the one-time bundle grid with no subscription affordances
- **Lens**: feature-scout
- **Priority**: High
- **Category**: functionality
- **File**: `src/lib/tokens/economy.ts:52`
- **Observation**: `BUNDLES` includes a `recurring: true` Monthly plan ($19/mo, 2,500 tokens), and the checkout route + webhook are written to handle subscription-cycle orders (`externalCustomerId` fallback in `checkout/route.ts:34`). But the UI treats it identically to a one-time bundle: same "Buy tokens" button, no "renews monthly / cancel anytime" copy, and crucially **no way to view, manage, or cancel** the subscription afterward. There is no customer-portal link anywhere in this context.
- **Proposal**: Surface the recurring plan distinctly (renewal cadence, "Manage subscription" affordance) and add a Polar customer-portal link (`/api/portal` → `customerSessions.create` / portal URL) so users can update payment method or cancel without contacting support.
- **Value / Risk-if-ignored**: Selling a subscription with no cancel path invites chargebacks and refund requests (each of which then triggers finding #1's clawback), and likely violates auto-renewal disclosure expectations. The recurring revenue line is half-built.
- **Effort**: M

## 4. Checkout never records pending intent — an abandoned/failed payment is unobservable, and the success page can't confirm the credit
- **Lens**: ambiguity-guardian
- **Priority**: Medium
- **Category**: trade-off
- **File**: `src/app/api/checkout/route.ts:26`
- **Observation**: `checkouts.create` returns a URL and the route returns; nothing is persisted about the attempt (no pending-order row, no intent log). Credit happens only later in the webhook. The `?status=success` redirect (`billing/page.tsx:47`) and `PurchaseToast` are driven purely by the successUrl query param — they fire even if the webhook hasn't landed (or never lands), so the user is told "payment received" with no actual confirmation, and balance still reads the stale pre-credit number until refresh. The trade-off (fully webhook-driven crediting, no intent record) is undocumented.
- **Proposal**: Either (a) write a pending intent keyed by the Polar checkout id at creation and reconcile/observe stragglers, or (b) on the success page poll the balance / latest `purchase` ledger row before claiming "received". At minimum, document that success copy is optimistic and crediting is webhook-authoritative.
- **Value / Risk-if-ignored**: A successful Polar payment whose webhook silently fails leaves a paid-but-uncredited customer that nobody can see (the webhook 500s into Polar's retry queue, but there's no app-side record to reconcile against). Optimistic "payment received" copy compounds the confusion.
- **Effort**: M

## 5. `customerEmail` from `user.email` may be undefined, and email is never reconciled to `externalCustomerId` — silent guest checkout
- **Lens**: ambiguity-guardian
- **Priority**: Medium
- **Category**: edge_case
- **File**: `src/app/api/checkout/route.ts:29`
- **Observation**: `customerEmail: user.email ?? undefined` quietly degrades to no email when an authenticated user has no email on the session (the type allows it). Combined with `externalCustomerId: user.id`, there's an unstated assumption that Polar will always bind the order to our user id even with no email. If Polar instead creates/looks up a customer by email and the two diverge, a renewal could attach to a different customer record — and the webhook's `resolveUserId` chain (`webhook/route.ts:24`) would still need `externalCustomerId` to win. The fallback ordering and the "email optional" path have no recorded reasoning or test.
- **Proposal**: Decide and document the identity contract: is `externalCustomerId` always authoritative regardless of email? If so, assert it on the order in the webhook and log when only email matched. Consider requiring an email (or a friendly error) before checkout rather than passing `undefined`.
- **Value / Risk-if-ignored**: A renewal credited to the wrong (or no) user is a wrong-money outcome that's hard to trace; the ambiguity hides whether id or email is the true customer key.
- **Effort**: S
```
