// Server-only module. The `server-only` npm package isn't a dependency of this
// app, so we enforce the same contract with a runtime guard.
if (typeof window !== "undefined") {
  throw new Error("@/lib/auth/session must not be imported on the client.");
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CONSENT_VERSION } from "@/lib/auth/consent";
import { SESSION_COOKIE } from "@/lib/firebase/config";
import { adminAuth } from "@/lib/firebase/admin";
import { FREE_SIGNUP_GRANT } from "@/lib/tokens/economy";
import { grantSignupTokens } from "@/lib/tokens/ledger";
import { getProfile, upsertProfileWithConsent, type Profile } from "./db";
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
    const existing = await getProfile(DEV_USER.id);
    if (!existing) {
      await upsertProfileWithConsent({
        userId: DEV_USER.id,
        email: DEV_USER.email,
        fullName: DEV_USER.user_metadata?.full_name ?? "Developer",
        avatarUrl: null,
        consentVersion: CONSENT_VERSION,
        terms: true,
        privacy: true,
        marketing: false,
        ip: null,
        userAgent: "dev-auth",
      });
    }
    await grantSignupTokens(DEV_USER.id, FREE_SIGNUP_GRANT);
  } catch {
    devSeeded = false; // let a later call retry
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
        user_metadata: {
          name: (decoded.name as string | undefined) ?? null,
          avatar_url: (decoded.picture as string | undefined) ?? null,
        },
      };
    } catch {
      return null; // expired/invalid/revoked cookie
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
  return { user, profile };
}
