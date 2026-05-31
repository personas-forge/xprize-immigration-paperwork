/**
 * Firebase client SDK (browser). Only imported by client components. The app is
 * initialized lazily inside `firebaseAuth()` so nothing runs during SSR import.
 */

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { FIREBASE_CONFIG } from "./config";

export function firebaseAuth(): Auth {
  const app = getApps().length
    ? getApp()
    : initializeApp({
        apiKey: FIREBASE_CONFIG.apiKey,
        authDomain: FIREBASE_CONFIG.authDomain,
        projectId: FIREBASE_CONFIG.projectId,
      });
  return getAuth(app);
}

/** Google sign-in provider (request basic profile + email). */
export function googleProvider(): GoogleAuthProvider {
  const p = new GoogleAuthProvider();
  p.addScope("email");
  p.addScope("profile");
  return p;
}
