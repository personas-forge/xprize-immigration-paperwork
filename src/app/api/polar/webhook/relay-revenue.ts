// Pure mapping for the Pattern-3 revenue relay: a signature-verified Polar event -> the revenue
// record we POST to LightTrack (lib/cost-telemetry). Split out so it's unit-testable without the
// route's network deps. Independent of the token-economy credit logic: this tracks the DOLLARS the
// customer paid (for margin), not our internal token grant.
//
// Field readers (`productId`, `resolveUserId`, `finiteCents`) are shared with the
// credit path via `./polar-fields`, so the relay and route can't resolve the same
// order's buyer / product / amount differently.

import { finiteCents, productId, resolveUserId } from "./polar-fields";

/** Minimal shape of a signature-verified Polar webhook event the mapper reads. */
export interface WebhookEvent {
  type: string;
  data: Record<string, unknown>;
}

/** The order id, trimmed; "" when absent. On `order.paid` Polar uses `id` as the order id. */
function orderId(data: Record<string, unknown>): string {
  return typeof data.id === "string" ? data.id.trim() : "";
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

function str(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
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
    const cents = finiteCents(d.total_amount) ?? finiteCents(d.net_amount);
    if (!ext || cents == null) return null;
    return {
      externalId: ext,
      customerId: resolveUserId(d),
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
    const cents = finiteCents(d.refunded_amount) ?? finiteCents(d.amount);
    if (!ext || !cents) return null;
    return {
      externalId: ext,
      customerId: resolveUserId(d),
      amountUsd: cents / 100,
      currency: str(d.currency),
      kind: "refund",
      ts: str(d.created_at),
    };
  }

  return null;
}
