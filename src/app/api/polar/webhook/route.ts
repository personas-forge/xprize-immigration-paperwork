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

  // Polar emits order.paid / order.created for completed one-time purchases.
  // Confirm the exact event name in the Polar sandbox.
  if (event.type === "order.paid" || event.type === "order.created") {
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
    }
  }

  // Refund/chargeback reversal (optional clawback). Confirm event name.
  if (event.type === "refund.created" || event.type === "order.refunded") {
    const order = event.data as { id: string; metadata?: Record<string, string> };
    const userId = order.metadata?.userId;
    const b = order.metadata?.bundle ? bundleByKey(order.metadata.bundle) : undefined;
    if (userId && b) {
      await credit(userId, -b.tokens, "refund", `refund:${order.id}`, { bundle: b.key });
    }
  }

  return new Response("ok", { status: 200 });
}
