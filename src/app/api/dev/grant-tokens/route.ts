import { type NextRequest } from "next/server";
import { getUser } from "@/lib/auth/session";
import { credit } from "@/lib/tokens/ledger";

// DEV/TEST ONLY — simulate a top-up without Polar, so the ledger/economy can be
// mass-tested offline. Hard-disabled in production and unless TOKENS_BYPASS=1.
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production" || process.env.TOKENS_BYPASS !== "1") {
    return new Response("not found", { status: 404 });
  }
  const user = await getUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const { amount } = await request.json().catch(() => ({}));
  const n = Math.max(1, Math.min(1_000_000, Number(amount) || 1000));
  const balance = await credit(user.id, n, "adjustment", `dev:${Date.now()}:${user.id}`, {
    dev: true,
  });
  return Response.json({ ok: true, granted: n, balance });
}
