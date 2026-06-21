"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth/session";
import { deleteUserData, recordConsent } from "@/lib/auth/db";
import { adminAuth } from "@/lib/firebase/admin";
import { isDevAuth } from "@/lib/auth/devAuth";
import { SESSION_COOKIE } from "@/lib/firebase/config";
import { CONSENT_VERSION } from "@/lib/auth/consent";
import { clientIp } from "@/lib/tokens/rate-limit";

export interface MarketingPreferenceState {
  ok?: boolean;
  error?: string;
}

/**
 * Change the marketing-email preference. Recorded as a NEW append-only consent
 * row (terms/privacy already accepted; current version) rather than an in-place
 * edit, so the audit trail of "what they agreed to, and when" is preserved — the
 * onboarding gate keys on consent VERSION only, so this never re-prompts. `optIn`
 * is the DESIRED new value, posted by the form's hidden field.
 */
export async function updateMarketingPreference(
  _prev: MarketingPreferenceState,
  formData: FormData,
): Promise<MarketingPreferenceState> {
  const user = await getUser();
  if (!user) redirect("/login");
  const optIn = String(formData.get("optIn") ?? "") === "true";
  const h = await headers();
  try {
    await recordConsent({
      userId: user.id,
      consentVersion: CONSENT_VERSION,
      terms: true,
      privacy: true,
      marketing: optIn,
      ip: clientIp(h),
      userAgent: h.get("user-agent"),
    });
  } catch (err) {
    console.error("[account] marketing preference update failed", { userId: user.id, err });
    return { error: "We couldn't save your preference. Please try again." };
  }
  revalidatePath("/dashboard/account");
  return { ok: true };
}

export interface DeleteAccountState {
  error?: string;
}

/** The exact phrase the user must type to confirm the irreversible deletion. */
const CONFIRM_PHRASE = "delete my account";

/**
 * Permanently delete the signed-in user's account + ALL their data. Irreversible.
 * Requires the user to type `CONFIRM_PHRASE` exactly (a deliberate, unambiguous
 * gesture). Order: delete the data first (the legally-meaningful step), then
 * remove the Firebase auth account, then clear the session and go home.
 */
export async function deleteAccount(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const user = await getUser();
  if (!user) redirect("/login");

  const confirm = String(formData.get("confirm") ?? "").trim().toLowerCase();
  if (confirm !== CONFIRM_PHRASE) {
    return { error: `Type "${CONFIRM_PHRASE}" exactly to confirm.` };
  }

  // 1. Delete every stored record (cascade). The irreversible step — if it fails,
  //    surface the error and STOP (don't remove the auth account, so a retry works).
  try {
    await deleteUserData(user.id);
  } catch (err) {
    console.error("[account] data delete failed", { userId: user.id, err });
    return {
      error: "We couldn't delete your data. Please try again in a moment, or contact support.",
    };
  }

  // 2. Remove the auth account (Firebase only — dev-auth is a synthetic local user
  //    with no real account). Best-effort: the data is already gone, so a flaky
  //    admin call must not strand the user in a half-deleted state.
  if (!isDevAuth()) {
    try {
      await adminAuth().deleteUser(user.id);
    } catch (err) {
      console.error(
        "[account] auth account removal failed (data already deleted)",
        { userId: user.id, err },
      );
    }
  }

  // 3. Clear the session cookie + go home (the deleted auth account already
  //    invalidates the session; this just tidies the browser).
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/?deleted=1");
}
