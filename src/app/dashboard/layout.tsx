// Protected-segment layout for /dashboard. Runs in the Node runtime, so it can
// use `pg` via requireOnboardedUser(). This is where the onboarding/consent
// gate is enforced (middleware only checks for a session).

import { requireOnboardedUser } from "@/lib/auth/session";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Redirects to /login (no session) or /welcome (no consent) as needed.
  await requireOnboardedUser();
  return <>{children}</>;
}
