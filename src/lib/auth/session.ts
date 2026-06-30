// Server-only module — see `assertServerOnly` for why this app uses a runtime
// guard instead of `import "server-only"`.
import { assertServerOnly } from "@/lib/serverOnlyGuard";
assertServerOnly("@/lib/auth/session");

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isFullyConsented } from "@/lib/auth/consent";
import { SESSION_COOKIE } from "@/lib/firebase/config";
import { adminAuth } from "@/lib/firebase/admin";
import { completeOnboarding } from "./onboarding";
import {
  getLatestConsentVersion,
  getProfile,
  type Profile,
} from "./db";
import { DEV_USER, isDevAuth, type AppUser } from "./devAuth";
import { authProvider } from "./provider";

// Seed the synthetic dev user once per server process (idempotent in the store
// anyway). Auto-onboards + grants the free balance so dev-auth lands you on a
// working, funded account without the Google/consent round-trip.
let devSeeded = false;
async function ensureDevSeeded(): Promise<void> {
  if (devSeeded || !isDevAuth()) return;
  devSeeded = true;
  try {
    // Skip the consent write when a profile already exists so a process restart
    // doesn't append a duplicate consent row; always (re-)ensure the idempotent
    // grant. Shares the persist+grant recipe with the prod welcome flow.
    const existing = await getProfile(DEV_USER.id);
    const result = await completeOnboarding(
      {
        userId: DEV_USER.id,
        email: DEV_USER.email,
        fullName: DEV_USER.user_metadata?.full_name ?? "Developer",
        avatarUrl: null,
        terms: true,
        privacy: true,
        marketing: false,
        ip: null,
        userAgent: "dev-auth",
      },
      { persistConsent: !existing, grantTokens: true },
    );
    if (!result.ok) devSeeded = false; // let a later call retry
  } catch {
    devSeeded = false; // a read threw — let a later call retry
  }
}

/**
 * Profile/display fields derived from an AppUser's provider metadata — in one
 * place so the welcome page (default name) and the consent action (avatar URL)
 * apply the same metadata-key fallbacks (`full_name` ?? `name`) rather than each
 * reaching into `user_metadata` independently.
 */
export function profileFieldsFromUser(user: AppUser): {
  fullName: string;
  avatarUrl: string | null;
} {
  const meta = user.user_metadata;
  return {
    fullName: meta?.full_name ?? meta?.name ?? "",
    avatarUrl: meta?.avatar_url ?? null,
  };
}

/** Current user, or null. Dispatches by provider: dev-auth → Firebase. */
export async function getUser(): Promise<AppUser | null> {
  if (isDevAuth()) {
    await ensureDevSeeded();
    return DEV_USER;
  }

  const provider = authProvider();

  if (provider === "firebase") {
    const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!cookie) return null;
    try {
      // checkRevoked=true so a signed-out / disabled user is rejected.
      const decoded = await adminAuth().verifySessionCookie(cookie, true);
      return {
        id: decoded.uid,
        email: decoded.email ?? null,
        // Firebase exposes email_verified on the decoded token. Default to false
        // (fail-closed for the grant gate) when the provider doesn't assert it.
        emailVerified: decoded.email_verified === true,
        user_metadata: {
          name: (decoded.name as string | undefined) ?? null,
          avatar_url: (decoded.picture as string | undefined) ?? null,
        },
      };
    } catch (err) {
      // Expected: a genuinely expired/revoked/invalid cookie → treat as signed
      // out. UNEXPECTED: the admin SDK can't verify ANYTHING (ADC misconfigured/
      // expired, missing IAM token-creator role) — that signs EVERY user out and
      // looks like an infinite login loop with no breadcrumb. Log the unexpected
      // branch so a credential outage is diagnosable. Still return null (the
      // layout redirects to /login), but no longer silently.
      const code = (err as { code?: string })?.code ?? "";
      const expected =
        /session-cookie-(expired|revoked|invalid)|argument-error|id-token-(expired|revoked)/.test(
          code,
        );
      if (!expected) {
        console.error(
          "[auth] session verification failed unexpectedly (check admin credentials / IAM):",
          code || err,
        );
      }
      return null;
    }
  }

  return null;
}

/**
 * Gate for protected layouts (Node runtime). Redirects to /login if
 * unauthenticated, or /welcome if the user hasn't completed first-auth consent.
 * In dev-auth mode the user is auto-seeded + onboarded, so it falls straight
 * through to the workspace.
 */
export async function requireOnboardedUser(): Promise<{
  user: AppUser;
  profile: Profile;
}> {
  const user = await getUser();
  if (!user) redirect("/login");
  const profile = await getProfile(user.id);
  if (!profile || !profile.onboarded_at) redirect("/welcome");
  // Re-prompt when the accepted consent version is behind CONSENT_VERSION, using
  // the same isFullyConsented predicate the welcome page uses (so the gate can't
  // drift to two polarities). Dev-auth is auto-seeded at the current version, so
  // the version check is skipped for it. Marketing preference is mutable
  // independently (account page) and intentionally NOT a re-prompt trigger.
  if (!isDevAuth()) {
    const consented = await getLatestConsentVersion(user.id);
    if (!isFullyConsented(profile, consented)) redirect("/welcome");
  }
  return { user, profile };
}
