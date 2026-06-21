// Server-only delegator over the active Store (Firestore or PGlite — see
// @/lib/db/store). Kept as a stable import surface: session.ts and
// welcome/actions.ts import `getProfile` / `upsertProfileWithConsent` / `Profile`
// from here and don't care which driver backs them.
if (typeof window !== "undefined") {
  throw new Error("@/lib/auth/db must not be imported on the client.");
}

import {
  getStore,
  type Profile,
  type UpsertConsentInput,
} from "@/lib/db/store";

export type { Profile };

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
