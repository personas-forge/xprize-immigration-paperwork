import type { Metadata } from "next";

// login/page.tsx is a client component (signInWithPopup, useState), so it
// can't export `metadata` itself — without this it silently fell back to the
// root layout's homepage title/description. A thin server layout is the
// standard Next.js App Router fix: it costs nothing at runtime and gives the
// route its own indexable title, matching every other top-level route
// (billing, faq, qualify, …).
export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to start your O-1 / EB-1A petition — free to begin, token-metered AI drafting, reviewed and filed by your own attorney of record.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
