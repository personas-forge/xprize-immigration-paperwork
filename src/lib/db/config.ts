/**
 * Database driver selection — the single place that decides where persistence
 * lives. Imported on both client and server (it only reads env), so it must NOT
 * pull in firebase-admin or @electric-sql/pglite; those load lazily in getStore().
 *
 * Resolution order:
 *   1. explicit DB_DRIVER (firestore | pglite) wins
 *   2. NODE_ENV=production + a Firebase/GCP project configured → firestore (prod)
 *   3. dev-auth (local) → pglite (embedded Postgres, zero-infra)
 *   4. nothing → null (no store → token paywall free-passes, keyless behavior)
 */

import { isDevAuth } from "@/lib/auth/devAuth";

export type DbDriver = "firestore" | "pglite";

/**
 * Flat per-app collection prefix inside the shared Firestore database, e.g.
 * `${COLLECTION_PREFIX}_profiles`. One prefix per app (mirrors the old
 * `app_<name>` Postgres-schema convention). EDIT THIS when copying to a new app.
 */
export const COLLECTION_PREFIX = "immigration";

export function firestoreProjectId(): string | undefined {
  return (
    process.env.FIRESTORE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT
  );
}

export function dbDriver(): DbDriver | null {
  const explicit = process.env.DB_DRIVER?.trim().toLowerCase();
  if (explicit === "firestore" || explicit === "pglite") return explicit;
  if (process.env.NODE_ENV === "production" && firestoreProjectId()) {
    return "firestore";
  }
  if (isDevAuth()) return "pglite";
  return null;
}

/** True when SOME persistent store is configured (firestore or pglite). */
export function isStoreConfigured(): boolean {
  return dbDriver() !== null;
}

/** Local PGlite data directory (created on first use). */
export function pglitePath(): string {
  return process.env.PGLITE_PATH || "./.pglite";
}
