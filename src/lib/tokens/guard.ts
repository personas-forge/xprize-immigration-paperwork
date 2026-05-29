import "server-only";

import { getUser } from "@/lib/auth/session";
import { isAuthConfigured } from "@/lib/supabase/config";
import { charge, reclaim } from "./ledger";
import { costOf, isMeteringBypassed } from "./economy";

export type ChargeResult =
  | { ok: true; cost: number; balance: number; reclaim: () => Promise<unknown> }
  | { ok: false; reason: "unauthenticated" }
  | { ok: false; reason: "insufficient"; cost: number; balance: number };

/**
 * Call at the top of an AI route. Debits upfront (charge-then-reclaim), so a
 * caller who can't pay never reaches the model. On success returns a
 * `reclaim()` to call if the downstream operation throws.
 *
 * Graceful degradation: if auth/DB isn't configured (keyless build/dev), this
 * returns a free pass so the mock paths keep working with no paywall.
 */
export async function chargeForOperation(
  operation: string,
  requestId: string,
): Promise<ChargeResult> {
  // Dev/test bypass — run AI paths unmetered (no balance required, no debit).
  // Set TOKENS_BYPASS=1 in .env.local for mass LLM testing without Polar.
  // Unconfigured auth/DB also falls through to a free pass (keyless builds/dev).
  if (isMeteringBypassed() || !isAuthConfigured()) {
    return { ok: true, cost: 0, balance: Number.POSITIVE_INFINITY, reclaim: async () => {} };
  }

  const user = await getUser();
  if (!user) return { ok: false, reason: "unauthenticated" };

  const cost = costOf(operation);
  const res = await charge(user.id, cost, operation, requestId);
  if (!res.ok) return { ok: false, reason: "insufficient", cost, balance: res.balance };

  return {
    ok: true,
    cost,
    balance: res.balance,
    reclaim: () => reclaim(user.id, cost, `reclaim:${requestId}`, { operation }),
  };
}

/** Standard 402 body for the paywall UI to consume. */
export function insufficientResponse(cost: number, balance: number): Response {
  return Response.json(
    { error: "insufficient_tokens", cost, balance },
    { status: 402 },
  );
}
