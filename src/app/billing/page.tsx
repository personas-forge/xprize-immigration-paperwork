import type { Metadata } from "next";
import Link from "next/link";
import { PageFrame, Wordmark, ChapterMark, Seal } from "@/components/brand";
import { Rise } from "@/components/Motion";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getUser } from "@/lib/auth/session";
import { getBalance } from "@/lib/tokens/ledger";
import { isAuthConfigured } from "@/lib/supabase/config";
import { BUNDLES, ENTERPRISE_CONTACT, FREE_SIGNUP_GRANT } from "@/lib/tokens/economy";
import { BundleGrid } from "./BundleGrid";

export const metadata: Metadata = {
  title: "Token ledger — Immigration Concierge",
  description:
    "Prepaid tokens fund AI form-field guidance. Top up with a bundle — bigger bundles cost less per token. Enterprise is contact-only.",
};

// Node runtime — getBalance() uses `pg`.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// — Billing — prepaid token ledger + bundles ─────────────────────────────────
// Replaces the old subscription pricing. A balance "ledger entry" up top, the
// four prepaid bundles below, then an Enterprise contact band. All colour is
// drawn from CSS theme tokens, so the page re-skins between parchment and ink
// with the header ThemeToggle (no theme-specific markup). When auth/DB isn't
// configured the balance reads "∞" (the guard gives a free, unmetered pass).

export default async function BillingPage() {
  const user = isAuthConfigured() ? await getUser() : null;
  // "∞" when the token economy isn't enforced (no auth/DB → guard free-passes).
  const balance =
    user && process.env.DATABASE_URL ? await getBalance(user.id) : null;
  const balanceLabel = balance === null ? "∞" : balance.toLocaleString();

  return (
    <PageFrame>
      <SiteHeader />

      <section className="mx-auto max-w-6xl px-8 pb-10 pt-20">
        <Rise>
          <ChapterMark numeral="IV" label="Token ledger" />
          <h1 className="display mt-5 max-w-3xl text-[clamp(2.4rem,6vw,4.4rem)]">
            Pay for <em>exactly what you use</em>.
          </h1>
          <p className="mt-6 max-w-2xl font-sans text-[16px] leading-relaxed text-muted-strong">
            No subscriptions. Each AI form-field answer costs a single token;
            you keep what you don&apos;t spend. New accounts start with{" "}
            <span className="doc-number text-foreground">{FREE_SIGNUP_GRANT}</span>{" "}
            free tokens. Top up with a bundle below — larger bundles cost less
            per token.
          </p>
        </Rise>

        {/* Balance ledger entry */}
        <Rise className="mt-10">
          <div className="relative overflow-hidden rounded-card border border-border-strong bg-surface px-6 py-5 shadow-leaf guilloche">
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="microprint" style={{ color: "var(--accent-dark)" }}>
                  Current balance
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span
                    className="display text-[2.6rem] text-foreground"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {balanceLabel}
                  </span>
                  <span className="microprint" style={{ color: "var(--muted)" }}>
                    tokens
                  </span>
                </div>
              </div>
              <div className="text-accent-dark">
                <Seal size={44} />
              </div>
            </div>
          </div>
        </Rise>

        {/* Bundles */}
        <Rise className="mt-12">
          <div className="microprint mb-5" style={{ color: "var(--accent-dark)" }}>
            § Bundles — one-time top-up
          </div>
          <BundleGrid bundles={BUNDLES} />
        </Rise>

        {/* Enterprise — contact only */}
        <Rise className="mt-12">
          <div className="relative flex flex-col gap-5 rounded-card border-2 border-double border-seal/40 bg-seal-soft/30 px-7 py-7 shadow-seal sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <div className="microprint" style={{ color: "var(--seal)" }}>
                Enterprise · by arrangement
              </div>
              <h2 className="display mt-2 text-2xl text-foreground">
                High-volume firms &amp; partners
              </h2>
              <p className="mt-2 font-sans text-[14px] leading-relaxed text-muted-strong">
                Premium model tier, custom token limits, SSO, and invoiced
                billing for law firms and institutional partners. We tailor the
                ledger and terms to your caseload.
              </p>
            </div>
            <a
              href={ENTERPRISE_CONTACT}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-control bg-seal px-6 py-3 font-mono text-[12px] uppercase tracking-document text-background transition-[background-color,transform] hover:bg-[color:var(--accent-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40 active:translate-y-[1px]"
            >
              Contact sales
              <span aria-hidden>→</span>
            </a>
          </div>
        </Rise>

        {/* Footnotes */}
        <Rise className="mt-14">
          <div className="perforation h-px" aria-hidden />
          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            <Footnote
              eyebrow="What a token buys"
              body="One token = one AI form-field guidance answer. Tokens are prepaid credits — non-transferable, no cash-out — not legal tender."
            />
            <Footnote
              eyebrow="Not legal advice"
              body="AI guidance is general information only, never legal advice. An attorney of record must review your petition before anything is filed with USCIS."
            />
            <Footnote
              eyebrow="Refunds"
              body="Purchased tokens may be reversed on a refund or chargeback. Free signup tokens are one-per-account and may expire."
            />
          </div>
        </Rise>
      </section>

      <SiteFooter />
    </PageFrame>
  );
}

/* ── Components ────────────────────────────────────────────────────────── */

function Footnote({ eyebrow, body }: { eyebrow: string; body: string }) {
  return (
    <div>
      <div className="microprint" style={{ color: "var(--accent-dark)" }}>
        {eyebrow}
      </div>
      <p className="mt-2 font-sans text-[13.5px] leading-relaxed text-muted-strong">
        {body}
      </p>
    </div>
  );
}

/* ── Header + footer (kept local so /billing is a standalone route) ──── */

function SiteHeader() {
  return (
    <header className="relative">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-6">
        <Wordmark context="Petition Atelier · est. 2026" />
        <nav className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-document text-muted-strong">
          <Link href="/" className="ink-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40">
            Home
          </Link>
          <Link href="/faq" className="ink-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40">
            FAQ
          </Link>
          <Link href="/dashboard" className="ink-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40">
            Live case file
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
          © Immigration Concierge · Token ledger · 2026
        </div>
        <div className="microprint flex gap-4">
          <Link className="ink-link" href="/">Home</Link>
          <Link className="ink-link" href="/faq">FAQ</Link>
          <Link className="ink-link" href="/dashboard">Live case</Link>
        </div>
      </div>
    </footer>
  );
}
