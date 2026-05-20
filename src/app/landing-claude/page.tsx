import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Immigration Concierge — extraordinary ability, on the record",
  description:
    "AI-drafted, attorney-signed O-1 visa petitions at one-third the cost. $2,500 flat.",
};

// Brand landing — "The petition". The page is styled as an official
// document: ruled margins, Roman-numeral sections, a monogram seal, serif
// display type. Calm, precise, premium.

export default function LandingClaude() {
  return (
    <main className="min-h-screen bg-[#f5f9f8] text-teal-950">
      <div className="mx-auto max-w-3xl px-6">
        {/* masthead */}
        <header className="flex items-center justify-between border-b border-teal-900/15 py-6">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full border border-teal-800 text-sm text-teal-800">
              ✦
            </span>
            <div className="leading-tight">
              <div className="font-display text-lg">Meridian</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-teal-700">
                Immigration Concierge
              </div>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="font-mono text-xs uppercase tracking-widest text-teal-700 underline-offset-4 hover:underline"
          >
            View a live case →
          </Link>
        </header>

        {/* hero */}
        <section className="border-b border-teal-900/15 py-16 text-center">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-teal-600">
            Form I-129 · Classification O-1A
          </div>
          <h1 className="mt-6 font-display text-6xl italic leading-[1.05] sm:text-7xl">
            Extraordinary
            <br />
            ability, on the record.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-teal-900/75">
            The visa petition a firm bills $8,000–$15,000 to assemble — drafted
            by AI from your CV, citations and press, then reviewed and signed
            by a licensed immigration attorney. One flat fee: $2,500.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#criteria"
              className="rounded-sm bg-teal-800 px-6 py-3 text-sm font-semibold tracking-wide text-white"
            >
              Take the free qualification
            </a>
            <Link
              href="/dashboard"
              className="rounded-sm border border-teal-800/40 px-6 py-3 text-sm font-semibold tracking-wide text-teal-900"
            >
              See the case file
            </Link>
          </div>
        </section>

        {/* criteria */}
        <section id="criteria" className="border-b border-teal-900/15 py-14">
          <div className="font-mono text-xs uppercase tracking-[0.25em] text-teal-600">
            § I — The eight criteria
          </div>
          <h2 className="mt-3 font-display text-3xl">
            The statute asks for three. Most of our candidates meet seven.
          </h2>
          <div className="mt-7 grid gap-x-8 gap-y-3 sm:grid-cols-2">
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
                className="flex items-baseline gap-3 border-b border-dashed border-teal-900/15 pb-3"
              >
                <span className="font-mono text-xs text-teal-600">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 text-[15px] leading-snug">{c}</span>
                <span className="text-teal-700">✓</span>
              </div>
            ))}
          </div>
        </section>

        {/* process */}
        <section className="border-b border-teal-900/15 py-14">
          <div className="font-mono text-xs uppercase tracking-[0.25em] text-teal-600">
            § II — How the petition is built
          </div>
          <ol className="mt-6 space-y-6">
            {[
              ["I", "Qualify", "A five-minute self-check, then a 45-minute voice interview. Free. We tell you yes, no, or maybe — honestly."],
              ["II", "Assemble", "Upload your CV. AI gathers press, citations and GitHub, then drafts the petition letter, I-129 and 28 exhibits."],
              ["III", "Sign", "Your attorney of record reviews every word, edits where judgment is needed, and signs."],
              ["IV", "File", "E-filed with premium processing. RFE responses are pre-drafted and included at no charge."],
            ].map(([num, title, body]) => (
              <li key={num} className="flex gap-5">
                <span className="font-display text-4xl italic text-teal-700">
                  {num}
                </span>
                <div className="border-l border-teal-900/15 pl-5">
                  <div className="font-display text-2xl">{title}</div>
                  <p className="mt-1 text-[15px] leading-relaxed text-teal-900/75">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* assurance */}
        <section className="border-b border-teal-900/15 py-14">
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              ["$2,500", "Flat fee — no billable hours, ever. USCIS fees passed through at cost."],
              ["21 days", "Median time from intake to a filing-ready petition."],
              ["Attorney", "of record on every case. AI gathers and drafts; the lawyer judges and signs."],
            ].map(([big, small]) => (
              <div key={big} className="text-center">
                <div className="font-display text-4xl italic text-teal-800">
                  {big}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-teal-900/70">
                  {small}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* close */}
        <section className="py-16 text-center">
          <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-full border-2 border-teal-800 font-display text-xl italic text-teal-800">
            M
          </div>
          <h2 className="font-display text-4xl italic">
            Find out if you qualify — today, for free.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-teal-900/70">
            If the answer is no, you pay nothing and you&apos;ll know exactly
            what would change it.
          </p>
          <a
            href="#criteria"
            className="mt-7 inline-block rounded-sm bg-teal-800 px-7 py-3 text-sm font-semibold tracking-wide text-white"
          >
            Begin qualification
          </a>
        </section>

        <footer className="border-t border-teal-900/15 py-7 text-center font-mono text-[11px] uppercase tracking-widest text-teal-700">
          Meridian Immigration Concierge · attorney-owned · 2026
        </footer>
      </div>
    </main>
  );
}
