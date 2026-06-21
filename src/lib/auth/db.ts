// Server-only delegator over the active Store (Firestore or PGlite — see
// @/lib/db/store). Kept as a stable import surface: session.ts and
// welcome/actions.ts import `getProfile` / `upsertProfileWithConsent` / `Profile`
// from here and don't care which driver backs them.
if (typeof window !== "undefined") {
  throw new Error("@/lib/auth/db must not be imported on the client.");
}

import {
  getStore,
  type ConsentExport,
  type Profile,
  type RecordConsentInput,
  type UpsertConsentInput,
  type UserDataExport,
} from "@/lib/db/store";

export type { ConsentExport, Profile, RecordConsentInput, UserDataExport };

export async function getProfile(userId: string): Promise<Profile | null> {
  const store = await getStore();
  return store ? store.getProfile(userId) : null;
}

/** The user's most recently recorded consent version, or null. */
export async function getLatestConsentVersion(
  userId: string,
): Promise<string | null> {
  const store = await getStore();
  return store ? store.getLatestConsentVersion(userId) : null;
}

/** The user's full append-only consent history (newest first). Empty when no store. */
export async function getConsentHistory(userId: string): Promise<ConsentExport[]> {
  const store = await getStore();
  return store ? store.getConsentHistory(userId) : [];
}

/** Append a consent/preference row (e.g. a marketing opt-in change). Throws when
 *  no store is configured (a silently-dropped preference change is worse than an
 *  error on a compliance surface). */
export async function recordConsent(input: RecordConsentInput): Promise<void> {
  const store = await getStore();
  if (!store) {
    throw new Error("No database configured — cannot record the preference change.");
  }
  return store.recordConsent(input);
}

export async function upsertProfileWithConsent(
  input: UpsertConsentInput,
): Promise<void> {
  const store = await getStore();
  if (!store) {
    throw new Error(
      "No database configured (set DB_DRIVER=firestore with a GCP project, or enable local PGlite via NEXT_PUBLIC_DEV_AUTH=1 / DB_DRIVER=pglite).",
    );
  }
  return store.upsertProfileWithConsent(input);
}

/** The complete bundle of a user's data, for "download my data" (GDPR/CCPA).
 *  Returns an empty bundle when no store is configured. */
export async function exportUserData(userId: string): Promise<UserDataExport> {
  const store = await getStore();
  if (!store) {
    return {
      userId,
      profile: null,
      consents: [],
      tokenBalance: 0,
      tokenLedger: [],
      cases: [],
    };
  }
  return store.exportUserData(userId);
}

/** PERMANENTLY delete every record keyed to this user. Irreversible. No-op when
 *  no store is configured. The caller must remove the auth account separately. */
export async function deleteUserData(userId: string): Promise<void> {
  const store = await getStore();
  if (!store) return;
  return store.deleteUserData(userId);
}
