import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE } from "@/lib/firebase/config";

// Node runtime — firebase-admin (revokeRefreshTokens) is not Edge-safe.
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  await revokeAndClearSession();
  return NextResponse.redirect(`${new URL(request.url).origin}/`, {
    status: 303,
  });
}

/**
 * A Firebase session cookie is a BEARER credential — deleting the local cookie
 * leaves any copied/stolen cookie valid for the full session lifetime. Revoke the
 * user's refresh tokens server-side so getUser()'s `checkRevoked=true` rejects
 * every copy immediately, THEN clear the local cookie. Best-effort: an
 * invalid/expired cookie or an admin outage must still clear the browser cookie.
 */
export async function revokeAndClearSession(): Promise<void> {
  const jar = await cookies();
  const cookie = jar.get(SESSION_COOKIE)?.value;
  if (cookie) {
    try {
      const decoded = await adminAuth().verifySessionCookie(cookie);
      await adminAuth().revokeRefreshTokens(decoded.uid);
    } catch (err) {
      console.error("[signout] could not revoke session tokens", err);
    }
  }
  jar.delete(SESSION_COOKIE);
}
