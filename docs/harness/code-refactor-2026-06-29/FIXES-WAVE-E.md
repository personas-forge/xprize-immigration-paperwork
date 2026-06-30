# Wave E — Guard/Façade Duplication & Webhook (Theme F)

Branch `vibeman/code-refactor-2026-06-29`, on top of Waves A–D. Behavior-preserving
for valid inputs; the two defensive hardenings (`pickStr` dedupe key, `labelOf`
crash guard) produce IDENTICAL results for well-formed data — only malformed
inputs that previously slipped through (or crashed) change. Gates green
throughout: `tsc --noEmit` clean, `npm test` = **455 pass / 0 fail** (baseline 443
+ 12 new tests; no test deleted or weakened).

## Closed (5 findings)

| # | Finding | Commit | What & verification |
|---|---------|--------|---------------------|
| 1 | rate-limiting #1 (MED) | `58ac824` | Added one `enforceRateLimit(request, scope, limit, disclaimer, userId?)` façade to `rate-limit.ts` running the enable→key→check→429 sequence; rewired the 3 non-orchestrated routes (`qualify/preview`, `qualify/preview/best-path`, `draft/save`), each collapsing ~6 lines + a 5-symbol import to one call. `disclaimer` kept a PARAM (no `@/lib/result` import in the limiter). Behavior identical: previews key by IP, draft/save by `user?.id`, same caps. +2 façade tests. |
| 2 | checkout-token-bundles #2 (MED) | `19ce6bb` | Routed the refund dedupe key `order.order_id ?? order.orderId` through the type-guarded `pickStr(event.data, "order_id", "orderId")` — the double-clawback guard now uses the centralized reader. New `polar-fields.test.ts` (+7) pins byte-identical equivalence for well-formed string payloads and rejection of a non-string. |
| 3 | checkout-token-bundles #1 (MED) | `b4aca4d` | Added `featuredBundle()` to `economy.ts`; rewired `PassportLanding.tsx` (price caption) and `charts.tsx` (cost-compare bars) off `b.key === "pro"` onto it, deriving price/tokens from the resolved bundle and dropping the `"$48 · 8,000 tokens"` fallback literals. +1 test (exactly one featured bundle). |
| 4 | token-economy-ledger #2 (MED) | `c00c384` | Made `labelOf(op: string)` total — `OPERATION_REGISTRY[op]?.label ?? op`, mirroring `costOf` — and dropped the unsound `e.operation as OperationKey` cast at `billing/page.tsx:47`. A stale/renamed op string in a historical ledger row can no longer crash the `/billing` render. +2 tests (known label unchanged, unknown returns raw). |
| 5 | token-economy-ledger #3 (MED) | `18df707` | Renamed `operation.ts`'s 3-variant `ChargeOutcome` → `ChargeResult` (matching the guard type it mirrors), ending the collision with the store's unrelated `ChargeOutcome` (`{ ok; balance }`). Type-only, zero runtime; kept a local structural mirror (no `server-only` guard import). Updated `operation.test.ts` refs. |

## Webhook dedupe-key equivalence (finding #2 — explicit verification)

For a **well-formed** `refund.created` payload (`order_id` is a non-empty string):
`order.order_id ?? order.orderId` returns `order.order_id`; `pickStr(event.data,
"order_id", "orderId")` returns the first non-empty string → the same
`event.data.order_id` (`order = event.data`). **Byte-identical.** Camel fallback
(`order_id` absent, `orderId` present) → both return `orderId`. Both absent →
both `undefined`. The ONLY divergence is malformed input: a non-string `order_id`
(e.g. a number) or an empty string passes the raw `??` but is correctly rejected
by `pickStr` (skips to `orderId`, else `undefined`) — the intended hardening on
the field that prevents double-clawback. `order.refunded` is unchanged (`order.id`).

## Deferred

None. All five Theme-F findings were clean and were closed. (Finding #5 was the
one flagged "DEFER if risky" — it proved to be a clean type-only rename with zero
runtime change and a complete, contained consumer set [`operation.ts` +
`operation.test.ts`], so it was done rather than deferred.)

## Notes / things worth your attention

- **`PolarOrder.order_id` / `orderId` fields now unread.** After #2, the local
  `PolarOrder` type still declares `order_id?` / `orderId?` but nothing reads them
  off the cast (they resolve via `pickStr(event.data, …)`). Harmless; trimming the
  `PolarOrder` type is the separate `checkout-token-bundles.md` finding #3 (LOW,
  out of this wave) — left for that pass.
- **Rate-limit scope-string nit untouched.** `draft/save` still uses the lone
  kebab-case scope `"draft-save"` (vs snake_case elsewhere) — `rate-limiting.md`
  finding #3 (LOW). It's an in-process map key; renaming is behavior-neutral but
  out of this wave's scope, so the literal was preserved exactly to keep the
  façade rewrite a pure no-op.
- **Test count delta:** +2 rate-limit, +7 polar-fields (new file), +1 economy,
  +2 registry = +12 → 455. The new `polar-fields.test.ts` is the first coverage
  for `pickStr`/`productId`/`resolveUserId` (the webhook route itself stays
  un-unit-tested — it imports `@polar-sh/sdk` + the `server-only` ledger).
