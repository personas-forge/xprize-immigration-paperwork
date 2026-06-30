import "server-only";

import { getUser } from "@/lib/auth/session";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { isDevAuth } from "@/lib/auth/devAuth";
import { isMeteringEnforced } from "@/lib/db/config";
import { charge, reclaim, FREE_PASS_BALANCE } from "./ledger";
import { costOf } from "./registry";

export type ChargeResult =
  | { ok: true; cost: number; balance: number; reclaim: () => Promise<unknown> }
  | { ok: false; reason: "unauthenticated" }
  | { ok: false; reason: "insufficient"; cost: number; balance: number };

const FREE_PASS: ChargeResult = {
  ok: true,
  cost: 0,
  balance: FREE_PASS_BALANCE,
  reclaim: async () => {},
};

/**
 * Call at the top of an AI route. Debits upfront (charge-then-reclaim), so a
 * caller who can't pay never reaches the model. On success returns a
 * `reclaim()` to call if the downstream operation throws.
 *
 * Graceful degradation: TOKENS_BYPASS=1 (dev), or no store / no auth provider
 * configured (keyless build/dev) → a free, unmetered pass so the mock paths keep
 * working with no paywall. Metering engages once a Store (Firestore/PGlite) and
 * an auth provider (Firebase / dev-auth) are both configured.
 */
export async function chargeForOperation(
  operation: string,
  requestId: string,
): Promise<ChargeResult> {
  // Canonical global switch: dev bypass (TOKENS_BYPASS=1) OR no store configured
  // → run AI paths unmetered. Single source of truth (isMeteringEnforced) shared
  // with the billing page so they can't disagree (e.g. Firestore prod, which has
  // no DATABASE_URL but IS metered).
  if (!isMeteringEnforced()) return FREE_PASS;

  // Even with metering on, we can only debit a caller we can identify; an
  // unidentifiable request (no auth provider) gets a keyless free pass.
  const canIdentify = isFirebaseConfigured() || isDevAuth();
  if (!canIdentify) return FREE_PASS;

  const user = await getUser();
  if (!user) return { ok: false, reason: "unauthenticated" };

  const cost = costOf(operation);
  const res = await charge(user.id, cost, operation, requestId);
  if (!res.ok) return { ok: false, reason: "insufficient", cost, balance: res.balance };

  return {
    ok: true,
    cost,
    balance: res.balance,
    // Scope the reclaim ref by user id: the ledger's idempotency index is the
    // GLOBAL (ref, reason), so a per-user ref keeps one user's reclaim from ever
    // deduping against another's.
    reclaim: () => reclaim(user.id, cost, `reclaim:${user.id}:${requestId}`, { operation }),
  };
}
