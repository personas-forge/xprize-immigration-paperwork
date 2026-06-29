import { type NextRequest } from "next/server";
import { validateEvent } from "@polar-sh/sdk/webhooks";
import { credit } from "@/lib/tokens/ledger";
import { bundleByKey, bundleByProductId } from "@/lib/tokens/economy";
import { polarEventToRevenue, type WebhookEvent } from "./relay-revenue";
import { finiteCents, pickStr, productId, resolveUserId } from "./polar-fields";
import { trackRevenue } from "@/lib/cost-telemetry";

// Only the fields read DIRECTLY off the order cast. The buyer / product id /
// original-order-id (incl. their camel/snake duality) are resolved through the
// shared `./polar-fields` readers off `event.data`, so they deliberately don't
// live on this local type.
type PolarOrder = {
  id: string;
  metadata?: Record<string, string>;
  /** Refunded amount in minor units (cents). `order.refunded` carries
   *  `refunded_amount`; `refund.created` carries `amount`. Used to claw back
   *  PROPORTIONALLY rather than always reversing the full bundle. */
  refunded_amount?: number;
  amount?: number;
};

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

  let event: WebhookEvent;
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
    const userId = resolveUserId(event.data);
    const product = productId(event.data);
    const b = resolveBundle(order, product);

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
          `productId=${product ?? "<none>"}`,
      );
      return new Response("order.paid could not be credited", { status: 500 });
    }
  }

  // Refund/chargeback reversal (optional clawback). Confirm event name.
  if (event.type === "refund.created" || event.type === "order.refunded") {
    const order = event.data as PolarOrder;
    const userId = resolveUserId(event.data);
    // Mirror the paid path's resolution (product id authoritative, metadata
    // bundle only as fallback) so a refund payload that lost metadata.bundle
    // still claws back instead of silently no-op'ing while the original purchase
    // WAS credited.
    const product = productId(event.data);
    const b = resolveBundle(order, product);
    // Dedupe on the ORIGINAL order id, not the per-attempt refund id. A
    // refund.created payload's root `id` is the refund id (distinct for each
    // refund attempt), so keying the ref on it would let two refunds against the
    // same order both clawback (double-debit). order.refunded carries the order
    // id at its root; refund.created carries it as order_id.
    // Route the refund's original-order id through the shared, type-guarded
    // reader instead of a raw `??` (the dedupe key that prevents double-clawback
    // is the worst place to skip the guard). Identical to `order_id ?? orderId`
    // for well-formed payloads (a non-empty string wins); a non-string slips past
    // the raw `??` but is correctly rejected here.
    const originalOrderId =
      event.type === "order.refunded"
        ? order.id
        : pickStr(event.data, "order_id", "orderId");
    if (userId && b && originalOrderId) {
      // Claw back PROPORTIONALLY to the refunded amount, not the whole bundle:
      // Polar supports PARTIAL refunds, so a $5 goodwill refund on the $150 Scale
      // bundle must reverse ~1,000 tokens, not all 30,000. refundedCents comes
      // from the payload (order.refunded → refunded_amount; refund.created →
      // amount); absent/zero falls back to a full-bundle reversal (a malformed
      // payload — Polar always sends an amount) and is logged.
      // DEDUP TRADE-OFF: the ref stays keyed on the ORIGINAL order id so a
      // re-delivered refund event (and the order.refunded/refund.created pair for
      // the same refund) can't double-debit. The cost is that a SECOND distinct
      // partial refund on the same order is deduped (not clawed back) — accepted
      // as the conservative choice over any risk of double-clawback; revisit with
      // per-refund keying if multi-partial-refund-per-order becomes common.
      const refundedCents =
        finiteCents(order.refunded_amount, { nonNegative: true }) ??
        finiteCents(order.amount, { nonNegative: true });
      let clawback = b.tokens;
      if (refundedCents && refundedCents > 0 && b.priceCents > 0) {
        clawback = Math.min(b.tokens, Math.round((b.tokens * refundedCents) / b.priceCents));
      } else {
        console.warn(
          `[polar webhook] refund for order=${originalOrderId} has no usable amount; ` +
            `clawing back the full ${b.key} bundle (${b.tokens} tokens)`,
        );
      }
      if (clawback > 0) {
        await credit(userId, -clawback, "refund", `refund:${originalOrderId}`, { bundle: b.key });
      }
    } else {
      // An unresolvable refund (lost metadata.userId / unmapped product / no
      // original order id) silently left the original purchase credited but never
      // clawed back — the mirror of the bug the paid-path 500 was added to
      // prevent. Make it observable for reconciliation (this is a reversal, so
      // unlike the paid path we don't 500-to-retry; we surface it for an operator).
      console.error(
        `[polar webhook] refund NOT clawed back: userId=${userId ?? "<missing>"} ` +
          `bundle=${b?.key ?? "<unresolved>"} originalOrderId=${originalOrderId ?? "<none>"}`,
      );
    }
  }

  // Pattern 3: relay the settled order/refund to LightTrack as revenue (profit/margin). We already
  // verified the signature above, so no secret is shared with LightTrack — it trusts this project-keyed
  // relay. Best-effort: trackRevenue swallows its own errors, so Polar still gets its 200 regardless.
  const revenue = polarEventToRevenue(event);
  if (revenue) await trackRevenue(revenue);

  return new Response("ok", { status: 200 });
}
