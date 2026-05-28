import type { Metadata } from "next";
import Link from "next/link";
import { PageFrame, Wordmark, ChapterMark } from "@/components/brand";
import { Rise } from "@/components/Motion";
import { FaqEntry } from "@/components/FaqEntry";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Frequently asked — Immigration Concierge",
  description:
    "USCIS form compatibility, attorney review, RFE handling, document translation, biometrics, expedited processing, refund policy, and data security.",
};

// — FAQ — eight entries, sober and specific ────────────────────────────────
// Native <details>/<summary> styled as petition entries; the open animation
// (height + opacity on the inner panel) lives in <FaqEntry>, the only client
// component on the page. Everything else is server-rendered.

const QA: { q: string; a: string }[] = [
  {
    q: "Which USCIS forms do you prepare and file?",
    a: "Every Attorney-Assisted and Family Reunification engagement files the I-129 (with the O-supplement) for nonimmigrant petitions, plus the I-907 for premium processing. Family bundles include the I-130, I-485 adjustment package, I-765 employment authorization, and the I-864 affidavit of support. Self-File supports I-129; we do not file pro se on family bundles.",
  },
  {
    q: "How does the attorney review actually work?",
    a: "Once Gemini drafts your petition letter and assembles the exhibits, a licensed U.S. immigration attorney — the same attorney listed as counsel of record — reads the petition line by line. They rewrite paragraphs that need legal judgment, verify every exhibit citation, and sign the I-129 themselves. Median turnaround is five business days; you can request changes before they sign.",
  },
  {
    q: "What happens if USCIS issues a Request for Evidence (RFE)?",
    a: "Pre-drafted RFE responses are included on every Attorney-Assisted and Family Reunification packet. If an RFE arrives, your attorney refines the draft to match the adjudicator's specific concerns and files within the 87-day USCIS window. There is no separate billing for RFE response — it's part of the flat fee.",
  },
  {
    q: "Do you handle document translation?",
    a: "We don't translate documents in-house, but we review every certified translation our clients provide and flag wording that could trigger an RFE. We maintain a vetted bench of ATA-certified translators for Mandarin, Spanish, Portuguese, Hindi, Russian, and Arabic — pricing is theirs, not ours, and you contract with them directly.",
  },
  {
    q: "Who handles biometrics scheduling and how long does it take?",
    a: "After USCIS issues a biometrics notice (typically 4–6 weeks post-filing), we coordinate the Application Support Center appointment, prep you on what to bring, and confirm completion against your file. If you're abroad at filing, we route the appointment to your nearest U.S. consulate. The appointment itself is short — usually under 30 minutes.",
  },
  {
    q: "Can you file with premium processing?",
    a: "Yes, and we recommend it on most O-1 petitions. The USCIS premium processing fee ($2,805) is passed through at cost; we don't mark it up. With premium, USCIS commits to a decision in 15 business days. We file on the same day the attorney signs.",
  },
  {
    q: "What is your refund policy?",
    a: "Full refund any time before the attorney signs your I-129 — this includes refunds after intake, after the AI draft is delivered, and even after attorney review begins. Once the attorney signs, the attorney portion of the flat fee is non-refundable, but USCIS filing fees (whether or not we've already submitted them) are returned to you if the case has not yet been filed.",
  },
  {
    q: "How is my personal and immigration data protected?",
    a: "All client documents are stored in encrypted vaults (AES-256 at rest, TLS 1.3 in transit) on U.S.-based servers. Access is logged and limited to your attorney of record and the AI drafting pipeline. We do not train models on your data, we do not sell anonymized exhibits, and you can request a complete export or hard-delete at any time. We comply with attorney-client privilege under the Model Rules of Professional Conduct.",
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
            The eight questions we hear on every qualification call. If yours
            isn&apos;t here, reply to any email — your attorney of record
            answers directly, in writing.
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
          <p className="font-sans text-[15px] leading-relaxed text-muted-strong">
            Still on the fence?
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/#start"
              className="rounded-control bg-foreground px-7 py-3.5 font-mono text-[12px] uppercase tracking-document text-background hover:bg-foreground-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
            >
              Take the qualification
            </Link>
            <Link
              href="/pricing"
              className="rounded-control border border-border-strong px-7 py-3.5 font-mono text-[12px] uppercase tracking-document text-foreground hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
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
        <nav className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-document text-muted-strong">
          <Link href="/" className="ink-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40">
            Home
          </Link>
          <Link href="/pricing" className="ink-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40">
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
          <Link className="ink-link" href="/pricing">Pricing</Link>
          <Link className="ink-link" href="/dashboard">Live case</Link>
        </div>
      </div>
    </footer>
  );
}
