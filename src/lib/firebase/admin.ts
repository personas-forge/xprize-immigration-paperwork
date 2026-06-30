// Server-only. Firebase Admin SDK — verifies ID tokens, mints/verifies session
// cookies. Credentials come from Application Default Credentials, i.e. the
// GOOGLE_APPLICATION_CREDENTIALS service-account key locally, or the Cloud Run
// runtime service account in deployment. Never import on the client.
import { assertServerOnly } from "@/lib/serverOnlyGuard";
assertServerOnly("@/lib/firebase/admin");

import { getAuth, type Auth } from "firebase-admin/auth";
import { ensureAdminApp } from "./adminApp";

export function adminAuth(): Auth {
  ensureAdminApp();
  return getAuth();
}
