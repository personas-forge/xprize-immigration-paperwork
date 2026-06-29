"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUser, profileFieldsFromUser } from "@/lib/auth/session";
import { CONSENT_FIELDS } from "@/lib/auth/consent";
import { completeOnboarding } from "@/lib/auth/onboarding";
import { clientIp } from "@/lib/tokens/rate-limit";
import { safeNext } from "@/lib/auth/safe-next";

export type ConsentState = { error?: string };

export async function submitConsent(
  _prev: ConsentState,
  formData: FormData,
): Promise<ConsentState> {
  const user = await getUser();
  if (!user) redirect("/login");

  const fullName = String(formData.get(CONSENT_FIELDS.fullName) ?? "").trim();
  const terms = formData.get(CONSENT_FIELDS.terms) === "on";
  const privacy = formData.get(CONSENT_FIELDS.privacy) === "on";
  const marketing = formData.get(CONSENT_FIELDS.marketing) === "on";
  // Re-validate the deep-link destination server-side (never trust the hidden
  // field) — safeNext rejects off-site targets, defaulting to /dashboard.
  const dest = safeNext(formData.get("next")?.toString());

  if (!fullName) return { error: "Please enter your name." };
  // Cap the length server-side — full_name is written to a TEXT column with no
  // DB constraint, so an unbounded value could bloat the row and overflow
  // downstream PDF fields.
  if (fullName.length > 200)
    return { error: "Please enter a shorter name (200 characters max)." };
  if (!terms || !privacy)
    return { error: "You must accept the Terms and Privacy Policy to continue." };

  const h = await headers();
  // Validated — an invalid/spoofed forwarded header is stored as null rather than
  // trusted into the consent record (shared with the rate limiter's hardening).
  const ip = clientIp(h);
  // Only the avatar is taken from the provider profile here; the display name
  // comes from the form's `full_name` field (resolved above), not provider metadata.
  const { avatarUrl } = profileFieldsFromUser(user);

  // Persist consent FIRST (the essential, legally-meaningful write), THEN grant
  // the one-time free tokens BEST-EFFORT, gated on a VERIFIED identity — the
  // signup grant is the most directly farmable money path, so an unverified,
  // one-click account must not mint spendable AI credit (Google sign-in is always
  // verified; the dev user is trusted). The shared recipe pins CONSENT_VERSION +
  // FREE_SIGNUP_GRANT + the persist-before-grant order so dev and prod can't drift;
  // we keep the error/gating POLICY here. The thrown NEXT_REDIRECT below is
  // intentionally OUTSIDE the failure handling so it propagates.
  const result = await completeOnboarding(
    {
      userId: user.id,
      email: user.email ?? null,
      fullName,
      avatarUrl,
      terms,
      privacy,
      marketing,
      ip,
      userAgent: h.get("user-agent"),
    },
    { persistConsent: true, grantTokens: Boolean(user.emailVerified) },
  );
  if (!result.ok && result.step === "consent") {
    // Only a consent failure blocks onboarding (leaves the user not-onboarded →
    // a safe retry). Don't swallow — record enough to triage a consent-write
    // outage (DB down vs rules misconfig vs validation) without logging PII.
    console.error("[welcome] consent persist failed", { userId: user.id, err: result.cause });
    return {
      error: "We couldn't save your consent. Please try again in a moment.",
    };
  }
  if (!result.ok && result.step === "grant") {
    // Non-essential + idempotent: a token-store hiccup must NOT block onboarding
    // or be misreported as a consent failure. Log it (for operator/top-up
    // re-grant) and let the user into the workspace.
    console.error("[welcome] signup token grant failed (non-blocking)", {
      userId: user.id,
      err: result.cause,
    });
  } else if (!user.emailVerified) {
    // Grant deferred until the email is verified. (Disposable-domain rejection is
    // a possible follow-up.)
    console.warn("[welcome] signup grant deferred — email not verified", {
      userId: user.id,
    });
  }

  redirect(dest);
}
