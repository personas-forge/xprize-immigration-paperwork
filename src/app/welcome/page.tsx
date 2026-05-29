// First-auth gate. If the signed-in user already completed consent, skip to the
// app. Otherwise render the consent/registration form, framed in the Atelier of
// Arrival identity (parchment ground, engraved chapter mark, guilloché corner).

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/auth/db";
import { ConsentForm } from "@/components/ConsentForm";
import { PageFrame, ChapterMark } from "@/components/brand";
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function WelcomePage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id);
  if (profile?.onboarded_at) redirect("/dashboard");

  const defaultName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    "";

  return (
    <PageFrame>
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-8 px-6 py-16">
        <header className="space-y-4">
          <div className="flex items-center justify-between">
            <ChapterMark numeral="I" label="Registration of arrival" />
            <ThemeToggle />
          </div>
          <h1 className="display text-[clamp(2rem,6vw,3.2rem)] text-foreground">
            Welcome — <em>let&apos;s open your file</em>.
          </h1>
          <p className="font-sans text-[15px] leading-relaxed text-muted-strong">
            A couple of details and your consent, then your case file is ready.
          </p>
          <div className="perforation h-px" aria-hidden />
        </header>
        <ConsentForm defaultName={defaultName} email={user.email ?? null} />
      </main>
    </PageFrame>
  );
}
