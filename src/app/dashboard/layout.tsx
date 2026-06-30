// Protected-segment layout for /dashboard. Runs in the Node runtime, so it can
// use `pg` via requireOnboardedUser(). This is where the onboarding/consent
// gate is enforced (middleware only checks for a session).

import { requireOnboardedUser } from "@/lib/auth/session";

// Instant Navigations (Next 16.3): this layout reads auth/cookies
// (requireOnboardedUser) outside Suspense, which dooms the static shell of every
// /dashboard route. Block the whole authenticated subtree once here rather than
// per page — every /dashboard/* page is server-bound anyway.
export const instant = false;

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Redirects to /login (no session) or /welcome (no consent) as needed.
  await requireOnboardedUser();
  return <>{children}</>;
}
