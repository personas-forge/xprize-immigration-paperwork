/**
 * Firebase / Identity Platform client config — Path B (GCP-native auth).
 *
 * Read on both client and server, so only NEXT_PUBLIC_* values live here. The
 * web API key is NOT a secret (it identifies the project to Google's auth
 * endpoints; access is governed by the enabled providers + authorized domains),
 * so shipping it to the browser is expected.
 */

export const FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
} as const;

/** True only when the Firebase web config is present. */
export function isFirebaseConfigured(): boolean {
  return Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
}

/**
 * Name of the httpOnly session cookie minted from a verified ID token. In
 * production it carries the `__Host-` prefix, which the browser enforces as
 * Secure + path=/ + no Domain — making it host-bound so a sibling subdomain
 * can't overwrite it. Dev keeps the unprefixed name because `__Host-` also
 * requires Secure, which the cookie is NOT over http://localhost (see the
 * session route's `secure: NODE_ENV === 'production'`).
 */
export const SESSION_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-session" : "__session";

/** Session cookie lifetime (5 days), in milliseconds. */
export const SESSION_EXPIRES_MS = 1000 * 60 * 60 * 24 * 5;
