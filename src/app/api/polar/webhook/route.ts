import { type NextRequest } from "next/server";
import { validateEvent } from "@polar-sh/sdk/webhooks";
import { credit } from "@/lib/tokens/ledger";
import { bundleByKey, bundleByProductId } from "@/lib/tokens/economy";
import { polarEventToRevenue } from "./relay-revenue";
import { trackRevenue } from "@/lib/cost-telemetry";

type PolarOrder = {
  id: string;
  productId?: string;
  product_id?: string;
  order_id?: string;
  orderId?: string;
  externalCustomerId?: string;
  external_customer_id?: string;
  customer?: { externalId?: string; external_id?: string } | null;
  metadata?: Record<string, string>;
};

/** Resolve our user id. Per-order `metadata.userId` is set at checkout but may
 *  NOT propagate to subscription-cycle (renewal) orders, so fall back to the
 *  customer external id, which we set (`externalCustomerId`) at checkout and
 *  which Polar attaches to every order including renewals. */
function resolveUserId(order: PolarOrder): string | undefined {
  return (
    order.metadata?.userId ||
    order.externalCustomerId ||
    order.external_customer_id ||
    order.customer?.externalId ||
    order.customer?.external_id ||
    undefined
  );
}

/** Resolve the credited bundle. The product id is the SIGNED, paid fact and is
 *  authoritative; `metadata.bundle` is only a fallback when the product id is
 *  unmappable. If both resolve and DISAGREE, trust the product and log — never
 *  mint the metadata bundle (which could be 60x the bundle actually paid for). */
function resolveBundle(order: PolarOrder, productId: string | undefined) {
  const byProduct = productId ? bundleByProductId(productId) : undefined;
  const byMeta = order.metadata?.bundle ? bundleByKey(order.metadata.bundle) : undefined;
  if (byProduct && byMeta && byProduct.key !== byMeta.key) {
    console.error(
      `[polar webhook] bundle mismatch on order=${order.id}: productId=${productId} → ` +
        `${byProduct.key}, metadata.bundle=${order.metadata?.bundle} → ${byMeta.key}; ` +
        `crediting the PAID product bundle`,
    );
  }
  return byProduct ?? byMeta;
}

// Polar -> us. On a paid one-time order, credit the buyer's token balance.
// Idempotent: credit() de-dupes by the Polar order id.
export async function POST(request: NextRequest) {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  if (!secret) return new Response("billing not configured", { status: 503 });

  const body = await request.text();
  const headers = Object.fromEntries(request.headers.entries());

  let event: { type: string; data: Record<string, unknown> };
  try {
    // Verify the SDK's webhook-validation signature/shape for your version.
    event = validateEvent(body, headers, secret) as unknown as typeof event;
  } catch {
    return new Response("invalid signature", { status: 403 });
  }

  // Credit ONLY on order.paid: Polar fires order.created BEFORE the payment is
  // captured (verified against the sandbox in the kp project, 2026-06-12) — a
  // created-but-never-paid order must not grant tokens. The order-id dedupe in
  // credit() already made created+paid double-fires safe; this closes the
  // created-only hole. Covers subscription cycle orders too (the monthly
  // bundle): each cycle has a fresh order id, so renewals re-credit monthly —
  // verify metadata.userId propagates to cycle orders on the first sandbox
  // renewal (checkout metadata → subscription → order).
  if (event.type === "order.paid") {
    const order = event.data as PolarOrder;
    const userId = resolveUserId(order);
    const productId = order.productId ?? order.product_id;
    const b = resolveBundle(order, productId);

    if (userId && b) {
      await credit(userId, b.tokens, "purchase", order.id, { bundle: b.key });
    } else {
      // A captured payment we cannot credit (missing metadata.userId or an
      // unmapped product) must NOT be silently dropped with a 200 — that
      // leaves a paying customer uncredited and unobservable. Log it and
      // return 500 so Polar retries (and an operator can fix the mapping).
      console.error(
        `[polar webhook] order.paid not credited: order=${order.id} ` +
          `userId=${userId ?? "<missing>"} bundle=${b?.key ?? "<unresolved>"} ` +
          `productId=${productId ?? "<none>"}`,
      );
      return new Response("order.paid could not be credited", { status: 500 });
    }
  }

  // Refund/chargeback reversal (optional clawback). Confirm event name.
  if (event.type === "refund.created" || event.type === "order.refunded") {
    const order = event.data as PolarOrder;
    const userId = resolveUserId(order);
    // Mirror the paid path's resolution (product id authoritative, metadata
    // bundle only as fallback) so a refund payload that lost metadata.bundle
    // still claws back instead of silently no-op'ing while the original purchase
    // WAS credited.
    const productId = order.productId ?? order.product_id;
    const b = resolveBundle(order, productId);
    // Dedupe on the ORIGINAL order id, not the per-attempt refund id. A
    // refund.created payload's root `id` is the refund id (distinct for each
    // refund attempt), so keying the ref on it would let two refunds against the
    // same order both clawback (double-debit). order.refunded carries the order
    // id at its root; refund.created carries it as order_id.
    const originalOrderId =
      event.type === "order.refunded" ? order.id : order.order_id ?? order.orderId;
    if (userId && b && originalOrderId) {
      await credit(userId, -b.tokens, "refund", `refund:${originalOrderId}`, { bundle: b.key });
    }
  }

  // Pattern 3: relay the settled order/refund to LightTrack as revenue (profit/margin). We already
  // verified the signature above, so no secret is shared with LightTrack — it trusts this project-keyed
  // relay. Best-effort: trackRevenue swallows its own errors, so Polar still gets its 200 regardless.
  const revenue = polarEventToRevenue(event);
  if (revenue) await trackRevenue(revenue);

  return new Response("ok", { status: 200 });
}
