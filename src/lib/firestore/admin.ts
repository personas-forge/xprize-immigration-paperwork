// Server-only. Firestore Admin SDK handle — shares the default firebase-admin
// app with @/lib/firebase/admin (auth). Credentials come from Application
// Default Credentials: the GOOGLE_APPLICATION_CREDENTIALS service-account key
// locally, or the Cloud Run runtime service account in deployment. The Admin
// SDK bypasses security rules, so all collections stay locked to clients.
if (typeof window !== "undefined") {
  throw new Error("@/lib/firestore/admin must not be imported on the client.");
}

import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

export function adminDb(): Firestore {
  if (!getApps().length) {
    initializeApp({
      credential: applicationDefault(),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }
  return getFirestore();
}
