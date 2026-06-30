/**
 * Auth-provider selector. Decides which cloud auth backend is active so the
 * login page, middleware, and `getUser()` all agree. Reads env only — safe on
 * client and edge (no `firebase-admin`, no `pg`).
 *
 * This app is Firebase-only: it returns "firebase" when Firebase is configured,
 * otherwise null. Dev-auth is handled separately (it short-circuits in
 * `getUser()` before this runs).
 */

import { isFirebaseConfigured } from "@/lib/firebase/config";

export type AuthProvider = "firebase";

export function authProvider(): AuthProvider | null {
  return isFirebaseConfigured() ? "firebase" : null;
}
