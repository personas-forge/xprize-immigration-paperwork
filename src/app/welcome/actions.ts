"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUser, profileFieldsFromUser } from "@/lib/auth/session";
import { upsertProfileWithConsent } from "@/lib/auth/db";
import { CONSENT_VERSION } from "@/lib/auth/consent";
import { grantSignupTokens } from "@/lib/tokens/ledger";
import { FREE_SIGNUP_GRANT } from "@/lib/tokens/economy";

export type ConsentState = { error?: string };

export async function submitConsent(
  _prev: ConsentState,
  formData: FormData,
): Promise<ConsentState> {
  const user = await getUser();
  if (!user) redirect("/login");

  const fullName = String(formData.get("full_name") ?? "").trim();
  const terms = formData.get("terms") === "on";
  const privacy = formData.get("privacy") === "on";
  const marketing = formData.get("marketing") === "on";

  if (!fullName) return { error: "Please enter your name." };
  // Cap the length server-side — full_name is written to a TEXT column with no
  // DB constraint, so an unbounded value could bloat the row and overflow
  // downstream PDF fields.
  if (fullName.length > 200)
    return { error: "Please enter a shorter name (200 characters max)." };
  if (!terms || !privacy)
    return { error: "You must accept the Terms and Privacy Policy to continue." };

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;

  // Wrap ONLY the DB writes — NOT the redirect below, which signals via a thrown
  // NEXT_REDIRECT that must propagate. A persistence failure here becomes a
  // friendly ConsentState error instead of a generic 500 page.
  try {
    // Grant the one-time free tokens (idempotent per user, no-op without a DB)
    // BEFORE marking the profile onboarded. These are two separate writes, so on
    // a crash between them this order leaves the user not-yet-onboarded — they
    // retry consent and the idempotent grant is a no-op — rather than onboarded
    // with a zero balance, which would 402 every AI op with no way forward.
    await grantSignupTokens(user.id, FREE_SIGNUP_GRANT);

    await upsertProfileWithConsent({
      userId: user.id,
      email: user.email ?? null,
      fullName,
      avatarUrl: profileFieldsFromUser(user).avatarUrl,
      consentVersion: CONSENT_VERSION,
      terms,
      privacy,
      marketing,
      ip,
      userAgent: h.get("user-agent"),
    });
  } catch {
    return {
      error: "We couldn't save your consent. Please try again in a moment.",
    };
  }

  redirect("/dashboard");
}
