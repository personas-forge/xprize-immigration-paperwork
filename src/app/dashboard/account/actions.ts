"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getUser } from "@/lib/auth/session";
import { deleteUserData } from "@/lib/auth/db";
import { adminAuth } from "@/lib/firebase/admin";
import { isDevAuth } from "@/lib/auth/devAuth";
import { SESSION_COOKIE } from "@/lib/firebase/config";

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
