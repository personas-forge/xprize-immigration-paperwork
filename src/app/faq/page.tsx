import type { Metadata } from "next";
import Link from "next/link";
import { PageFrame, Wordmark, ChapterMark } from "@/components/brand";
import { Rise } from "@/components/Motion";
import { FaqEntry } from "@/components/FaqEntry";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Frequently asked — Immigration Concierge",
  description:
    "What the AI drafting tool does, who reviews and signs (your own attorney of record), token pricing, RFE handling, accuracy, refunds, and data security. A drafting tool, not a law firm — never legal advice.",
};

// — FAQ — eight entries, sober and specific ────────────────────────────────
// Native <details>/<summary> styled as petition entries; the open animation
// (height + opacity on the inner panel) lives in <FaqEntry>, the only client
// component on the page. Everything else is server-rendered.
//
// Positioning invariant: these answers MUST match the landing/billing/validation
// line — a self-serve, token-metered AI DRAFTING TOOL whose output is work
// product the user's OWN attorney of record reviews and signs. We are not a law
// firm, do not supply counsel, and never give legal advice.

const QA: { q: string; a: string }[] = [
  {
    q: "What exactly does Immigration Concierge do?",
    a: "It's a self-serve AI drafting tool — not a law firm. You describe your background and evidence; the AI screens you against the eight O-1/EB-1A criteria, sorts your exhibits, and drafts the petition letter (the I-129 O-supplement narrative) section by section. What you get is work product: a draft your own attorney of record reviews, edits, and signs before filing. We don't supply the attorney, file on your behalf, or give legal advice.",
  },
  {
    q: "Who reviews and signs the petition?",
    a: "Your own attorney of record — the licensed U.S. immigration attorney you bring, or your firm's. They review every word in the drafting studio, request changes, and when it's ready they sign the I-129 and file it. The studio gives your attorney the review workflow (request changes, sign & file, record the USCIS decision); it does not act as your lawyer or supply one. We're a drafting tool, not a law firm — and nothing here is legal advice.",
  },
  {
    q: "What happens if USCIS issues a Request for Evidence (RFE)?",
    a: "The studio includes an RFE response drafter: paste the RFE and the AI drafts a point-by-point response grounded in your petition's criteria and exhibits. Like every AI operation it's priced in tokens (an RFE response costs 5), and — like the petition draft — it's work product your attorney of record reviews and signs before filing within the USCIS deadline. There's no separate legal-service fee because we don't provide the legal service; your attorney does.",
  },
  {
    q: "How much does it cost?",
    a: "You pay in prepaid tokens — not retainers or flat legal fees — and only for the AI work you actually run. New accounts start with 150 free tokens. A qualification screening costs 3 tokens, a full petition-letter draft 12, a single-section regenerate or an RFE response 5, and evidence categorization 1. Top up with a bundle from $5 (bigger bundles cost less per token). USCIS filing fees are paid by you directly to USCIS, never through us.",
  },
  {
    q: "Is any of this legal advice?",
    a: "No. The AI produces general informational drafting only — never legal advice — and we are not a law firm. Every AI output carries that disclaimer, and an attorney of record must review and sign your petition before anything is filed with USCIS. The legal judgment is your attorney's; the drafting is ours.",
  },
  {
    q: "How current and accurate are the criteria you screen against?",
    a: "The O-1A/O-1B and EB-1A criteria we screen and draft against are mapped to their primary sources (8 CFR 214.2(o)(3)(iii), 204.5(h)(3)) and the USCIS Policy Manual, each with a legal basis, a last-reviewed date, and a freshness check — and a CI gate blocks any program from going live unverified. You can see the citations, legal basis, and review dates yourself on our validation page (/validation).",
  },
  {
    q: "What is your refund policy?",
    a: "Tokens are prepaid credits: a purchase can be reversed on a refund or chargeback, and unused tokens stay in your balance (the one-time free signup grant is one per account). Because we don't charge a legal fee or file on your behalf, there's no attorney retainer to refund — and USCIS filing fees are paid by you directly to USCIS.",
  },
  {
    q: "How is my personal and immigration data protected?",
    a: "Documents are stored encrypted (AES-256 at rest, TLS 1.3 in transit) on U.S.-based servers. Access is limited to you, the attorney of record you designate, and the AI drafting pipeline, and every access is logged. We don't train models on your data and we don't sell anonymized exhibits; you can export or hard-delete everything at any time.",
  },
];

export default function FaqPage() {
  return (
    <PageFrame>
      <SiteHeader />

      <section className="mx-auto max-w-3xl px-6 pb-10 pt-20">
        <Rise>
          <ChapterMark numeral="IV" label="Frequently asked" />
          <h1 className="display mt-5 text-[clamp(2.4rem,6vw,4rem)]">
            What clients ask <em>before signing.</em>
          </h1>
          <p className="mt-6 font-sans text-[16px] leading-relaxed text-muted-strong">
            What people ask most about what the tool does, who signs, and what
            it costs. For how we keep the criteria source-cited and current, see
            the{" "}
            <Link href="/validation" className="ink-link">
              validation page
            </Link>
            .
          </p>
        </Rise>

        <div className="perforation mt-12 h-px" aria-hidden />

        <Rise className="mt-2">
          <ol className="divide-y divide-rule">
            {QA.map((entry, i) => (
              <FaqEntry
                key={entry.q}
                index={i}
                question={entry.q}
                answer={entry.a}
                defaultOpen={i === 0}
              />
            ))}
          </ol>
        </Rise>

        <div className="perforation mt-12 h-px" aria-hidden />

        <Rise className="mt-10 text-center">
          <p className="font-sans text-[17px] leading-relaxed text-muted-strong">
            Still on the fence?
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/#start"
              className="rounded-control bg-foreground px-7 py-3.5 font-mono text-[14px] uppercase tracking-document text-background hover:bg-foreground-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
            >
              Take the qualification
            </Link>
            <Link
              href="/billing"
              className="rounded-control border border-border-strong px-7 py-3.5 font-mono text-[14px] uppercase tracking-document text-foreground hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
            >
              See the fees
            </Link>
          </div>
        </Rise>
      </section>

      <SiteFooter />
    </PageFrame>
  );
}

/* ── Header / footer (local copy; matches /pricing) ──────────────────── */

function SiteHeader() {
  return (
    <header className="relative">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-6">
        <Wordmark context="Petition Atelier · est. 2026" />
        <nav className="flex items-center gap-6 font-mono text-[13px] uppercase tracking-document text-muted-strong">
          <Link href="/" className="ink-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40">
            Home
          </Link>
          <Link href="/billing" className="ink-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40">
            Pricing
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
          © Immigration Concierge · Frequently asked · 2026
        </div>
        <div className="microprint flex gap-4">
          <Link className="ink-link" href="/">Home</Link>
          <Link className="ink-link" href="/billing">Pricing</Link>
          <Link className="ink-link" href="/validation">Validation</Link>
          <Link className="ink-link" href="/dashboard">Live case</Link>
        </div>
      </div>
    </footer>
  );
}
