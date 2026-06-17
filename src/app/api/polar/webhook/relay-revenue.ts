// Pure mapping for the Pattern-3 revenue relay: a signature-verified Polar event -> the revenue
// record we POST to LightTrack (lib/cost-telemetry). Split out so it's unit-testable without the
// route's network deps. Independent of the token-economy credit logic: this tracks the DOLLARS the
// customer paid (for margin), not our internal token grant.
//
// This app's webhook route (route.ts) doesn't carry a separate parse-payload module exporting the
// verified-event shape + field readers, so the minimal `WebhookEvent` contract and the
// `orderId`/`productId` normalisers are inlined here.

/** Minimal shape of a signature-verified Polar webhook event the mapper reads. */
export interface WebhookEvent {
  type: string;
  data: Record<string, unknown>;
}

/** The order id, trimmed; "" when absent. On `order.paid` Polar uses `id` as the order id. */
function orderId(data: Record<string, unknown>): string {
  return typeof data.id === "string" ? data.id.trim() : "";
}

/** The product id, normalising Polar's snake_case/camelCase duality (`productId` ?? `product_id`). */
function productId(data: Record<string, unknown>): string | undefined {
  if (typeof data.productId === "string") return data.productId;
  if (typeof data.product_id === "string") return data.product_id;
  return undefined;
}

export interface RevenueRelay {
  externalId: string;
  customerId?: string;
  productId?: string;
  amountUsd: number;
  currency?: string;
  kind: "subscription" | "one_time" | "refund";
  ts?: string;
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function str(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}
function userId(data: Record<string, unknown>): string | undefined {
  const meta = data.metadata as Record<string, unknown> | undefined;
  return typeof meta?.userId === "string" ? meta.userId : undefined;
}

/**
 * Map a verified Polar event to a LightTrack revenue relay, or null when it isn't a settled order /
 * refund. Amounts are Polar minor units (cents) -> dollars; customer is keyed on `metadata.userId`
 * (the same id LLM events carry, so margin joins). `order.paid` with a `subscription_id` is recurring;
 * refunds (`order.refunded` order payload, or `refund.created` refund payload) net revenue down.
 */
export function polarEventToRevenue(event: WebhookEvent): RevenueRelay | null {
  const d = event.data;

  if (event.type === "order.paid") {
    const ext = orderId(d);
    const cents = num(d.total_amount) ?? num(d.net_amount);
    if (!ext || cents == null) return null;
    return {
      externalId: ext,
      customerId: userId(d),
      productId: productId(d),
      amountUsd: cents / 100,
      currency: str(d.currency),
      kind: str(d.subscription_id) ? "subscription" : "one_time",
      ts: str(d.created_at),
    };
  }

  if (event.type === "order.refunded" || event.type === "refund.created") {
    // refund.created: data is a Refund {id, amount, order_id}; order.refunded: an Order {refunded_amount}.
    const ext =
      (event.type === "refund.created" ? str(d.id) : undefined) ?? str(d.order_id) ?? orderId(d);
    const cents = num(d.refunded_amount) ?? num(d.amount);
    if (!ext || !cents) return null;
    return {
      externalId: ext,
      customerId: userId(d),
      amountUsd: cents / 100,
      currency: str(d.currency),
      kind: "refund",
      ts: str(d.created_at),
    };
  }

  return null;
}
