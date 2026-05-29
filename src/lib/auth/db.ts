import "server-only";

import { Pool } from "pg";
import { AUTH_SCHEMA } from "@/lib/supabase/config";

// Reuse one Pool across hot reloads / invocations.
declare global {
  var __authPool: Pool | undefined;
}

function pool(): Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!global.__authPool) {
    global.__authPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
    });
  }
  return global.__authPool;
}

// AUTH_SCHEMA is a server-side constant (never user input). Sanitise anyway
// before interpolating it as an identifier.
const S = AUTH_SCHEMA.replace(/[^a-z0-9_]/gi, "");

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  onboarded_at: string | null;
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const p = pool();
  if (!p) return null;
  const r = await p.query<Profile>(
    `select id, email, full_name, avatar_url, onboarded_at
       from ${S}.profiles where id = $1`,
    [userId],
  );
  return r.rows[0] ?? null;
}

export async function upsertProfileWithConsent(input: {
  userId: string;
  email: string | null;
  fullName: string;
  avatarUrl: string | null;
  consentVersion: string;
  terms: boolean;
  privacy: boolean;
  marketing: boolean;
  ip: string | null;
  userAgent: string | null;
}): Promise<void> {
  const p = pool();
  if (!p) throw new Error("DATABASE_URL not configured");
  const c = await p.connect();
  try {
    await c.query("begin");
    await c.query(
      `insert into ${S}.profiles (id, email, full_name, avatar_url, onboarded_at)
         values ($1, $2, $3, $4, now())
       on conflict (id) do update set
         email = excluded.email,
         full_name = excluded.full_name,
         avatar_url = excluded.avatar_url,
         onboarded_at = coalesce(${S}.profiles.onboarded_at, now()),
         updated_at = now()`,
      [input.userId, input.email, input.fullName, input.avatarUrl],
    );
    await c.query(
      `insert into ${S}.consents
         (user_id, consent_version, terms_accepted, privacy_accepted,
          marketing_opt_in, ip, user_agent)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        input.userId,
        input.consentVersion,
        input.terms,
        input.privacy,
        input.marketing,
        input.ip,
        input.userAgent,
      ],
    );
    await c.query("commit");
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}
