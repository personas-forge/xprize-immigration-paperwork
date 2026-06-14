// Server-only. The single guarded firebase-admin app initializer, shared by the
// Auth handle (@/lib/firebase/admin) and the Firestore handle
// (@/lib/firestore/admin) so the initializeApp call + credential resolution live
// in exactly one place. Never import on the client.
if (typeof window !== "undefined") {
  throw new Error("@/lib/firebase/adminApp must not be imported on the client.");
}

import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";

/**
 * Ensure the default firebase-admin app exists (idempotent — a no-op once
 * initialized, so Auth and Firestore share one app). Credentials come from
 * Application Default Credentials: GOOGLE_APPLICATION_CREDENTIALS locally, or the
 * Cloud Run runtime service account in deployment. Do NOT change this resolution.
 */
export function ensureAdminApp(): void {
  if (!getApps().length) {
    initializeApp({
      credential: applicationDefault(),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }
}
