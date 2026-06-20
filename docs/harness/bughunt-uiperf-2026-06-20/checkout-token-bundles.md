> Total: 5 | Critical: 0 | High: 2 | Medium: 2 | Low: 1
> Context: Checkout & Token Bundles
> Lens mix: bug-hunter 3, ui-perfectionist 2

## 1. Webhook trusts `metadata.bundle` over the paid product — no reconciliation between credited bundle and `productId`
- **Severity**: High
- **Lens**: bug-hunter
- **Category**: money-path / product-id→bundle authority
- **File**: src/app/api/polar/webhook/route.ts:42-47 (resolution order); src/lib/tokens/economy.ts:52-57
- **Scenario**: On `order.paid` the webhook resolves the bundle as `(order.metadata?.bundle && bundleByKey(order.metadata.bundle)) || (productId ? bundleByProductId(productId) : undefined)`. `metadata.bundle` is tried FIRST and wins whenever it is any valid key. It then credits `b.tokens` for THAT bundle without ever checking that the resolved bundle's `polarProductId` equals the order's actual `productId`. If the echoed `metadata.bundle` ever disagrees with the product the customer actually paid for (env→product drift, a stale/edited checkout, a re-used checkout link, or future code that sets metadata from a less-trusted source), the buyer is credited for the metadata bundle, not the paid one — e.g. metadata says `scale` (30,000 tokens) while the paid product was `starter` (500 tokens / $5). Tokens are minted that were never paid for.
- **Root cause**: The two source-of-truth signals (echoed `metadata.bundle` and the authoritative `productId`) are treated as fallbacks of each other rather than cross-validated. The comment in checkout/route.ts asserts the server re-derives the amount "from the SERVER-side Bundle.tokens" — true for the *number*, but the bundle SELECTED still comes from echoed metadata, so the authority claim doesn't actually hold.
- **Impact**: Over-crediting / under-crediting of real money tokens whenever metadata and product diverge. Highest-value bundle is 60× the cheapest, so a mismatch is a 60× free-token swing. Authority for "what was paid" should be the product id, which Polar signs/owns.
- **Fix sketch**: Resolve the bundle from `productId` FIRST (the signed, paid fact). If `metadata.bundle` is also present and resolves to a DIFFERENT bundle than the product id, log a mismatch and credit the product-id bundle (never the metadata one) — or 500 to force operator review. Only fall back to `metadata.bundle` when the product id is genuinely unmappable.

## 2. Subscription renewal orders may carry no `metadata.userId`, hitting the uncreditable-500 branch → retry storm + uncredited paying subscriber
- **Severity**: High
- **Lens**: bug-hunter
- **Category**: webhook / subscription lifecycle
- **File**: src/app/api/polar/webhook/route.ts:33-59
- **Scenario**: The monthly bundle (`recurring: true`, economy.ts:49) is a Polar subscription. Each billing cycle fires a fresh `order.paid` with a new order id (relied on for re-crediting). But `metadata` set at *checkout* does not always propagate to *cycle* orders in Polar (the route comment itself flags this as unverified: "verify metadata.userId propagates to cycle orders on the first sandbox renewal"). If a renewal order arrives without `metadata.userId`, `userId` is undefined → falls into the else branch → returns **500 so Polar retries**. Polar will retry the same uncreditable order indefinitely; the subscriber paid but never gets tokens, and the failure is only visible as repeated 500 log lines.
- **Root cause**: The credit path depends on `metadata.userId` being present on every order, including renewals, but subscription-cycle metadata propagation is unverified and Polar-version-dependent. There is no fallback to resolve the user from the subscription/customer id.
- **Impact**: Paying monthly subscribers get no tokens on renewal; webhook endpoint stuck in a permanent retry loop for each affected renewal until manually fixed. Directly breaks the recurring revenue product.
- **Fix sketch**: Verify metadata propagation in the Polar sandbox before shipping the monthly bundle. Add a fallback that maps `order.customer_id` / `subscription_id` → user (persist the mapping at checkout, keyed on the subscription id) so renewals can be credited even when per-order metadata is absent. Keep the 500-for-retry behavior only for genuinely unknown users.

## 3. Refund clawback can drive balance negative and silently no-ops when it can't resolve (asymmetric with the paid path)
- **Severity**: Medium
- **Lens**: bug-hunter
- **Category**: money-path / refund correctness
- **File**: src/app/api/polar/webhook/route.ts:63-90; src/lib/db/pglite-store.ts:334 (`next = cur + amount`, no floor)
- **Scenario**: A refund credits `-b.tokens`. (a) If the buyer already SPENT the purchased tokens, the clawback sets the balance negative (no `max(0, …)` floor in either store driver), so a refunded user ends up with a negative balance they must "pay off" before any future operation succeeds — surprising and arguably wrong (should floor at 0 or to amount-still-held). (b) Unlike `order.paid`, the refund branch *silently no-ops* (no 500, no log) when it can't resolve `userId`/bundle/`originalOrderId`. A refund payload that lost `metadata.userId` leaves the original purchase credited but never clawed back, with zero observability — the mirror of the bug the paid-path 500 was added to prevent.
- **Root cause**: Refund clawback uses unbounded signed arithmetic and has no else-branch logging/alerting, so unresolvable refunds vanish.
- **Impact**: Negative balances lock legitimate users out; unresolved refunds leave money/tokens un-reconciled and invisible to operators.
- **Fix sketch**: Floor the post-refund balance (or clamp the clawback to tokens still held) and record the shortfall in metadata. Add an else-branch `console.error` for unresolvable refunds (mirror the paid path) so they are observable; consider a small reconciliation report.

## 4. Success toast asserts "tokens have been added" but the balance above it can still be pre-credit (webhook race)
- **Severity**: Medium
- **Lens**: ui-perfectionist
- **Category**: UX correctness / async state
- **File**: src/app/billing/PurchaseToast.tsx:37; src/app/billing/page.tsx:48-53,60
- **Scenario**: Polar redirects to `/billing?status=success`, which renders `PurchaseToast` stating "Payment received — your tokens have been added to your balance." But the credit happens asynchronously via the webhook, which may land *after* the redirect. The server-rendered balance (`getBalance`, line 52) and the toast are produced in the same request, so a user can see the confident "added to your balance" message sitting directly above a balance that has NOT yet increased. There is no refetch/poll, so the page never reconciles until a manual reload.
- **Root cause**: The success state is keyed on the redirect query param (proof the user returned from checkout), not on the credit actually being applied. UI claims completion of an event it hasn't confirmed.
- **Impact**: User distrust ("it says added but my balance is the same"), support tickets, and in the rare webhook-failure case the toast is simply false. Money-adjacent UX should not over-claim.
- **Fix sketch**: Soften copy to "Payment received — your tokens will appear in your balance momentarily," and/or poll `getBalance` (or revalidate) for a few seconds after `status=success` until the balance reflects the purchase, then swap to the confirmed message.

## 5. Currency / price formatting is ad-hoc strings + a11y gaps on the in-flight purchase button
- **Severity**: Low
- **Lens**: ui-perfectionist
- **Category**: visual consistency / a11y polish
- **File**: src/app/billing/BundleGrid.tsx:98,123,129-141; src/lib/tokens/economy.ts:44-49
- **Scenario**: Prices are hardcoded display strings (`priceLabel: "$5"`, `"$19/mo"`) while the per-token rate is computed as `centsPerToken.toFixed(2)¢` — two different formatting conventions, none locale-aware (`Intl.NumberFormat`), so currency can't re-skin per locale and "$5" vs "$5.00" vs "0.60¢" are visually inconsistent. Separately, while the in-flight button correctly disables all buttons and shows "Opening…", there is no `aria-busy`/`aria-live` so screen-reader users get no announcement that a checkout started; the loading-vs-idle change is purely visual.
- **Root cause**: Price labels authored as free-form strings rather than from a formatter; the loading state communicated only through visible text.
- **Impact**: Minor visual inconsistency and a quiet a11y gap on a money action; no functional break.
- **Fix sketch**: Derive `priceLabel` from a shared currency formatter (or `Intl.NumberFormat`) so cents/dollars render consistently and are localizable. Add `aria-busy={status.key === b.key}` to the active button and an `aria-live="polite"` region (or `role="status"`) announcing "Opening checkout…".
