// Shared readers for Polar webhook payloads, used by BOTH the credit path
// (route.ts) and the revenue relay (relay-revenue.ts) so the two can never
// resolve the same order's buyer / product / amount differently. Polar sends
// several fields in both camelCase and snake_case; these readers normalise that
// duality once instead of each call site re-implementing the `??` fallback.

/** First non-empty string among `keys` on `data`, else undefined. Type-guards
 *  every key, so a non-string value can't slip through (the raw `a ?? b` reader
 *  it replaces did not). */
export function pickStr(
  data: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const k of keys) {
    const v = data[k];
    if (typeof v === "string" && v) return v;
  }
  return undefined;
}

/** The Polar product id (`productId` ?? `product_id`), else undefined. */
export function productId(data: Record<string, unknown>): string | undefined {
  return pickStr(data, "productId", "product_id");
}

/** Resolve our user id from a Polar order/refund payload. Per-order
 *  `metadata.userId` is set at checkout but may NOT propagate to subscription-
 *  cycle (renewal) orders, so fall back to the customer external id we set
 *  (`externalCustomerId`) at checkout, which Polar attaches to every order
 *  including renewals. ONE resolver so the credit path and the revenue relay
 *  attribute the same renewal to the same user. */
export function resolveUserId(
  data: Record<string, unknown>,
): string | undefined {
  const meta = data.metadata as Record<string, unknown> | undefined;
  const customer = data.customer as Record<string, unknown> | null | undefined;
  return (
    (typeof meta?.userId === "string" && meta.userId ? meta.userId : undefined) ||
    pickStr(data, "externalCustomerId", "external_customer_id") ||
    (customer ? pickStr(customer, "externalId", "external_id") : undefined) ||
    undefined
  );
}

/** A finite cents amount from an untrusted payload field, else undefined. Pass
 *  `{ nonNegative: true }` on the credit/clawback path (a negative there would
 *  mint tokens on a refund); the revenue relay accepts signed amounts. */
export function finiteCents(
  v: unknown,
  opts: { nonNegative?: boolean } = {},
): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  if (opts.nonNegative && v < 0) return undefined;
  return v;
}
