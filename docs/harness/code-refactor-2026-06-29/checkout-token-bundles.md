# Code Refactor — Checkout & Token Bundles
> Total: 5
> Critical: 0 | High: 0 | Medium: 2 | Low: 3

Scope note: bundle definitions and pricing constants are NOT duplicated between
`polar/client.ts` and `BundleGrid.tsx` — both derive from the single source
`src/lib/tokens/economy.ts` (BundleGrid receives `BUNDLES` as a prop; client.ts
holds no bundle data). Idempotency-key handling is also NOT duplicated: the
checkout route sets `metadata` only; the webhook owns dedupe via `credit()`'s
order-id key. The two NOTE-able consolidation cracks left are the partially-
adopted `featured` flag and the webhook's hand-rolled field fallback below.

## 1. `featured` consolidation only half-done — Pro bundle still re-found by `b.key === "pro"` magic string in two callers
- **Severity**: Medium
- **Category**: consolidation
- **File**: src/lib/tokens/economy.ts:32-34,40 (no `featuredBundle()` helper); src/components/landing/PassportLanding.tsx:39; src/components/landing/charts.tsx:114
- **Scenario**: `economy.ts` added the `featured?: boolean` flag *specifically* to kill the `b.key === "pro"` magic string ("so the billing grid and the landing page can't disagree on which bundle is recommended — was a `b.key === "pro"` magic string in each"). `BundleGrid.tsx:84` and `PassportLanding.tsx:532` correctly consume `b.featured`. But two other callers that need "the highlighted bundle" still hardcode `BUNDLES.find((b) => b.key === "pro")` — `PassportLanding.tsx:39` (the price caption) and `charts.tsx:114` (the cost-comparison chart). Each also carries a hand-authored fallback literal (`"$48 for 8,000 tokens"`, `"$48 · 8,000 tokens"`) that re-encodes Pro's price/tokens a third and fourth time.
- **Root cause**: The flag was introduced but adoption stopped at the two grid render sites; there is no `featuredBundle()` accessor in economy.ts, so non-grid consumers fell back to the magic key.
- **Impact**: The exact drift the `featured` flag was meant to prevent is still live. If marketing re-points the highlight (sets `featured: true` on e.g. `scale`), the "Best value" stamp moves but the landing caption and the cost chart keep quoting Pro — a silent disagreement across the page. Also four copies of Pro's price/token numbers (two live `find`s + two string fallbacks) to keep in sync.
- **Fix sketch**: Add `export const featuredBundle = () => BUNDLES.find((b) => b.featured)` to economy.ts; have both landing call sites use it (and derive the fallback caption from it) instead of `find((b) => b.key === "pro")`.

## 2. Webhook re-implements the snake/camel `??` fallback that `pickStr` exists to centralize
- **Severity**: Medium
- **Category**: duplication
- **File**: src/app/api/polar/webhook/route.ts:106
- **Scenario**: `polar-fields.ts` was created so "Polar sends several fields in both camelCase and snake_case; these readers normalise that duality once instead of each call site re-implementing the `??` fallback" — and `pickStr(data, ...keys)` type-guards each key so a non-string can't slip through. The webhook uses the shared readers for user id, product id and amounts, but line 106 hand-rolls `order.order_id ?? order.orderId` for the refund's original-order id — exactly the camel/snake fallback `pickStr` was built to own.
- **Root cause**: The two original-order-id keys were read straight off the local `PolarOrder` cast instead of routed through `pickStr`.
- **Impact**: The dedupe key for the refund clawback bypasses the shared, type-guarded reader. A non-string `order_id` (malformed payload) would pass through the raw `??` where `pickStr` would have rejected it — and this is the very field that prevents double-clawback, so it is the worst place to skip the guard. Plus it re-grows the per-call-site `??` duplication the module was meant to delete.
- **Fix sketch**: `const originalOrderId = event.type === "order.refunded" ? order.id : pickStr(event.data, "order_id", "orderId");` (import `pickStr`, already exported from `./polar-fields`).

## 3. Webhook re-declares the `WebhookEvent` shape inline and a `PolarOrder` type that re-states field-name knowledge already in `polar-fields`
- **Severity**: Low
- **Category**: structure
- **File**: src/app/api/polar/webhook/route.ts:9-24,52
- **Scenario**: `relay-revenue.ts:13-16` already `export interface WebhookEvent { type: string; data: Record<string, unknown> }`, but the webhook re-declares the identical shape inline at route.ts:52 (`let event: { type: string; data: Record<string, unknown> }`). Separately, the local `PolarOrder` type (lines 9-24) enumerates the camel+snake field pairs (`externalCustomerId`/`external_customer_id`, `order_id`/`orderId`, `productId`/`product_id`, …) whose duality `polar-fields.ts` already encodes in its readers — so the same field-name knowledge now lives in three files.
- **Root cause**: Types grew locally alongside the shared readers rather than being imported from / co-located with them.
- **Impact**: Adding or renaming a Polar field means editing the readers in `polar-fields.ts` AND the `PolarOrder` type here; the inline event type is a verbatim copy of an already-exported interface. Low correctness risk (it's type-only), but it dilutes the "normalise the duality once" intent.
- **Fix sketch**: Import `WebhookEvent` from `./relay-revenue` (or hoist it into `polar-fields.ts`) and type `event` with it; trim `PolarOrder` to only the fields read directly here (`id`, `refunded_amount`, `amount`, `metadata`) and resolve the rest through the readers.

## 4. Webhook's "billing configured" gate is open-coded instead of a `client.ts` predicate
- **Severity**: Low
- **Category**: consolidation
- **File**: src/app/api/polar/webhook/route.ts:46-47 vs src/lib/polar/client.ts:5-9
- **Scenario**: `client.ts` is the designated home for Polar configuration predicates — `isPolarConfigured()` gates the checkout route. The webhook instead inlines `const secret = process.env.POLAR_WEBHOOK_SECRET; if (!secret) return new Response(...503)`. So one of the two Polar config gates lives in the shared module and the other is hand-rolled in the route.
- **Root cause**: No `isPolarWebhookConfigured()` companion exists, so the webhook reads the env var directly.
- **Impact**: Polar env-gating is split across two locations; a future change to how "billing is configured" is detected (or the env var name) has to be found in both. Minor — the two gates genuinely check different env vars, so this is consistency, not redundancy.
- **Fix sketch**: Add `export function isPolarWebhookConfigured(): boolean { return Boolean(process.env.POLAR_WEBHOOK_SECRET); }` to client.ts and call it from the webhook (it still needs the raw secret to pass to `validateEvent`, so keep the read but gate via the predicate).

## 5. Three near-duplicate "verify against the @polar-sh/sdk version" reminder comments
- **Severity**: Low
- **Category**: cleanup
- **File**: src/lib/polar/client.ts:19-22; src/app/api/checkout/route.ts:21-23; src/app/api/polar/webhook/route.ts:54
- **Scenario**: The same caveat — "the SDK method names/shapes evolve; verify against the installed version's types / the sandbox" — is restated three times across the three Polar files (client.ts NOTE block, the checkout `checkouts.create` preamble, the webhook `validateEvent` line). The advice is accurate (not lying), just repeated verbatim-ish in each call site.
- **Root cause**: Each file independently documents the same SDK-drift risk rather than pointing at one note.
- **Impact**: Cosmetic — comment bloat on the money path; three places to update if the SDK guidance changes. No behavioral effect.
- **Fix sketch**: Keep the single authoritative note in `client.ts` (the module that owns the SDK) and trim the per-call-site repetitions to a one-line pointer, or drop them.
