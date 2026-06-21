import type { Metadata } from "next";
import Link from "next/link";
import {
  PageFrame,
  Wordmark,
  Seal,
  Guilloche,
  ChapterMark,
  Stamp,
} from "@/components/brand";
import { FREE_SIGNUP_GRANT } from "@/lib/tokens/economy";

export const metadata: Metadata = {
  title: "Immigration Concierge — extraordinary ability, on the record",
  description:
    "AI-drafted O-1 and EB-1A extraordinary-ability petitions, ready for your attorney of record to review and sign. Start free — prepaid tokens, no retainers.",
  // This is an ALTERNATE masthead of the homepage `/`, kept for design reference.
  // Keep it out of the index and point its canonical at `/` so search engines
  // don't treat it as duplicate content competing with the real landing page
  // (marketing #4). It is also no longer linked from the shared site footer.
  robots: { index: false, follow: false },
  alternates: { canonical: "/" },
};

// Alt landing — narrow editorial column. The page is composed as a printed
// pamphlet: a centered seal masthead, italic display headlines, ruled
// chapter marks, a perforated tear-line every section, and a closing seal.

export default function LandingClaude() {
  return (
    <PageFrame>
      <div className="mx-auto max-w-3xl px-6">
        {/* masthead */}
        <header className="flex items-center justify-between py-8">
          <Wordmark context="Atelier of Arrival · 2026" size={34} />
          <Link
            href="/dashboard"
            className="ink-link microprint"
            style={{ color: "var(--muted-strong)" }}
          >
            View a live case →
          </Link>
        </header>

        <div className="perforation h-px" aria-hidden />

        {/* hero */}
        <section className="py-20 text-center">
          <div className="microprint" style={{ color: "var(--accent-dark)" }}>
            Form I-129 · Classification O-1A
          </div>
          <h1
            data-animate="ink-rise"
            className="display mt-6 text-[clamp(2.6rem,9vw,5.4rem)]"
          >
            Extraordinary
            <br />
            <em>ability,</em> on the record.
          </h1>
          <p
            data-animate="ink-rise"
            style={{ "--delay": "180ms" } as React.CSSProperties}
            className="mx-auto mt-8 max-w-xl font-sans text-[16.5px] leading-relaxed text-muted-strong"
          >
            The visa petition a firm bills $8,000–$15,000 to assemble — drafted
            by AI from your CV, citations and press, then handed to <em>your</em>
            attorney of record to review and sign. Start free; pay only for the
            tokens you use — never legal advice.
          </p>
          <div
            data-animate="ink-rise"
            style={{ "--delay": "360ms" } as React.CSSProperties}
            className="mt-10 flex flex-wrap items-center justify-center gap-3"
          >
            <Link
              href="/qualify"
              className="rounded-control bg-foreground px-7 py-3.5 font-mono text-[14px] uppercase tracking-document text-background hover:bg-foreground-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Take the free qualification
            </Link>
            <Link
              href="/dashboard"
              className="rounded-control border border-border-strong px-7 py-3.5 font-mono text-[14px] uppercase tracking-document text-foreground hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              See the case file
            </Link>
          </div>
        </section>

        <div className="perforation h-px" aria-hidden />

        {/* criteria */}
        <section id="criteria" className="py-16">
          <ChapterMark numeral="I" label="The eight criteria" />
          <h2 className="display mt-4 text-3xl">
            The statute asks for three. <em>Your job is to clearly establish three.</em>
          </h2>
          <div className="mt-8 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {[
              "Nationally recognized awards",
              "Membership in selective associations",
              "Published material about you",
              "Judging the work of others",
              "Original contributions of major significance",
              "Authorship of scholarly articles",
              "Critical role at distinguished organizations",
              "High remuneration relative to the field",
            ].map((c, i) => (
              <div
                key={c}
                className="flex items-baseline gap-3 border-b border-dotted border-rule pb-3"
              >
                <span className="doc-number text-[13px] text-muted">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 font-sans text-[16.5px] leading-snug">
                  {c}
                </span>
                <span className="text-success">✓</span>
              </div>
            ))}
          </div>
        </section>

        <div className="perforation h-px" aria-hidden />

        {/* process */}
        <section className="py-16">
          <ChapterMark numeral="II" label="How the petition is built" />
          <ol className="mt-8 space-y-7">
            {[
              ["I", "Qualify", "A five-minute self-check that maps your record onto the right criteria (O-1A, O-1B, or EB-1A). Free. We tell you yes, no, or maybe — honestly."],
              ["II", "Assemble", "Upload your CV and evidence. AI sorts each document by criterion, then drafts the petition letter section by section."],
              ["III", "Sign", "Your own attorney of record reviews every word, edits where judgment is needed, and signs — you own the filing."],
              ["IV", "File", "Your attorney files with premium processing. Draft RFE responses in the studio if USCIS asks for more evidence."],
            ].map(([num, title, body]) => (
              <li key={num} className="flex gap-6">
                <span className="display w-12 shrink-0 text-5xl italic text-accent-dark">
                  {num}
                </span>
                <div className="border-l border-rule pl-6">
                  <h3 className="display text-2xl">{title}</h3>
                  <p className="mt-1.5 font-sans text-[17px] leading-relaxed text-muted-strong">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className="perforation h-px" aria-hidden />

        {/* assurance */}
        <section className="py-16">
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              [`${FREE_SIGNUP_GRANT} free`, "tokens on signup — no card to start. Prepaid tokens after, no retainers, no subscriptions."],
              ["Minutes", "from upload to a drafted petition letter, in a single AI pass."],
              ["Your attorney", "of record reviews and signs. We draft; your lawyer owns the filing — never legal advice."],
            ].map(([big, small]) => (
              <div key={big} className="text-center">
                <div className="display text-4xl italic text-accent-dark">
                  {big}
                </div>
                <div className="mx-auto mt-2 h-px w-8 bg-accent-dark/50" />
                <p className="mt-3 font-sans text-[15.5px] leading-relaxed text-muted-strong">
                  {small}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="perforation h-px" aria-hidden />

        {/* close */}
        <section className="py-20 text-center">
          <div
            data-animate="seal"
            className="mx-auto mb-8 inline-block text-accent-dark"
          >
            <Seal size={84} />
          </div>
          <h2 className="display text-[clamp(2rem,6vw,3.6rem)]">
            Find out if you qualify — <em>today,</em> for free.
          </h2>
          <p className="mx-auto mt-5 max-w-md font-sans text-[17.5px] leading-relaxed text-muted-strong">
            If the answer is no, you pay nothing and you&apos;ll know exactly
            what would change it.
          </p>
          <div className="mt-9 flex items-center justify-center gap-4">
            <Link
              href="/qualify"
              className="rounded-control bg-seal px-7 py-3.5 font-mono text-[14px] uppercase tracking-document text-background shadow-seal hover:bg-[color:var(--accent-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Begin qualification
            </Link>
            <Stamp label="Start free" meta={`${FREE_SIGNUP_GRANT} tokens`} tone="indigo" rotate={5} />
          </div>
        </section>

        <div className="perforation h-px" aria-hidden />

        <footer className="py-8 text-center">
          <div className="microprint" style={{ color: "var(--muted-strong)" }}>
            Immigration Concierge · AI drafting for O-1 / EB-1 · not a law firm, never legal advice · 2026
          </div>
          <div className="microprint mt-3 flex flex-wrap items-center justify-center gap-4">
            <Link className="ink-link" href="/faq">FAQ</Link>
            <Link className="ink-link" href="/billing">Pricing</Link>
            <Link className="ink-link" href="/validation">Validation</Link>
          </div>
          <div className="mt-2 inline-flex items-center gap-2 text-accent-dark opacity-60">
            <Guilloche size={28} rings={4} />
          </div>
        </footer>
      </div>
    </PageFrame>
  );
}
