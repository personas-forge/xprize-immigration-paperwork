import "server-only";

import { Pool } from "pg";
import { AUTH_SCHEMA } from "@/lib/supabase/config";

// Shared pg Pool for the application schema (cases / criteria / drafts).
//
// Same pattern as the auth and token ledgers: one Pool reused across hot
// reloads / serverless invocations, and a `null` return when DATABASE_URL is
// unset so every caller degrades gracefully to a no-DB path (the keyless build
// keeps working with no secret).

declare global {
  // `var` is required here — global augmentation can't use let/const.
  var __appPool: Pool | undefined;
}

export function appPool(): Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!global.__appPool) {
    global.__appPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
    });
  }
  return global.__appPool;
}

// AUTH_SCHEMA is a server-side constant (never user input). Sanitise anyway
// before interpolating it as a SQL identifier.
export const S = AUTH_SCHEMA.replace(/[^a-z0-9_]/gi, "");
