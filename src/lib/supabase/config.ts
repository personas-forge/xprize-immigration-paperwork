// Central auth configuration. Imported on both client and server, so it must
// NOT use `server-only` and must rely on NEXT_PUBLIC_* vars for anything the
// browser needs.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True only when the public Supabase env is present. Everything gates on this
 *  so the app builds & runs with no secrets (graceful degradation). */
export function isAuthConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/** This app's PRIVATE Postgres schema. Per-app constant — never user input. */
export const AUTH_SCHEMA = process.env.APP_AUTH_SCHEMA ?? "app_immigration";

/** Bump when consent copy changes; recorded against each consent row. */
export const CONSENT_VERSION =
  process.env.NEXT_PUBLIC_CONSENT_VERSION ?? "2026-05-29";
