// Server-only. The first-time onboarding recipe, single-sourced so the prod
// (welcome/actions) and dev (session ensureDevSeeded) entry points can't drift on
// WHAT consent version is recorded, HOW MANY signup tokens are granted, or the
// persist-consent-BEFORE-grant order. Each step's failure is reported by `step`
// so callers keep their own policy: the consent write is the essential,
// legally-meaningful step (its failure should block onboarding) while the signup
// grant is best-effort + idempotent and may be gated (prod grants only for a
// verified email). See `assertServerOnly` for why this app uses a runtime guard.
import { assertServerOnly } from "@/lib/serverOnlyGuard";
assertServerOnly("@/lib/auth/onboarding");

import { CONSENT_VERSION } from "@/lib/auth/consent";
import { upsertProfileWithConsent } from "@/lib/auth/db";
import { FREE_SIGNUP_GRANT } from "@/lib/tokens/economy";
import { grantSignupTokens } from "@/lib/tokens/ledger";

/** Profile + consent fields for the onboarding write, WITHOUT `consentVersion` —
 *  the recipe pins that to the current `CONSENT_VERSION` so call sites can't pass
 *  a stale value. */
export interface OnboardingConsentFields {
  userId: string;
  email: string | null;
  fullName: string;
  avatarUrl: string | null;
  terms: boolean;
  privacy: boolean;
  marketing: boolean;
  ip: string | null;
  userAgent: string | null;
}

export type OnboardingResult =
  | { ok: true }
  | { ok: false; step: "consent" | "grant"; cause: unknown };

/** Injectable seam (defaults to the real Store delegators) so the recipe's
 *  order/flag/result logic is unit-testable without a backing store. */
export interface OnboardingDeps {
  upsertProfileWithConsent: typeof upsertProfileWithConsent;
  grantSignupTokens: typeof grantSignupTokens;
}

const DEFAULT_DEPS: OnboardingDeps = { upsertProfileWithConsent, grantSignupTokens };

/**
 * Run first-time onboarding: (1) persist the profile + consent row at the current
 * `CONSENT_VERSION`, then (2) grant the one-time `FREE_SIGNUP_GRANT` tokens.
 *
 * Both steps are individually opt-out so the two call sites express their genuine
 * divergences without re-deriving the constants or the order:
 *  - `persistConsent` — dev skips it when a profile already exists (avoids a
 *    duplicate consent row on every process restart); prod always writes it.
 *  - `grantTokens` — prod gates this on a verified email; dev grants always.
 *
 * The grant is idempotent per user, so re-running is safe. Failures are returned
 * (not thrown) tagged with the failing `step` so each caller applies its own
 * error policy (fatal consent vs best-effort grant).
 */
export async function completeOnboarding(
  fields: OnboardingConsentFields,
  opts: { persistConsent: boolean; grantTokens: boolean },
  deps: OnboardingDeps = DEFAULT_DEPS,
): Promise<OnboardingResult> {
  if (opts.persistConsent) {
    try {
      await deps.upsertProfileWithConsent({ ...fields, consentVersion: CONSENT_VERSION });
    } catch (cause) {
      return { ok: false, step: "consent", cause };
    }
  }
  if (opts.grantTokens) {
    try {
      await deps.grantSignupTokens(fields.userId, FREE_SIGNUP_GRANT);
    } catch (cause) {
      return { ok: false, step: "grant", cause };
    }
  }
  return { ok: true };
}
