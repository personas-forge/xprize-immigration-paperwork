import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAuthConfigured } from "@/lib/supabase/config";
import { getProfile, type Profile } from "./db";

/** Current authenticated user, or null (also null when auth isn't configured). */
export async function getUser() {
  if (!isAuthConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Gate for protected layouts (Node runtime — uses `pg`). Redirects to /login if
 * unauthenticated, or /welcome if the user hasn't completed first-auth consent.
 */
export async function requireOnboardedUser(): Promise<{
  user: NonNullable<Awaited<ReturnType<typeof getUser>>>;
  profile: Profile;
}> {
  const user = await getUser();
  if (!user) redirect("/login");
  const profile = await getProfile(user.id);
  if (!profile || !profile.onboarded_at) redirect("/welcome");
  return { user, profile };
}
