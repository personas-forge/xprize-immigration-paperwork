import "server-only";

import { Pool } from "pg";
import { AUTH_SCHEMA } from "@/lib/supabase/config";

// Reuse one Pool across hot reloads / invocations.
declare global {
  // `var` is required here — global augmentation can't use let/const.
  var __tokenPool: Pool | undefined;
}
function pool(): Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!global.__tokenPool) {
    global.__tokenPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
    });
  }
  return global.__tokenPool;
}

const S = AUTH_SCHEMA.replace(/[^a-z0-9_]/gi, "");

export async function getBalance(userId: string): Promise<number> {
  const p = pool();
  if (!p) return 0;
  const r = await p.query<{ balance: number }>(
    `select balance from ${S}.token_accounts where user_id = $1`,
    [userId],
  );
  return r.rows[0]?.balance ?? 0;
}

export type ChargeOutcome = { ok: boolean; balance: number };

/** Atomic debit. Locks the balance row; refuses (ok:false) if insufficient. */
export async function charge(
  userId: string,
  cost: number,
  operation: string,
  ref: string,
): Promise<ChargeOutcome> {
  const p = pool();
  if (!p) return { ok: true, balance: Number.POSITIVE_INFINITY }; // unconfigured → free pass
  const c = await p.connect();
  try {
    await c.query("begin");
    await c.query(
      `insert into ${S}.token_accounts(user_id, balance) values ($1, 0)
       on conflict (user_id) do nothing`,
      [userId],
    );
    const cur = await c.query<{ balance: number }>(
      `select balance from ${S}.token_accounts where user_id = $1 for update`,
      [userId],
    );
    const balance = cur.rows[0]?.balance ?? 0;
    if (balance < cost) {
      await c.query("rollback");
      return { ok: false, balance };
    }
    const next = balance - cost;
    await c.query(
      `update ${S}.token_accounts set balance = $2, updated_at = now() where user_id = $1`,
      [userId, next],
    );
    await c.query(
      `insert into ${S}.token_ledger(user_id, delta, reason, operation, ref, balance_after)
       values ($1, $2, 'debit', $3, $4, $5)`,
      [userId, -cost, operation, ref, next],
    );
    await c.query("commit");
    return { ok: true, balance: next };
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}

/** Idempotent credit (purchase / reclaim / refund / adjustment). No-op if `ref`
 *  already recorded for this reason. Use for money + reversals. */
export async function credit(
  userId: string,
  amount: number,
  reason: "purchase" | "reclaim" | "refund" | "adjustment" | "enterprise_grant",
  ref: string | null,
  metadata: Record<string, unknown> = {},
): Promise<number> {
  const p = pool();
  if (!p) return 0;
  const c = await p.connect();
  try {
    await c.query("begin");
    await c.query(
      `insert into ${S}.token_accounts(user_id, balance) values ($1, 0)
       on conflict (user_id) do nothing`,
      [userId],
    );
    const cur = await c.query<{ balance: number }>(
      `select balance from ${S}.token_accounts where user_id = $1 for update`,
      [userId],
    );
    if (ref) {
      const seen = await c.query(
        `select 1 from ${S}.token_ledger where ref = $1 and reason = $2 limit 1`,
        [ref, reason],
      );
      if (seen.rowCount) {
        await c.query("commit");
        return cur.rows[0]?.balance ?? 0; // already applied
      }
    }
    const next = (cur.rows[0]?.balance ?? 0) + amount;
    await c.query(
      `update ${S}.token_accounts set balance = $2, updated_at = now() where user_id = $1`,
      [userId, next],
    );
    await c.query(
      `insert into ${S}.token_ledger(user_id, delta, reason, ref, balance_after, metadata)
       values ($1, $2, $3, $4, $5, $6)`,
      [userId, amount, reason, ref, next, JSON.stringify(metadata)],
    );
    await c.query("commit");
    return next;
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
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

/** Grant the one-time signup bonus. Idempotent per user (signup_grant unique). */
export async function grantSignupTokens(
  userId: string,
  amount: number,
): Promise<void> {
  const p = pool();
  if (!p) return;
  const c = await p.connect();
  try {
    await c.query("begin");
    await c.query(
      `insert into ${S}.token_accounts(user_id, balance) values ($1, 0)
       on conflict (user_id) do nothing`,
      [userId],
    );
    const cur = await c.query<{ balance: number }>(
      `select balance from ${S}.token_accounts where user_id = $1 for update`,
      [userId],
    );
    const seen = await c.query(
      `select 1 from ${S}.token_ledger where user_id = $1 and reason = 'signup_grant' limit 1`,
      [userId],
    );
    if (seen.rowCount) {
      await c.query("commit");
      return; // already granted
    }
    const next = (cur.rows[0]?.balance ?? 0) + amount;
    await c.query(
      `update ${S}.token_accounts set balance = $2, updated_at = now() where user_id = $1`,
      [userId, next],
    );
    await c.query(
      `insert into ${S}.token_ledger(user_id, delta, reason, balance_after)
       values ($1, $2, 'signup_grant', $3)`,
      [userId, amount, next],
    );
    await c.query("commit");
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}
