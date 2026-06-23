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
// largest bundle (30k), far under pg int max. Exported so other callers that
// must honor the same ceiling (e.g. the dev grant route) import it rather than
// retyping the literal.
export const MAX_LEDGER_AMOUNT = 1_000_000;

/** Free-pass balance sentinel: an unmetered (keyless/dev) success reports an
 *  infinite balance. Exported so the guard and the ledger encode "unmetered
 *  success" ONE way instead of each open-coding `Number.POSITIVE_INFINITY`. */
export const FREE_PASS_BALANCE = Number.POSITIVE_INFINITY;

/** Assert `value` is a bounded integer. `allowNegative` permits the refund-
 *  clawback range [-MAX, MAX]; otherwise (a charge/grant) it must be in [0, MAX]
 *  — a negative would turn `charge` into a silent credit. One validator so the
 *  integer check, the magnitude check, and the bound share a single definition. */
function assertBoundedInt(
  value: number,
  opts: { allowNegative: boolean; what: string },
): void {
  const belowFloor = opts.allowNegative ? value < -MAX_LEDGER_AMOUNT : value < 0;
  if (!Number.isInteger(value) || belowFloor || value > MAX_LEDGER_AMOUNT) {
    const lo = opts.allowNegative ? -MAX_LEDGER_AMOUNT : 0;
    throw new Error(
      `[ledger] ${opts.what} must be an integer in [${lo}, ${MAX_LEDGER_AMOUNT}]; got ${value}`,
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
  assertBoundedInt(cost, { allowNegative: false, what: "charge cost" });
  const store = await getStore();
  if (!store) {
    warnIfMeteringExpected("charge");
    return { ok: true, balance: FREE_PASS_BALANCE };
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
  assertBoundedInt(amount, { allowNegative: true, what: "credit amount" });
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
  assertBoundedInt(amount, { allowNegative: false, what: "grant amount" });
  const store = await getStore();
  if (!store) return;
  return store.grantSignupTokens(userId, amount);
}
