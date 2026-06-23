import "server-only";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE } from "@/lib/firebase/config";

/**
 * Revoke the server-side session, then clear the local cookie.
 *
 * A Firebase session cookie is a BEARER credential — deleting only the local
 * cookie leaves any copied/stolen cookie valid for the full session lifetime.
 * Revoke the user's refresh tokens so getUser()'s `checkRevoked=true` rejects
 * every copy immediately, THEN clear the local cookie. Best-effort: an
 * invalid/expired cookie or an admin outage must still clear the browser cookie.
 *
 * This is the ONE definition both sign-out paths call — POST /auth/signout and
 * DELETE /api/auth/session — so a future hardening change can't land on only one.
 */
export async function revokeAndClearSession(): Promise<void> {
  const jar = await cookies();
  const cookie = jar.get(SESSION_COOKIE)?.value;
  if (cookie) {
    try {
      const decoded = await adminAuth().verifySessionCookie(cookie);
      await adminAuth().revokeRefreshTokens(decoded.uid);
    } catch (err) {
      console.error("[auth] could not revoke session tokens", err);
    }
  }
  jar.delete(SESSION_COOKIE);
}
