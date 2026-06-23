# Code Refactor — Checkout & Token Bundles
> Total: 5 (C0/H2/M2/L1)

## 1. `productId` snake/camel normalization triplicated across the webhook context
- **Severity**: High
- **Category**: duplication
- **File**: src/app/api/polar/webhook/route.ts:90, src/app/api/polar/webhook/route.ts:117, src/app/api/polar/webhook/relay-revenue.ts:22-26
- **Scenario**: The identical "Polar sends productId OR product_id, take whichever is a string" normalization is spelled out three times. In `route.ts` it is inlined as `order.productId ?? order.product_id` at both line 90 (paid path) and line 117 (refund path); in `relay-revenue.ts` it is a standalone `productId(data)` helper (lines 22-26). The same camel/snake duality is also encoded in the `PolarOrder` type's paired fields (`productId`/`product_id`, `externalCustomerId`/`external_customer_id`, `orderId`/`order_id`, `customer.externalId`/`customer.external_id`). Grep: `product_id|productId` across `src/` returns these three reader sites plus the unrelated `cost-telemetry.ts` and `economy.bundleByProductId` (a pure lookup, not a normalizer).
- **Root cause**: No single "read a Polar field that may be camel or snake" accessor; each call site re-implements the `??` fallback (and `relay-revenue.ts` re-implements it AGAIN with `typeof === "string"` guards because it reads from an untyped `Record`).
- **Impact**: A divergence risk on the money path: `route.ts` uses raw `??` (no string-type guard), while `relay-revenue.ts` guards with `typeof`. If Polar ever sends a non-string `productId` (e.g. `null`), the two paths resolve the product differently — one could credit/clawback a bundle the revenue relay does not record, silently desyncing token grants from revenue telemetry. Two inline copies in the same file also mean a future field-name change (Polar SDK rename) must be made in 3 places.
- **Fix sketch**: Add one `readField(order, "productId", "product_id")` (or a small `pickStr` over the union) helper used by both the paid and refund branches in `route.ts`, and have `relay-revenue.ts` reuse it (export it from a shared `polar-fields.ts` next to the route). Collapses 3 readers to 1 and removes the type-guard divergence.

## 2. `resolveUserId` and the revenue relay's `userId` resolve the buyer from DIFFERENT field sets
- **Severity**: High
- **Category**: duplication
- **File**: src/app/api/polar/webhook/route.ts:34-43, src/app/api/polar/webhook/relay-revenue.ts:44-47
- **Scenario**: Both files, processing the SAME verified event in the SAME request (`route.ts` calls `polarEventToRevenue(event)` at line 168), independently resolve "which user does this order belong to." `route.ts::resolveUserId` reads five sources in priority order (`metadata.userId` → `externalCustomerId` → `external_customer_id` → `customer.externalId` → `customer.external_id`). `relay-revenue.ts::userId` reads ONLY `metadata.userId`. Grep: `resolveUserId|externalCustomerId|external_customer_id` confirms the five-source resolver lives only in `route.ts`; `relay-revenue.ts` has the one-source version.
- **Root cause**: The renewal-userId fallback chain (the whole point of the `externalCustomerId` plumbing documented at checkout/route.ts:30-34) was added to the credit path but never shared with the relay mapper, which still assumes metadata always carries `userId`.
- **Impact**: On a SUBSCRIPTION CYCLE (renewal) order — exactly the case `externalCustomerId` exists to cover — the token credit IS attributed to the user (via the fallback) but the revenue relay's `customerId` comes back `undefined`, so margin/revenue telemetry can't join that renewal to the customer. The two resolvers will diverge precisely on the orders the fallback was built for, and a reader sees "credited but no revenue attribution" with no obvious cause.
- **Fix sketch**: Export `resolveUserId` (operating on the field-union) and call it from `polarEventToRevenue` instead of the local one-source `userId`. One resolver, one priority order, identical attribution on both paths.

## 3. `finiteCents` (route) and `num` (relay) are near-duplicate numeric guards over the same payload
- **Severity**: Medium
- **Category**: duplication
- **File**: src/app/api/polar/webhook/route.ts:26-28, src/app/api/polar/webhook/relay-revenue.ts:38-40
- **Scenario**: `route.ts::finiteCents` = `typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined`. `relay-revenue.ts::num` = `typeof v === "number" && Number.isFinite(v) ? v : undefined`. Both are applied to the same Polar minor-unit amount fields (`refunded_amount`, `amount`, `total_amount`, `net_amount`) within the same webhook flow. The only difference is the `>= 0` clamp. Grep: `finiteCents|Number.isFinite` shows these are the only two "finite money guard" definitions in the webhook context (other `Number.isFinite` hits are in unrelated feature modules).
- **Root cause**: The two files were written independently (relay was split out for unit-testability per its header) and each grew its own number-coercion helper rather than sharing one.
- **Impact**: Smaller than #1/#2 — but a maintainer must remember which guard does the non-negative clamp. A negative `refunded_amount` is rejected by `route.ts` (good — would otherwise mint tokens on a clawback) but accepted by the relay's `num`, so a malformed negative refund would still be reported as negative revenue while the clawback was skipped. Worth unifying so the "valid money amount" rule has one definition.
- **Fix sketch**: Single `finiteCents(v, { nonNegative? })` in the shared `polar-fields.ts`; relay calls it without the flag, route with it. Removes the second near-identical guard.

## 4. `isBest = b.key === "pro"` highlight rule duplicated in the bundle grid and the landing page
- **Severity**: Medium
- **Category**: duplication
- **File**: src/app/billing/BundleGrid.tsx:85 (+95 "Best value" stamp), src/components/landing/PassportLanding.tsx:524 (+569 "Best value" stamp)
- **Scenario**: Which bundle is the highlighted "Best value" card is decided by a hardcoded key-equality check in two separate components. `BundleGrid.tsx:85`: `const isBest = b.key === "pro";` and `BundleGrid.tsx:95`: `<Stamp label="Best value" …/>`. `PassportLanding.tsx:524`: `highlight={b.key === "pro"}` and `PassportLanding.tsx:569`: `<Stamp label="Best value" …/>`. Grep `isBest|Best value|"pro"` confirms both components encode the same `"pro"` literal and the same hand-authored "Best value" label; the bundle catalog (`economy.ts`) has NO `featured`/`highlight` flag.
- **Root cause**: The "featured bundle" is a property of the catalog (a merchandising decision) but is expressed as presentation logic, re-derived from a magic string in each surface that renders bundles.
- **Impact**: Promoting a different bundle (e.g. "scale") to "Best value" requires editing two files and changing a string literal in each; miss one and the billing page and landing page disagree on which bundle is recommended — a customer-facing inconsistency on a money page. The label text "Best value" is likewise duplicated and could drift.
- **Fix sketch**: Add an optional `featured?: boolean` (or `badge?: string`) to the `Bundle` type in `economy.ts`, set it on the `pro` entry, and have both components read `b.featured` / `b.badge` instead of `b.key === "pro"` and the literal label. Catalog becomes the single source for the merchandising highlight.

## 5. Redundant `b.tokens.toLocaleString()` rendered twice per card with a misleading second label
- **Severity**: Low
- **Category**: cleanup
- **File**: src/app/billing/BundleGrid.tsx:126, src/app/billing/BundleGrid.tsx:136
- **Scenario**: Inside each bundle card, line 126 renders `{b.tokens.toLocaleString()} tokens` and line 136 renders `≈ {b.tokens.toLocaleString()} guidance answers` — the exact same number formatted the exact same way, twice, three lines apart. Grep `guidance answers|≈ {b.tokens` confirms line 136 is the only "guidance answers" site and it reuses `b.tokens` verbatim.
- **Root cause**: The "≈ N guidance answers" line equates one token to one guidance answer (`b.tokens` used directly), but per `registry.ts` different operations cost different token amounts (the billing page itself renders a per-op cost table, page.tsx:24-30, `costOf`). So the second line is both a literal duplicate of the token count and a semantically inaccurate restatement (it implies 1 token = 1 answer, contradicting the cost table on the same page).
- **Impact**: Cosmetic/clarity: the card shows the same figure twice, and the "guidance answers" framing silently asserts a 1:1 token-to-answer rate the metering does not honor. Low severity (copy, not logic) but it is redundant rendering of a derived value plus a minor truth drift.
- **Fix sketch**: Either drop the duplicate line, or derive it from a real per-answer cost (e.g. `Math.floor(b.tokens / costOf("qualify"))`) so it stops repeating the token count and stops implying a 1:1 rate.
