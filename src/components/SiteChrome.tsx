import Image from "next/image";
import Link from "next/link";
import { Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/ThemeToggle";

// — Shared marketing chrome ───────────────────────────────────────────────────
// ONE header + footer for the marketing pages that opt in (qualify, billing,
// faq, validation, visa). The homepage (`page.tsx` → PassportLanding) is the
// exception: it intentionally ships its OWN passport nav + footer and does NOT
// render this chrome. Each opted-in page used to keep its own local copy and they
// had drifted apart — different nav items, some with the logo and some without,
// different footer taglines and link sets. These are the single source so the
// site nav stays consistent; the page-specific stuff stays on the page.
//
// Server component (no client state of its own); `ThemeToggle` is the only
// client child, which a server component may render.

export function SiteHeader() {
  return (
    <header className="relative">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          <Image
            src="/brand/logo.png"
            alt="Immigration Concierge"
            width={28}
            height={28}
            className="h-7 w-7 rounded-full"
            priority
          />
          <Wordmark context="Petition Atelier · est. 2026" />
        </div>
        {/* ≥md: the full inline nav (five links + toggle never fit at 375px). */}
        <nav className="hidden flex-nowrap items-center gap-5 font-mono text-[13px] uppercase tracking-document text-muted-strong md:flex">
          {/* py-1 on each plain nav link brings the tap target to ~24px tall
              (WCAG 2.5.8 min) — the text alone (13px) was ~21.5px. */}
          <Link
            href="/dashboard"
            className="ink-link whitespace-nowrap py-1 focus-ring"
          >
            Live case file
          </Link>
          <Link
            href="/billing"
            className="ink-link whitespace-nowrap py-1 focus-ring"
          >
            Pricing
          </Link>
          <Link
            href="/dashboard/account"
            className="ink-link whitespace-nowrap py-1 focus-ring"
          >
            Account
          </Link>
          <Link
            href="/login"
            className="ink-link whitespace-nowrap py-1 focus-ring"
          >
            Sign in
          </Link>
          <Link
            href="/qualify"
            className="whitespace-nowrap rounded-control border border-foreground bg-foreground px-4 py-2 text-background transition-[background-color] hover:bg-foreground-soft focus-ring"
          >
            Free qualification
          </Link>
          <ThemeToggle />
        </nav>

        {/* <md: CSS-only disclosure menu (native <details> — no client JS, so
            the header stays a server component and the menu works pre-hydration). */}
        <details className="relative md:hidden">
          <summary
            className="focus-ring inline-flex cursor-pointer list-none items-center gap-2 rounded-control border border-border-strong bg-surface px-3.5 py-2 font-mono text-[13px] uppercase tracking-document text-foreground [&::-webkit-details-marker]:hidden"
            aria-label="Site menu"
          >
            <span aria-hidden>☰</span> Menu
          </summary>
          <nav className="absolute right-0 z-50 mt-2 flex w-60 flex-col gap-1 rounded-card border border-border-strong bg-surface p-3 font-mono text-[13px] uppercase tracking-document text-muted-strong shadow-seal">
            <Link href="/dashboard" className="ink-link focus-ring px-2 py-2">
              Live case file
            </Link>
            <Link href="/billing" className="ink-link focus-ring px-2 py-2">
              Pricing
            </Link>
            <Link href="/dashboard/account" className="ink-link focus-ring px-2 py-2">
              Account
            </Link>
            <Link href="/login" className="ink-link focus-ring px-2 py-2">
              Sign in
            </Link>
            <Link
              href="/qualify"
              className="focus-ring mt-1 rounded-control border border-foreground bg-foreground px-3 py-2 text-center text-background"
            >
              Free qualification
            </Link>
            <div className="mt-2 border-t border-border pt-2">
              <ThemeToggle />
            </div>
          </nav>
        </details>
      </div>
      <div className="perforation mx-8 h-px" aria-hidden />
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface/50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-8 py-8">
        <div className="microprint">
          © Immigration Concierge · XPrize hackathon · 90-day MVP
        </div>
        <div className="microprint flex flex-wrap items-center gap-4">
          {/* py-1 brings each link's tap target to ~24px tall (WCAG 2.5.8) —
              microprint text alone (11.5px) was ~19px. */}
          <Link className="ink-link py-1" href="/#checkpoints">
            How it works
          </Link>
          <Link className="ink-link py-1" href="/billing">
            Pricing
          </Link>
          <Link className="ink-link py-1" href="/faq">
            FAQ
          </Link>
          <Link className="ink-link py-1" href="/validation">
            Validation
          </Link>
          <Link className="ink-link py-1" href="/dashboard">
            Live case file
          </Link>
          <Link className="ink-link py-1" href="/terms">
            Terms
          </Link>
          <Link className="ink-link py-1" href="/privacy">
            Privacy
          </Link>
        </div>
      </div>
      {/* On-site entry into the visa-guide matrix — these pages were
          sitemap-only orphans a visitor could never reach from the product. */}
      <div className="mx-auto max-w-6xl px-8 pb-8">
        <div className="microprint flex flex-wrap items-center gap-4" style={{ color: "var(--muted)" }}>
          <span>Visa guides:</span>
          <Link className="ink-link py-1" href="/visa/o-1a/software-engineer">
            O-1A · Software engineer
          </Link>
          <Link className="ink-link py-1" href="/visa/o-1a/researcher">
            O-1A · Researcher
          </Link>
          <Link className="ink-link py-1" href="/visa/o-1a/founder">
            O-1A · Founder
          </Link>
          <Link className="ink-link py-1" href="/visa/o-1b/artist">
            O-1B · Artist
          </Link>
          <Link className="ink-link py-1" href="/visa/eb-1a/researcher">
            EB-1A · Researcher
          </Link>
        </div>
      </div>
    </footer>
  );
}
