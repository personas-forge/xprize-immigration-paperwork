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

/** Name of the httpOnly session cookie minted from a verified ID token. */
export const SESSION_COOKIE = "__session";

/** Session cookie lifetime (5 days), in milliseconds. */
export const SESSION_EXPIRES_MS = 1000 * 60 * 60 * 24 * 5;
