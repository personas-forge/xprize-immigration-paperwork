/**
 * POST/DELETE /api/auth/session  ·  Node runtime  ·  Firebase auth (Path B)
 *
 * The login page signs in with Google via the Firebase client SDK, obtains an
 * ID token, and POSTs it here. We verify it and mint a long-lived, httpOnly
 * SESSION COOKIE (createSessionCookie) — the server-side session the rest of the
 * app reads via getUser(). DELETE clears it (sign-out).
 *
 * Requires the Admin SDK credentials (GOOGLE_APPLICATION_CREDENTIALS locally).
 */

import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";
import {
  SESSION_COOKIE,
  SESSION_EXPIRES_MS,
  isFirebaseConfigured,
} from "@/lib/firebase/config";
import { revokeAndClearSession } from "@/lib/auth/session-cookie";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (!isFirebaseConfigured()) {
    return Response.json({ error: "firebase_not_configured" }, { status: 503 });
  }

  let idToken: unknown;
  try {
    ({ idToken } = (await request.json()) as { idToken?: unknown });
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof idToken !== "string" || !idToken) {
    return Response.json({ error: "missing_id_token" }, { status: 400 });
  }

  try {
    const auth = adminAuth();
    // Reject stale/forged tokens before minting a 5-day cookie from them.
    await auth.verifyIdToken(idToken, true);
    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRES_MS,
    });
    const jar = await cookies();
    jar.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(SESSION_EXPIRES_MS / 1000),
    });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("auth/session: failed to mint session cookie.", err);
    return Response.json({ error: "invalid_token" }, { status: 401 });
  }
}

export async function DELETE(): Promise<Response> {
  // Revoke server-side so a copied/stolen session cookie can't outlive sign-out
  // (getUser verifies with checkRevoked=true), then clear locally — the same
  // sequence POST /auth/signout uses, via the one shared helper.
  await revokeAndClearSession();
  return Response.json({ ok: true });
}
