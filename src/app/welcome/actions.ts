"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUser, profileFieldsFromUser } from "@/lib/auth/session";
import { upsertProfileWithConsent } from "@/lib/auth/db";
import { CONSENT_FIELDS, CONSENT_VERSION } from "@/lib/auth/consent";
import { grantSignupTokens } from "@/lib/tokens/ledger";
import { FREE_SIGNUP_GRANT } from "@/lib/tokens/economy";
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

  // Persist consent FIRST — it is the essential, legally-meaningful write, and
  // ONLY its failure should block onboarding (it leaves the user not-onboarded →
  // a safe retry; the idempotent grant below no-ops on retry). The thrown
  // NEXT_REDIRECT at the end is intentionally OUTSIDE this try so it propagates.
  try {
    await upsertProfileWithConsent({
      userId: user.id,
      email: user.email ?? null,
      fullName,
      avatarUrl,
      consentVersion: CONSENT_VERSION,
      terms,
      privacy,
      marketing,
      ip,
      userAgent: h.get("user-agent"),
    });
  } catch (err) {
    // Don't swallow — record enough to triage a consent-write outage (DB down vs
    // rules misconfig vs validation) without logging PII.
    console.error("[welcome] consent persist failed", { userId: user.id, err });
    return {
      error: "We couldn't save your consent. Please try again in a moment.",
    };
  }

  // Grant the one-time free tokens BEST-EFFORT, gated on a VERIFIED identity. The
  // signup grant is the most directly farmable money path — an unverified,
  // one-click account must not mint spendable AI credit — so require a verified
  // email (Google sign-in is always verified; the dev user is trusted). Per-user
  // idempotency stays the second layer. The grant is non-essential + idempotent,
  // so a token-store hiccup must NOT block onboarding or be misreported as a
  // consent failure; we log it (for operator/top-up re-grant) and the user still
  // enters the workspace. (Disposable-domain rejection is a possible follow-up.)
  if (user.emailVerified) {
    try {
      await grantSignupTokens(user.id, FREE_SIGNUP_GRANT);
    } catch (err) {
      console.error("[welcome] signup token grant failed (non-blocking)", {
        userId: user.id,
        err,
      });
    }
  } else {
    console.warn("[welcome] signup grant deferred — email not verified", {
      userId: user.id,
    });
  }

  redirect(dest);
}
