/**
 * Loosened local auth (Direction: local dev wiring).
 *
 * When `NEXT_PUBLIC_DEV_AUTH=1` *and* we are not in production, the app skips
 * Firebase/Google entirely and acts as a fixed synthetic "developer" user. This
 * lets you exercise every auth-gated flow (consent, the free grant, metered AI,
 * the paywall) against a local PGlite database with zero cloud setup.
 *
 * SAFETY: hard-gated to `NODE_ENV !== "production"`, so this can never weaken
 * auth in a real deployment even if the flag is accidentally left set. The flag
 * is `NEXT_PUBLIC_` so the login page can read it client-side; that's fine — it
 * is dev-only and inert in production.
 *
 * Pure + client-safe (no server-only imports).
 */

/** The minimal user shape every consumer actually reads. */
export interface AppUser {
  id: string;
  email: string | null;
  user_metadata?: {
    avatar_url?: string | null;
    full_name?: string | null;
    /** Google profiles carry `name`; used as a consent-form default. */
    name?: string | null;
  };
}

/** True only outside production with the dev flag set. */
export function isDevAuth(): boolean {
  return (
    process.env.NEXT_PUBLIC_DEV_AUTH === "1" &&
    process.env.NODE_ENV !== "production"
  );
}

/** The synthetic developer identity used in dev-auth mode. */
export const DEV_USER: AppUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "developer@localhost",
  user_metadata: { full_name: "Developer", avatar_url: null },
};
