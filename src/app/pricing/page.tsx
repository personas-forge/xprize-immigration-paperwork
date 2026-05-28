import type { Metadata } from "next";
import Link from "next/link";
import { PageFrame, Wordmark, Stamp, ChapterMark, Seal } from "@/components/brand";
import { Rise, Stagger, HoverCard } from "@/components/Motion";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Schedule of fees — Immigration Concierge",
  description:
    "Three petition tiers. Flat fees, attorney on record, USCIS pass-through at cost. Self-File, Attorney-Assisted, and Family Reunification.",
};

// — Pricing — three petition tiers as document bands ────────────────────────
// The page is structured as a single Schedule of Fees broadsheet: heading,
// three perforated bands stacked at desktop into a row, then a footnote. The
// middle band is wax-stamped "Most filed" and tinted with gold-leaf accent.

type Tier = {
  id: string;
  name: string;
  classification: string;
  price: string;
  cents?: string;
  cadence: string;
  blurb: string;
  features: string[];
  cta: { label: string; href: string };
  highlight?: boolean;
};

const TIERS: Tier[] = [
  {
    id: "self-file",
    name: "Self-File",
    classification: "I-129 · pro se",
    price: "$99",
    cadence: "one-time",
    blurb:
      "For the candidate who wants to submit on their own and just needs the right paperwork.",
    features: [
      "USCIS-compatible I-129 packet",
      "Evidence checklist for O-1A & O-1B",
      "AI-drafted petition letter",
      "Exhibit index + tab labels",
      "Filing instructions for USCIS lockbox",
      "Email support, business hours",
    ],
    cta: { label: "Start the packet", href: "/#start" },
  },
  {
    id: "attorney-assisted",
    name: "Attorney-Assisted",
    classification: "O-1A · O-1B",
    price: "$1,499",
    cadence: "flat fee",
    blurb:
      "The petition assembled by AI, then read line-by-line and signed by a U.S. immigration attorney before it leaves the door.",
    features: [
      "Everything in Self-File",
      "Attorney of record on USCIS forms",
      "Voice intake + evidence curation",
      "Line-by-line attorney edits & sign-off",
      "Pre-drafted RFE response included",
      "Biometrics scheduling assistance",
      "Direct attorney email + 2 calls",
    ],
    cta: { label: "Reserve a filing slot", href: "/#start" },
    highlight: true,
  },
  {
    id: "family",
    name: "Family Reunification",
    classification: "I-130 · I-485 bundle",
    price: "$2,499",
    cadence: "per family",
    blurb:
      "A full-family workflow — petitions and adjustment-of-status forms, one fee, one attorney across every file.",
    features: [
      "Everything in Attorney-Assisted",
      "Up to four family members per case",
      "I-130 + I-485 + I-765 prep",
      "Affidavit of support (I-864) drafting",
      "Document translation review",
      "Expedited processing guidance",
      "12-month engagement window",
    ],
    cta: { label: "Schedule a consult", href: "/#start" },
  },
];

export default function PricingPage() {
  return (
    <PageFrame>
      <SiteHeader />

      <section className="mx-auto max-w-6xl px-8 pb-10 pt-20">
        <Rise>
          <ChapterMark numeral="III" label="Schedule of fees" />
          <h1 className="display mt-5 max-w-3xl text-[clamp(2.4rem,6vw,4.4rem)]">
            Three petition packets. <em>One honest price</em> on each.
          </h1>
          <p className="mt-6 max-w-2xl font-sans text-[16px] leading-relaxed text-muted-strong">
            No billable hours. No retainer drawdowns. USCIS filing fees are
            passed through at cost; you see the receipt. If you don&apos;t
            qualify, you don&apos;t pay — the qualification call is always free.
          </p>
        </Rise>

        <Stagger className="mt-14 grid grid-cols-1 gap-7 md:grid-cols-3">
          {TIERS.map((t) => (
            <TierBand key={t.id} tier={t} />
          ))}
        </Stagger>

        <Rise className="mt-14">
          <div className="perforation h-px" aria-hidden />
          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            <Footnote
              eyebrow="USCIS fees"
              body="Premium processing ($2,805) and base filing ($510) pass through at cost. Always shown on your receipt."
            />
            <Footnote
              eyebrow="Refund policy"
              body="Full refund any time before the attorney signs. After signature, the attorney portion is non-refundable; the filing fee is still yours."
            />
            <Footnote
              eyebrow="Payment cadence"
              body="50% on engagement, 50% on filing. Wire, ACH, or card. International candidates may pay in two currencies."
            />
          </div>
        </Rise>
      </section>

      <SiteFooter />
    </PageFrame>
  );
}

/* ── Components ────────────────────────────────────────────────────────── */

function TierBand({ tier }: { tier: Tier }) {
  const isHighlight = !!tier.highlight;
  return (
    <HoverCard
      className={`relative flex h-full flex-col rounded-card border bg-surface p-7 shadow-leaf ${
        isHighlight
          ? "border-accent/60 bg-accent-soft/30 shadow-seal"
          : "border-border"
      }`}
    >
      {/* Gold-leaf seal corner on highlighted tier */}
      {isHighlight ? (
        <div className="pointer-events-none absolute -right-3 -top-3 text-accent-dark">
          <div className="rounded-pill bg-surface p-1 shadow-leaf">
            <Seal size={44} />
          </div>
        </div>
      ) : null}

      {/* Wax-stamp ribbon */}
      {isHighlight ? (
        <div className="absolute -top-3 left-6">
          <Stamp label="Most filed" meta="92% of clients" tone="seal" rotate={-4} />
        </div>
      ) : null}

      {/* Heading */}
      <div className="microprint" style={{ color: "var(--accent-dark)" }}>
        {tier.classification}
      </div>
      <h3 className="display mt-3 text-3xl text-foreground">{tier.name}</h3>
      <p className="mt-2 font-sans text-[14px] italic text-muted-strong">
        {tier.blurb}
      </p>

      {/* Price block */}
      <div className="mt-6 flex items-baseline gap-2">
        <span
          className="display text-[3.4rem] text-foreground"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {tier.price}
        </span>
        <span className="microprint" style={{ color: "var(--muted)" }}>
          {tier.cadence}
        </span>
      </div>

      {/* Perforated tear-line divider */}
      <div className="perforation my-6 h-px" aria-hidden />

      {/* Features */}
      <ul className="flex-1 space-y-3 font-sans text-[14.5px] leading-snug">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-3">
            <span
              aria-hidden
              className={`mt-2 inline-block h-px w-3 ${
                isHighlight ? "bg-seal" : "bg-accent-dark"
              }`}
            />
            <span className="text-foreground-soft">{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <Link
        href={tier.cta.href}
        className={`mt-8 inline-flex items-center justify-center gap-2 rounded-control px-5 py-3 font-mono text-[12px] uppercase tracking-document transition-[background-color,border-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40 active:translate-y-[1px] ${
          isHighlight
            ? "bg-seal text-background hover:bg-[color:var(--accent-dark)]"
            : "border border-border-strong bg-transparent text-foreground hover:border-foreground"
        }`}
      >
        {tier.cta.label}
        <span aria-hidden>→</span>
      </Link>
    </HoverCard>
  );
}

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

/* ── Header + footer (kept local so /pricing is a standalone route) ──── */

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
          © Immigration Concierge · Schedule of fees · 2026
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
