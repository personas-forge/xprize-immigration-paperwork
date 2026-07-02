// Server-only module — runtime guard (assertServerOnly) instead of the
// `server-only` package, which is unresolvable under the `tsx --test` runner.
// Same convention as `@/lib/auth/session`; it's what lets the charge matrix
// below be unit-tested at all.
import { assertServerOnly } from "@/lib/serverOnlyGuard";
assertServerOnly("@/lib/tokens/guard");

import { isFirebaseConfigured } from "@/lib/firebase/config";
import { isDevAuth, type AppUser } from "@/lib/auth/devAuth";
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

/** Injectable infra for the unit matrix — production callers omit it. The auth
 *  session is the one dep that must stay a LAZY import (its static graph pulls
 *  next/headers + firebase-admin); the ledger fns are unit-safe and double as
 *  the defaults. Mirrors the `AiOperationDeps` convention in `@/lib/ai/operation`. */
export interface GuardDeps {
  resolveUser: () => Promise<AppUser | null>;
  charge: typeof charge;
  reclaim: typeof reclaim;
}

let cachedDefaults: GuardDeps | null = null;
async function defaultDeps(): Promise<GuardDeps> {
  if (!cachedDefaults) {
    const { getUser } = await import("@/lib/auth/session");
    cachedDefaults = { resolveUser: getUser, charge, reclaim };
  }
  return cachedDefaults;
}

/**
 * Call at the top of an AI route. Debits upfront (charge-then-reclaim), so a
 * caller who can't pay never reaches the model. On success returns a
 * `reclaim()` to call if the downstream operation throws.
 *
 * Graceful degradation: TOKENS_BYPASS=1 (dev-only — hard-gated out of
 * production in isMeteringEnforced), or no store / no auth provider configured
 * (keyless build/dev) → a free, unmetered pass so the mock paths keep working
 * with no paywall. Metering engages once a Store (Firestore/PGlite) and an
 * auth provider (Firebase / dev-auth) are both configured.
 */
export async function chargeForOperation(
  operation: string,
  requestId: string,
  deps?: GuardDeps,
): Promise<ChargeResult> {
  // Canonical global switch: dev bypass (TOKENS_BYPASS=1, non-prod only) OR no
  // store configured → run AI paths unmetered. Single source of truth
  // (isMeteringEnforced) shared with the billing page so they can't disagree
  // (e.g. Firestore prod, which has no DATABASE_URL but IS metered).
  if (!isMeteringEnforced()) return FREE_PASS;

  // Even with metering on, we can only debit a caller we can identify; an
  // unidentifiable request (no auth provider) gets a keyless free pass.
  const canIdentify = isFirebaseConfigured() || isDevAuth();
  if (!canIdentify) return FREE_PASS;

  const d = deps ?? (await defaultDeps());
  const user = await d.resolveUser();
  if (!user) return { ok: false, reason: "unauthenticated" };

  const cost = costOf(operation);
  const res = await d.charge(user.id, cost, operation, requestId);
  if (!res.ok) return { ok: false, reason: "insufficient", cost, balance: res.balance };

  return {
    ok: true,
    cost,
    balance: res.balance,
    // Scope the reclaim ref by user id: the ledger's idempotency index is the
    // GLOBAL (ref, reason), so a per-user ref keeps one user's reclaim from ever
    // deduping against another's.
    reclaim: () => d.reclaim(user.id, cost, `reclaim:${user.id}:${requestId}`, { operation }),
  };
}
