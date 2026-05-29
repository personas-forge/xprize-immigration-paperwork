"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { upsertProfileWithConsent } from "@/lib/auth/db";
import { CONSENT_VERSION } from "@/lib/supabase/config";
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
  if (!terms || !privacy)
    return { error: "You must accept the Terms and Privacy Policy to continue." };

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;

  await upsertProfileWithConsent({
    userId: user.id,
    email: user.email ?? null,
    fullName,
    avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null,
    consentVersion: CONSENT_VERSION,
    terms,
    privacy,
    marketing,
    ip,
    userAgent: h.get("user-agent"),
  });

  // One-time free token grant for the new account (idempotent per user, and a
  // no-op when the DB isn't configured). Lets the user try AI guidance right
  // away before topping up via the /billing bundles.
  await grantSignupTokens(user.id, FREE_SIGNUP_GRANT);

  redirect("/dashboard");
}
