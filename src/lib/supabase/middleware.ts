import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY, isAuthConfigured } from "./config";

// Routes that require a session. Adapt per app. Keep marketing pages public
// (/, /pricing, /faq, /landing-claude stay public for this app).
const PROTECTED_PREFIXES = ["/dashboard"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

/**
 * Edge-safe session refresh + auth gate. Runs in middleware (Edge runtime), so
 * it must NOT touch `pg`. The profile/onboarding check happens later in the
 * protected layout (Node runtime) via requireOnboardedUser().
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Graceful no-op when auth isn't configured (keyless builds / dev).
  if (!isAuthConfigured()) return response;

  const supabase = createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if (isProtected(path) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return response;
}
