// Server-only. Firebase Admin SDK — verifies ID tokens, mints/verifies session
// cookies. Credentials come from Application Default Credentials, i.e. the
// GOOGLE_APPLICATION_CREDENTIALS service-account key locally, or the Cloud Run
// runtime service account in deployment. Never import on the client.
if (typeof window !== "undefined") {
  throw new Error("@/lib/firebase/admin must not be imported on the client.");
}

import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

export function adminAuth(): Auth {
  if (!getApps().length) {
    initializeApp({
      credential: applicationDefault(),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }
  return getAuth();
}
