import { type NextRequest } from "next/server";
import { validateEvent } from "@polar-sh/sdk/webhooks";
import { credit } from "@/lib/tokens/ledger";
import { bundleByKey, bundleByProductId } from "@/lib/tokens/economy";

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
    const order = event.data as {
      id: string;
      productId?: string;
      product_id?: string;
      metadata?: Record<string, string>;
    };
    const userId = order.metadata?.userId;
    const productId = order.productId ?? order.product_id;
    const b =
      (order.metadata?.bundle && bundleByKey(order.metadata.bundle)) ||
      (productId ? bundleByProductId(productId) : undefined);

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
    const order = event.data as {
      id: string;
      order_id?: string;
      orderId?: string;
      productId?: string;
      product_id?: string;
      metadata?: Record<string, string>;
    };
    const userId = order.metadata?.userId;
    // Mirror the paid path's two-step resolution (metadata.bundle, else product
    // id) so a refund payload that lost metadata.bundle still claws back instead
    // of silently no-op'ing while the original purchase WAS credited.
    const productId = order.productId ?? order.product_id;
    const b =
      (order.metadata?.bundle && bundleByKey(order.metadata.bundle)) ||
      (productId ? bundleByProductId(productId) : undefined);
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

  return new Response("ok", { status: 200 });
}
