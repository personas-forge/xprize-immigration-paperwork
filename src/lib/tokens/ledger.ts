// Server-only delegator over the active Store (Firestore or PGlite — see
// @/lib/db/store). Stable import surface for the token economy: guard.ts,
// balance.ts, the Polar webhook, welcome/actions.ts, and the dev grant route
// all import from here regardless of the backing driver.
if (typeof window !== "undefined") {
  throw new Error("@/lib/tokens/ledger must not be imported on the client.");
}

import { getStore, type ChargeOutcome, type CreditReason, type LedgerEntry } from "@/lib/db/store";
import { isStoreConfigured } from "@/lib/db/config";

export type { ChargeOutcome, LedgerEntry };

/** The no-store free-pass below is correct for the genuinely keyless/dev build,
 *  but if a store is CONFIGURED (prod) yet `getStore()` resolved null (admin-init
 *  flap / transient outage), metering silently opens for EVERYONE — a revenue
 *  leak that's invisible until someone audits the ledger. Make it observable. */
function warnIfMeteringExpected(where: string): void {
  if (isStoreConfigured()) {
    console.error(
      `[tokens] metering unavailable in ${where}: a store is configured but getStore() returned null — operations are running UNMETERED (free pass).`,
    );
  }
}

// Money-kernel boundary guards. The ledger is the one chokepoint every metered
// op, purchase, refund, reclaim and grant funnels through, so validating the
// amount HERE makes the kernel self-defending: a mis-signed or non-finite value
// from any present-or-future caller (a computed refund, a webhook trusting a
// Polar quantity, a metered-by-usage op) is rejected before it can invert a
// debit into a credit or overflow a balance. 1,000,000 is well above the
// largest bundle (30k) and matches the dev-route clamp, far under pg int max.
const MAX_LEDGER_AMOUNT = 1_000_000;

/** A debit cost must be a non-negative bounded integer — a NEGATIVE cost would
 *  turn `charge` into a silent credit. */
function assertChargeCost(cost: number): void {
  if (!Number.isInteger(cost) || cost < 0 || cost > MAX_LEDGER_AMOUNT) {
    throw new Error(
      `[ledger] charge cost must be an integer in [0, ${MAX_LEDGER_AMOUNT}]; got ${cost}`,
    );
  }
}

/** A credit amount may be negative (refund clawback) but must be a bounded
 *  finite integer — never NaN/Infinity, never magnitude-unbounded. */
function assertCreditAmount(amount: number): void {
  if (!Number.isInteger(amount) || Math.abs(amount) > MAX_LEDGER_AMOUNT) {
    throw new Error(
      `[ledger] credit amount must be an integer in [-${MAX_LEDGER_AMOUNT}, ${MAX_LEDGER_AMOUNT}]; got ${amount}`,
    );
  }
}

export async function getBalance(userId: string): Promise<number> {
  const store = await getStore();
  return store ? store.getBalance(userId) : 0;
}

/** A user's recent token-ledger entries, newest first. Empty when no store. */
export async function getLedgerForUser(
  userId: string,
  limit = 25,
): Promise<LedgerEntry[]> {
  const store = await getStore();
  return store ? store.getLedgerForUser(userId, limit) : [];
}

/** Atomic debit. Refuses (ok:false) if insufficient. Free pass if no store. */
export async function charge(
  userId: string,
  cost: number,
  operation: string,
  ref: string,
): Promise<ChargeOutcome> {
  assertChargeCost(cost);
  const store = await getStore();
  if (!store) {
    warnIfMeteringExpected("charge");
    return { ok: true, balance: Number.POSITIVE_INFINITY };
  }
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
  assertCreditAmount(amount);
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
  assertChargeCost(amount); // a grant is a non-negative bounded integer
  const store = await getStore();
  if (!store) return;
  return store.grantSignupTokens(userId, amount);
}
