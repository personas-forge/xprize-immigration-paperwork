import { type NextRequest } from "next/server";
import { getUser } from "@/lib/auth/session";
import { credit } from "@/lib/tokens/ledger";
import { firestoreProjectId } from "@/lib/db/config";

// DEV/TEST ONLY — simulate a top-up without Polar, so the ledger/economy can be
// mass-tested offline. Hard-disabled on any real deployment: NODE_ENV=production
// OR a Firebase/GCP project configured (the repo's prod signal — covers a
// staging/preview deploy whose NODE_ENV isn't "production"), and unless
// TOKENS_BYPASS=1. Without the Firestore guard, a hosted preview with
// TOKENS_BYPASS=1 could mint free tokens.
export async function POST(request: NextRequest) {
  if (
    process.env.NODE_ENV === "production" ||
    firestoreProjectId() ||
    process.env.TOKENS_BYPASS !== "1"
  ) {
    return new Response("not found", { status: 404 });
  }
  const user = await getUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const { amount } = await request.json().catch(() => ({}));
  // `Number(amount) || 1000` treated an explicit 0 (and "", false, null) as the
  // 1000 default — a probe of "grant 0" silently minted 1000. Use a finiteness
  // check (and truncate) so only a genuinely absent/unparseable amount defaults.
  const raw = Number(amount);
  const n = Number.isFinite(raw) ? Math.max(1, Math.min(1_000_000, Math.trunc(raw))) : 1000;
  const balance = await credit(user.id, n, "adjustment", `dev:${Date.now()}:${user.id}`, {
    dev: true,
    requested: amount ?? null, // audit the requested-vs-granted amount
  });
  return Response.json({ ok: true, granted: n, balance });
}
