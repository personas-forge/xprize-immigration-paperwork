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

type Env = Record<string, string | undefined>;

export function firestoreProjectId(env: Env = process.env): string | undefined {
  return (
    env.FIRESTORE_PROJECT_ID ||
    env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    env.GOOGLE_CLOUD_PROJECT
  );
}

export function dbDriver(env: Env = process.env): DbDriver | null {
  const explicit = env.DB_DRIVER?.trim().toLowerCase();
  if (explicit === "firestore" || explicit === "pglite") return explicit;
  if (env.NODE_ENV === "production" && firestoreProjectId(env)) {
    return "firestore";
  }
  if (isDevAuth(env)) return "pglite";
  return null;
}

/** True when SOME persistent store is configured (firestore or pglite). */
export function isStoreConfigured(env: Env = process.env): boolean {
  return dbDriver(env) !== null;
}

/**
 * The SINGLE source of truth for "is the token economy enforced right now?": a
 * store is configured AND the dev bypass is off. Every "should I charge / show a
 * real balance / free-pass" decision must use THIS — never an ad-hoc
 * `DATABASE_URL` read, which is a pglite-only signal and is WRONG for Firestore
 * prod (no `DATABASE_URL`, yet metering IS on). NOTE: this is the GLOBAL switch;
 * the charge guard additionally requires an identifiable user before it can
 * actually debit (an unidentifiable request free-passes regardless). `env` is
 * injectable for tests.
 */
export function isMeteringEnforced(env: Env = process.env): boolean {
  // TOKENS_BYPASS is a DEV convenience and is hard-gated out of production,
  // like NEXT_PUBLIC_DEV_AUTH: a bypass flag accidentally left set on a real
  // deployment must not turn the paid product free AND drop the auth gate the
  // charge guard provides (metering off ⇒ AI routes run for anonymous callers).
  const bypassed = env.TOKENS_BYPASS === "1" && env.NODE_ENV !== "production";
  return !bypassed && isStoreConfigured(env);
}

/** Local PGlite data directory (created on first use). */
export function pglitePath(): string {
  return process.env.PGLITE_PATH || "./.pglite";
}
