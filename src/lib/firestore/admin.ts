// Server-only. Firestore Admin SDK handle — shares the default firebase-admin
// app with @/lib/firebase/admin (auth). Credentials come from Application
// Default Credentials: the GOOGLE_APPLICATION_CREDENTIALS service-account key
// locally, or the Cloud Run runtime service account in deployment. The Admin
// SDK bypasses security rules, so all collections stay locked to clients.
import { assertServerOnly } from "@/lib/serverOnlyGuard";
assertServerOnly("@/lib/firestore/admin");

import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { ensureAdminApp } from "@/lib/firebase/adminApp";

export function adminDb(): Firestore {
  ensureAdminApp();
  return getFirestore();
}
