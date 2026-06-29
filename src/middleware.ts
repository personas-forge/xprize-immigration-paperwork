import { NextResponse, type NextRequest } from "next/server";
import { isDevAuth } from "@/lib/auth/devAuth";
import { authProvider } from "@/lib/auth/provider";
import { SESSION_COOKIE } from "@/lib/firebase/config";

// Routes that require a session. Keep marketing pages public
// (/, /pricing, /faq stay public for this app).
const PROTECTED_PREFIXES = ["/dashboard"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

/**
 * Firebase-only auth gate (Edge runtime). The Admin SDK is Node-only and can't
 * run here, so this is a cheap *presence* check of the session cookie
 * (`SESSION_COOKIE` — `__Host-session` in prod, `__session` in dev); the real
 * `verifySessionCookie` + profile/onboarding check happens later in the
 * protected layout (Node runtime) via requireOnboardedUser().
 *
 * Graceful no-op when Firebase isn't configured (keyless builds / dev) and in
 * dev-auth mode (the synthetic user is always "signed in").
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  // Dev-auth: the synthetic user is always "signed in" — never gate.
  if (isDevAuth()) return response;

  // Only Firebase gates; null (unconfigured) is a graceful pass-through.
  if (authProvider() !== "firebase") return response;

  const path = request.nextUrl.pathname;
  if (isProtected(path) && !request.cookies.get(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on everything except static assets & image files.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
