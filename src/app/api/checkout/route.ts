import { type NextRequest } from "next/server";
import { getUser } from "@/lib/auth/session";
import { isPolarConfigured, polar } from "@/lib/polar/client";
import { bundleByKey } from "@/lib/tokens/economy";

// Creates a Polar checkout for a token bundle and returns its URL.
export async function POST(request: NextRequest) {
  if (!isPolarConfigured()) {
    return Response.json({ error: "billing_not_configured" }, { status: 503 });
  }
  const user = await getUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const { bundle } = await request.json().catch(() => ({}));
  const b = bundle ? bundleByKey(String(bundle)) : undefined;
  if (!b?.polarProductId) {
    return Response.json({ error: "unknown_bundle" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  // Verify args against @polar-sh/sdk types for the installed version. A Polar
  // hiccup (rate limit, timeout, 4xx) must become a structured error the UI can
  // act on — not an unhandled rejection surfacing as a bare 500.
  let checkout: { url: string };
  try {
    checkout = await polar().checkouts.create({
      products: [b.polarProductId],
      successUrl: `${origin}/billing?status=success`,
      customerEmail: user.email ?? undefined,
      // Tie the Polar customer to our user id. UNLIKE per-order `metadata`, the
      // customer external id propagates to every SUBSCRIPTION CYCLE order, so a
      // monthly renewal can still be credited even when cycle-order metadata is
      // absent (the webhook falls back to this — see the renewal-userId fix).
      externalCustomerId: user.id,
      // Echoed back on the order webhook so we credit the right user/bundle.
      // Only userId + bundle are read; the webhook re-derives the credited
      // amount from the SERVER-side Bundle.tokens (never from echoed metadata),
      // so no `tokens` field rides here — Bundle.tokens stays the single source.
      metadata: { userId: user.id, bundle: b.key },
    });
  } catch (cause) {
    console.error("[checkout] polar checkout creation failed", cause);
    return Response.json({ error: "checkout_failed" }, { status: 502 });
  }

  return Response.json({ url: checkout.url });
}
