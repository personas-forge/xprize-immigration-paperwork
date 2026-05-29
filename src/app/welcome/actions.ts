"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { upsertProfileWithConsent } from "@/lib/auth/db";
import { CONSENT_VERSION } from "@/lib/supabase/config";

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

  redirect("/dashboard");
}
