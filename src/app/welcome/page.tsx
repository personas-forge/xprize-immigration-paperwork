// First-auth gate. If the signed-in user already completed consent, skip to the
// app. Otherwise render the consent/registration form, framed in the Atelier of
// Arrival identity (parchment ground, engraved chapter mark, guilloché corner).

import { redirect } from "next/navigation";
import { getUser, profileFieldsFromUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/auth/db";
import { ConsentForm } from "@/components/ConsentForm";
import { PageFrame, ChapterMark } from "@/components/brand";
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function WelcomePage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id);
  if (profile?.onboarded_at) redirect("/dashboard");

  const { fullName: defaultName } = profileFieldsFromUser(user);

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
          <p className="font-sans text-[17px] leading-relaxed text-muted-strong">
            A couple of details and your consent, then your case file is ready.
          </p>
          <div className="perforation h-px" aria-hidden />
        </header>
        <div
          className="flex items-center gap-2 font-mono text-[13px] uppercase tracking-document text-muted-strong"
          aria-label="Step 2 of 2: Confirm your details"
        >
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full border border-border-strong text-[12px]"
            aria-hidden
          >
            2
          </span>
          <span>Step 2 of 2</span>
          <span aria-hidden className="text-muted">·</span>
          <span>Confirm your details</span>
        </div>
        <ConsentForm defaultName={defaultName} email={user.email ?? null} />
      </main>
    </PageFrame>
  );
}
