# Code Refactor Scan — Checkout & Token Bundles

> Total: 4 (C0 / H1 / M2 / L1)

## 1. Dead `tokens` value in Polar checkout metadata
- **Severity**: high
- **Category**: dead-code
- **File**: src/app/api/checkout/route.ts:31
- **Scenario**: Checkout writes `metadata: { userId, bundle: b.key, tokens: String(b.tokens) }` into the Polar session. On the order webhook, only `metadata.userId` and `metadata.bundle` are ever read; the credited amount is always re-derived server-side from the resolved `Bundle.tokens` (`webhook/route.ts:45` and `:78`). `metadata.tokens` is never consumed anywhere.
- **Root cause**: The metadata was authored as if the webhook would trust the client-echoed token count, but the design correctly re-resolves the bundle and uses its server-side `tokens`. The metadata field was left behind.
- **Impact**: A second, never-read source of truth for the credited amount rides on every checkout. It is harmless today (unused), but it invites a future bug: someone could "fix" the webhook to read `metadata.tokens`, which is attacker-influenceable echo data, weakening the credit path. Removing it keeps `Bundle.tokens` the single source of truth.
- **Verification**: Grepped the whole repo for `metadata.tokens` / `.tokens` — the only `.tokens` reads are `b.tokens` (server bundle) in the webhook and BundleGrid; no consumer of the metadata `tokens` key exists. Webhook reads only `order.metadata?.userId` and `order.metadata?.bundle`.
- **Fix sketch**: Drop `tokens: String(b.tokens)` from the checkout metadata object. Keep `userId` and `bundle` (both are read). No webhook change needed; do NOT add a `metadata.tokens` reader.

## 2. `recurring` bundle flag is unused by the billing UI
- **Severity**: medium
- **Category**: dead-code
- **File**: src/app/billing/BundleGrid.tsx:73 (consumer); src/lib/tokens/economy.ts:56,65 (definition)
- **Scenario**: `Bundle.recurring` is set `true` for the `monthly` subscription and is asserted by economy.test.ts, but `BundleGrid` maps every bundle identically and renders them all beneath the page header `§ Bundles — one-time top-up` (page.tsx:93). The recurring `monthly` plan (`$19/mo`) appears in the same "one-time" grid with no subscription affordance, and the only special-case is the hard-coded `isBest = b.key === "pro"` stamp.
- **Root cause**: The data model gained a `recurring` dimension (and a monthly bundle) but the grid was never branched on it — the field is consumed only in tests, not in the rendering surface that should differentiate it.
- **Impact**: Dead UI-side surface area: a typed bundle attribute that the only renderer ignores. It is also mildly misleading UX (a `$19/mo` plan under a "one-time top-up" heading), and the `isBest` "most topped up" stamp keying on a string literal rather than data is brittle.
- **Verification**: Grepped `recurring` across `src/app` and `src` — matches are economy.ts (definition), economy.test.ts (assertions), and docs/CHANGELOG only; zero reads in BundleGrid.tsx or page.tsx. `isBest` confirmed as a literal compare in BundleGrid.tsx:74.
- **Fix sketch**: Either branch on `b.recurring` in BundleGrid (distinct label/CTA, e.g. "Subscribe" vs "Buy tokens", and move it out of the "one-time" section), or — if the monthly plan is intentionally not yet surfaced — drop it from the rendered set. Consider replacing the `isBest` literal with a data flag (e.g. `featured?: boolean`) on the bundle.

## 3. Refund clawback resolves bundle by metadata only — asymmetric with the paid path
- **Severity**: medium
- **Category**: structure
- **File**: src/app/api/polar/webhook/route.ts:69
- **Scenario**: The `order.paid` path resolves the bundle with a two-step fallback — `metadata.bundle` OR `bundleByProductId(productId)` (lines 40-42). The refund path (`refund.created` / `order.refunded`) resolves ONLY via `metadata.bundle` (line 69) with no `productId` fallback. If a refund payload lacks `metadata.bundle` (e.g. metadata not propagated to the refund/cycle event), the clawback silently no-ops while the original purchase was credited.
- **Root cause**: The product-id fallback was added to the credit path (to survive missing metadata) but not mirrored onto the reversal path. The two money paths drifted.
- **Impact**: Structural asymmetry on the money path that can leave a refunded purchase un-clawed-back under exactly the metadata-loss condition the paid-path fallback was built to tolerate. This is a robustness/consistency gap, not a current dead-code item — flagged for parity. NOTE: any fix must preserve the existing dedupe-on-original-order-id (`refund:${originalOrderId}`) and signature verification; do not change those.
- **Verification**: Read both branches in webhook/route.ts. Paid path: lines 40-42 use `bundleByProductId`. Refund path: line 69 uses only `bundleByKey(metadata.bundle)`. `bundleByProductId` confirmed exported and tested (economy.test.ts:88).
- **Fix sketch**: Mirror the paid-path resolution in the refund branch: fall back to `bundleByProductId(order.productId ?? order.product_id)` when `metadata.bundle` is absent. Behavior-only parity; keep idempotency key and 403-on-bad-signature untouched. Treat as breaking-change-sensitive (money path) — verify against a sandbox refund before shipping.

## 4. Webhook config gate diverges from the shared `isPolarConfigured()` helper
- **Severity**: low
- **Category**: cleanup
- **File**: src/app/api/polar/webhook/route.ts:9-10
- **Scenario**: `client.ts` exports `isPolarConfigured()` (checks `POLAR_ACCESS_TOKEN`) as the documented "gates all purchase paths" helper, used by the checkout route. The webhook instead inlines its own gate on `process.env.POLAR_WEBHOOK_SECRET`.
- **Root cause**: The webhook legitimately needs the *secret*, not the access token, so it can't reuse `isPolarConfigured()` verbatim — but the "configured" concept is now expressed in two places with no shared vocabulary.
- **Impact**: Minor — two definitions of "is billing configured" with no single helper. Low risk because the webhook's secret check is the correct guard for its purpose; this is cosmetic consistency, not a bug.
- **Verification**: Grepped `isPolarConfigured` repo-wide — used only in checkout/route.ts and defined in client.ts; webhook does not import it. The secret check at webhook line 9-10 is the only config gate there.
- **Fix sketch**: Optionally add a small `isPolarWebhookConfigured()` helper in client.ts (`Boolean(process.env.POLAR_WEBHOOK_SECRET)`) so both config checks live beside each other. Purely organizational; do not weaken the secret requirement or signature verification.
