import type { Metadata } from "next";
import Link from "next/link";
import { PageFrame, Wordmark, ChapterMark } from "@/components/brand";
import { Rise } from "@/components/Motion";
import { ThemeToggle } from "@/components/ThemeToggle";
import { QualifyPanel } from "@/features/qualification/components/QualifyPanel";

export const metadata: Metadata = {
  title: "Do you qualify? — Immigration Concierge",
  description:
    "An informational O-1A self-screening. Describe your background and see how it maps onto the eight extraordinary-ability criteria. Not legal advice.",
};

// — Qualification funnel ──────────────────────────────────────────────────────
// Top-of-funnel self-screening. Standalone route (local header/footer) so it can
// be shared as a lead-gen link. The screening itself runs client-side through
// /api/qualify; this page is just the brand shell around <QualifyPanel/>.

export default function QualifyPage() {
  return (
    <PageFrame>
      <SiteHeader />

      <section className="mx-auto max-w-3xl px-8 pb-16 pt-16">
        <Rise>
          <ChapterMark numeral="I" label="Qualification" />
          <h1 className="display mt-5 text-[clamp(2.2rem,5.5vw,3.8rem)]">
            Do you <em>qualify</em>?
          </h1>
          <p className="mt-6 max-w-2xl font-sans text-[16px] leading-relaxed text-muted-strong">
            Pick your visa type — <strong>O-1A</strong>, <strong>O-1B</strong>,
            or <strong>EB-1A</strong> — describe your background, and we&apos;ll
            map it onto that classification&apos;s extraordinary-ability
            criteria, with an estimated likelihood and the gaps worth closing.
            This is general information to help you screen yourself; it is never
            legal advice, and an attorney of record reviews everything before
            anything is filed.
          </p>
        </Rise>

        <Rise className="mt-10">
          <QualifyPanel />
        </Rise>
      </section>

      <SiteFooter />
    </PageFrame>
  );
}

/* ── Header + footer (kept local so /qualify is a standalone route) ──── */

function SiteHeader() {
  return (
    <header className="relative">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-6">
        <Wordmark context="Petition Atelier · est. 2026" />
        <nav className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-document text-muted-strong">
          <Link
            href="/"
            className="ink-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
          >
            Home
          </Link>
          <Link
            href="/faq"
            className="ink-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
          >
            FAQ
          </Link>
          <Link
            href="/billing"
            className="ink-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
          >
            Tokens
          </Link>
          <ThemeToggle />
        </nav>
      </div>
      <div className="perforation mx-8 h-px" aria-hidden />
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border bg-surface/50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-8 py-8">
        <div className="microprint">
          © Immigration Concierge · Qualification · 2026
        </div>
        <div className="microprint flex gap-4">
          <Link className="ink-link" href="/">
            Home
          </Link>
          <Link className="ink-link" href="/faq">
            FAQ
          </Link>
          <Link className="ink-link" href="/billing">
            Tokens
          </Link>
        </div>
      </div>
    </footer>
  );
}
