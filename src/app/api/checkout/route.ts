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
  // Verify args against @polar-sh/sdk types for the installed version.
  const checkout = await polar().checkouts.create({
    products: [b.polarProductId],
    successUrl: `${origin}/billing?status=success`,
    customerEmail: user.email ?? undefined,
    // Echoed back on the order webhook so we credit the right user/bundle.
    metadata: { userId: user.id, bundle: b.key, tokens: String(b.tokens) },
  });

  return Response.json({ url: checkout.url });
}
