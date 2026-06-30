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
            alt="immigration-paperwork"
            width={28}
            height={28}
            className="h-7 w-7 rounded-full"
            priority
          />
          <Wordmark context="Petition Atelier · est. 2026" />
        </div>
        <nav className="flex flex-nowrap items-center gap-5 font-mono text-[13px] uppercase tracking-document text-muted-strong">
          <Link
            href="/dashboard"
            className="ink-link whitespace-nowrap focus-ring"
          >
            Live case file
          </Link>
          <Link
            href="/billing"
            className="ink-link whitespace-nowrap focus-ring"
          >
            Pricing
          </Link>
          <Link
            href="/dashboard/account"
            className="ink-link whitespace-nowrap focus-ring"
          >
            Account
          </Link>
          <Link
            href="/login"
            className="ink-link whitespace-nowrap focus-ring"
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
          <Link className="ink-link" href="/#checkpoints">
            How it works
          </Link>
          <Link className="ink-link" href="/billing">
            Pricing
          </Link>
          <Link className="ink-link" href="/faq">
            FAQ
          </Link>
          <Link className="ink-link" href="/validation">
            Validation
          </Link>
          <Link className="ink-link" href="/dashboard">
            Live case file
          </Link>
        </div>
      </div>
    </footer>
  );
}
