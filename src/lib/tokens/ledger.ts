// Server-only delegator over the active Store (Firestore or PGlite — see
// @/lib/db/store). Stable import surface for the token economy: guard.ts,
// balance.ts, the Polar webhook, welcome/actions.ts, and the dev grant route
// all import from here regardless of the backing driver.
if (typeof window !== "undefined") {
  throw new Error("@/lib/tokens/ledger must not be imported on the client.");
}

import { getStore, type ChargeOutcome, type CreditReason } from "@/lib/db/store";

export type { ChargeOutcome };

export async function getBalance(userId: string): Promise<number> {
  const store = await getStore();
  return store ? store.getBalance(userId) : 0;
}

/** Atomic debit. Refuses (ok:false) if insufficient. Free pass if no store. */
export async function charge(
  userId: string,
  cost: number,
  operation: string,
  ref: string,
): Promise<ChargeOutcome> {
  const store = await getStore();
  if (!store) return { ok: true, balance: Number.POSITIVE_INFINITY };
  return store.charge(userId, cost, operation, ref);
}

/** Idempotent credit (purchase / reclaim / refund / adjustment / grant). */
export async function credit(
  userId: string,
  amount: number,
  reason: CreditReason,
  ref: string | null,
  metadata: Record<string, unknown> = {},
): Promise<number> {
  const store = await getStore();
  return store ? store.credit(userId, amount, reason, ref, metadata) : 0;
}

/** Return tokens after a failed operation (idempotent by ref). */
export function reclaim(
  userId: string,
  amount: number,
  ref: string,
  metadata: Record<string, unknown> = {},
): Promise<number> {
  return credit(userId, amount, "reclaim", ref, metadata);
}

/** Grant the one-time signup bonus. Idempotent per user. */
export async function grantSignupTokens(
  userId: string,
  amount: number,
): Promise<void> {
  const store = await getStore();
  if (!store) return;
  return store.grantSignupTokens(userId, amount);
}
