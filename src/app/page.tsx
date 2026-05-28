import Link from "next/link";
import {
  PageFrame,
  Wordmark,
  Stamp,
  ChapterMark,
  Guilloche,
} from "@/components/brand";

// Marketing landing — "The Petition". The page is composed as if the
// product itself were a formal document: an opening seal, ruled chapter
// marks, italic display headlines, a watermarked hero, a sealed price block.
// Same copy as the legacy page (no business changes); fresh chrome.

export default function Page() {
  return (
    <PageFrame>
      <SiteHeader />

      <Hero />
      <Promises />
      <Process />
      <Pricing />
      <Closing />

      <SiteFooter />
    </PageFrame>
  );
}

/* ── Header ─────────────────────────────────────────────────────────────── */

function SiteHeader() {
  return (
    <header className="relative">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-6">
        <Wordmark context="Petition Atelier · est. 2026" />
        <nav className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-document text-muted-strong">
          <a href="#how" className="ink-link">How it works</a>
          <a href="#pricing" className="ink-link">Schedule of fees</a>
          <Link href="/dashboard" className="ink-link">Live case file</Link>
          <a
            href="#start"
            className="rounded-control border border-foreground bg-foreground px-4 py-2 text-background transition-[background-color] hover:bg-foreground-soft"
          >
            Free qualification
          </a>
        </nav>
      </div>
      <div className="perforation mx-8 h-px" aria-hidden />
    </header>
  );
}

/* ── Hero ──────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative">
      <div className="mx-auto grid max-w-6xl grid-cols-12 gap-8 px-8 pb-28 pt-20">
        <div className="col-span-12 lg:col-span-8">
          <div
            data-animate="ribbon"
            className="microprint flex items-center gap-3"
            style={{ color: "var(--accent-dark)" }}
          >
            <span className="inline-block h-px w-10 bg-accent-dark" />
            File №&nbsp;O1-241 · For founders · engineers · researchers · designers
          </div>

          <h1
            data-animate="ink-rise"
            className="display mt-7 text-[clamp(2.6rem,8.4vw,6.6rem)] text-foreground"
            style={{ "--delay": "120ms" } as React.CSSProperties}
          >
            Your O&#8209;1 visa,
            <br />
            <em>drafted with care</em>
            <br />
            and <span className="inline-block relative">
              countersigned
              <span
                data-animate="underline"
                aria-hidden
                className="absolute -bottom-2 left-0 h-[3px] w-full bg-accent-dark"
              />
            </span>.
          </h1>

          <p
            data-animate="ink-rise"
            className="mt-8 max-w-2xl font-sans text-[17px] leading-relaxed text-foreground-soft initial"
            style={{ "--delay": "350ms" } as React.CSSProperties}
          >
            The same petition packet a firm would charge $8,000 to $15,000 to
            assemble — written by Gemini from your CV, GitHub, press and
            publications, then reviewed and signed by a licensed immigration
            attorney before it lands at USCIS.
          </p>

          <div
            data-animate="ink-rise"
            className="mt-10 flex flex-wrap items-center gap-4"
            style={{ "--delay": "520ms" } as React.CSSProperties}
          >
            <a
              href="#start"
              className="inline-flex items-center gap-2 rounded-control bg-foreground px-7 py-3.5 font-mono text-[12px] uppercase tracking-document text-background transition-transform hover:-translate-y-[2px]"
            >
              Take the 5-min qualification
              <span aria-hidden>→</span>
            </a>
            <a
              href="/docs/BACKLOG.md"
              className="inline-flex items-center gap-2 rounded-control border border-border-strong bg-transparent px-7 py-3.5 font-mono text-[12px] uppercase tracking-document text-foreground hover:border-foreground"
            >
              Read the 12-week build plan
            </a>
            <span className="microprint" style={{ color: "var(--muted-strong)" }}>
              Free if you don&apos;t qualify · 50% upfront, 50% on filing
            </span>
          </div>
        </div>

        {/* Hero card — engraved certificate vignette */}
        <aside
          data-animate="seal"
          style={{ "--delay": "240ms" } as React.CSSProperties}
          className="col-span-12 lg:col-span-4"
        >
          <div className="relative aspect-[3/4] overflow-hidden rounded-card border border-border-strong bg-surface guilloche">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 grid place-items-center text-accent-dark opacity-30"
            >
              <Guilloche size={420} rings={9} />
            </div>
            <div className="relative z-10 flex h-full flex-col justify-between p-7">
              <div>
                <div className="microprint" style={{ color: "var(--accent-dark)" }}>
                  United States Citizenship &amp; Immigration Services
                </div>
                <div className="display mt-3 text-3xl">
                  Form <em>I-129</em>
                </div>
                <div className="microprint mt-1.5">
                  Petition for nonimmigrant worker · O-1A
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between border-b border-dotted border-rule pb-1">
                  <span className="microprint">Petitioner</span>
                  <span className="font-sans text-[13px] italic">Dr. A. Krishnan</span>
                </div>
                <div className="flex items-baseline justify-between border-b border-dotted border-rule pb-1">
                  <span className="microprint">Classification</span>
                  <span className="doc-number text-[12px]">O-1A · Sciences</span>
                </div>
                <div className="flex items-baseline justify-between border-b border-dotted border-rule pb-1">
                  <span className="microprint">Status</span>
                  <span className="font-mono text-[11px] uppercase tracking-document text-success">
                    Filing-ready
                  </span>
                </div>
                <div className="flex items-baseline justify-between border-b border-dotted border-rule pb-1">
                  <span className="microprint">Attorney</span>
                  <span className="font-sans text-[13px] italic">J. Park, Esq.</span>
                </div>
              </div>

              <div className="flex items-end justify-between">
                <div className="microprint" style={{ color: "var(--muted)" }}>
                  Case №<span className="doc-number"> O1-241</span>
                </div>
                <Stamp label="Approved" meta="92% likelihood" rotate={-4} />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

/* ── Promises strip ────────────────────────────────────────────────────── */

function Promises() {
  const items = [
    {
      n: "I",
      t: "70% cheaper",
      b: "$2,500 flat vs. $8K–15K typical firm. We pass the USCIS fees through at cost. No surprise add-ons.",
    },
    {
      n: "II",
      t: "Faster — 21 days median",
      b: "Voice agent does the 45-min discovery; Gemini drafts the petition in hours; attorney reviews & signs within 5 business days.",
    },
    {
      n: "III",
      t: "Real attorney, real bar",
      b: "Every petition is signed by a licensed U.S. immigration attorney who is on record with USCIS. We are not a DIY tool.",
    },
  ];
  return (
    <section className="relative border-y border-border bg-surface/60 guilloche">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-x-12 gap-y-10 px-8 py-20 md:grid-cols-3">
        {items.map((b) => (
          <article key={b.t}>
            <span className="display block text-2xl italic text-accent-dark">{b.n}</span>
            <div className="mt-2 h-px w-10 bg-accent-dark/60" />
            <h3 className="display mt-4 text-3xl">{b.t}</h3>
            <p className="mt-3 font-sans text-[15px] leading-relaxed text-muted-strong">
              {b.b}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ── Process ───────────────────────────────────────────────────────────── */

function Process() {
  const steps: [string, string, string][] = [
    ["I", "Qualify", "5-min self-check + voice interview. Free. We tell you yes/no/maybe with honest reasoning."],
    ["II", "Assemble", "Upload CV. We pull press, citations, GitHub. Gemini drafts the petition + 28 exhibits + I-129."],
    ["III", "Sign", "Your attorney of record reviews every word, edits where needed, signs the I-129 and the cover letter."],
    ["IV", "File", "Premium processing recommended. 15 business days to decision. We pre-draft RFE responses just in case."],
  ];

  return (
    <section id="how" className="mx-auto max-w-6xl px-8 py-28">
      <ChapterMark numeral="II" label="How the petition is built" />
      <h2 className="display mt-5 max-w-3xl text-[clamp(2.2rem,5.6vw,3.8rem)]">
        From your inbox to <em>USCIS</em>, in four hand-checked passes.
      </h2>

      <ol className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-card border border-border bg-border-strong sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(([n, t, b], i) => (
          <li
            key={t}
            className="group relative flex flex-col bg-surface p-6 transition-[background-color] duration-300 hover:bg-accent-soft/40"
          >
            <div className="flex items-baseline justify-between">
              <span className="display text-4xl italic text-accent-dark">{n}</span>
              <span className="microprint" style={{ color: "var(--muted)" }}>
                Step {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <h3 className="display mt-6 text-2xl">{t}</h3>
            <p className="mt-2 font-sans text-[14px] leading-relaxed text-muted-strong">
              {b}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ── Pricing ───────────────────────────────────────────────────────────── */

function Pricing() {
  return (
    <section id="pricing" className="relative border-t border-border bg-background-tint/60">
      <div className="mx-auto max-w-6xl px-8 py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <ChapterMark numeral="III" label="Schedule of fees" />
            <h2 className="display mt-5 max-w-3xl text-[clamp(2.2rem,5.6vw,3.8rem)]">
              Flat. <em>Honest.</em> No hours billed.
            </h2>
          </div>
          <Stamp label="Bar-licensed" meta="On record · USCIS" tone="seal" rotate={4} />
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          <Plan
            title="O-1A"
            price="$2,500"
            sub="Extraordinary ability · sciences, business, athletics"
            lines={[
              "Voice intake + evidence vault",
              "Full petition + I-129 drafted",
              "Attorney sign-off + e-filing",
              "RFE drafting included",
            ]}
            highlight
          />
          <Plan
            title="O-1B"
            price="$3,500"
            sub="Extraordinary achievement · arts"
            lines={[
              "Stronger evidence curation",
              "Industry expert letter drafts",
              "Everything in O-1A",
            ]}
          />
          <Plan
            title="EB-1A"
            price="$4,500"
            sub="Green-card self-petition"
            lines={[
              "12-month engagement",
              "RFE & motion handling",
              "Adjustment-of-status support",
            ]}
          />
        </div>
        <p className="microprint mt-10" style={{ color: "var(--muted-strong)" }}>
          USCIS premium processing fee ($2,805) passthrough at cost. Free
          qualification call. Attorney on record from day&nbsp;1.
        </p>
      </div>
    </section>
  );
}

/* ── Closing ───────────────────────────────────────────────────────────── */

function Closing() {
  return (
    <section
      id="start"
      className="relative mx-auto max-w-6xl px-8 py-28 text-center"
    >
      <div className="relative inline-block">
        <h2 className="display text-[clamp(2.4rem,7vw,5rem)]">
          Find out if you qualify — <em>today,</em> for free.
        </h2>
      </div>
      <p className="mx-auto mt-6 max-w-xl font-sans text-[16px] leading-relaxed text-muted-strong">
        If the answer is no, you pay nothing and you&apos;ll know exactly what
        would change it.
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <a
          href="#start"
          className="rounded-control bg-seal px-8 py-4 font-mono text-[12px] uppercase tracking-document text-background shadow-seal transition-transform hover:-translate-y-[2px]"
        >
          Begin qualification
        </a>
        <Link
          href="/dashboard"
          className="rounded-control border border-border-strong px-8 py-4 font-mono text-[12px] uppercase tracking-document text-foreground hover:border-foreground"
        >
          See the case file
        </Link>
      </div>
    </section>
  );
}

/* ── Footer ────────────────────────────────────────────────────────────── */

function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface/50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-8 py-8">
        <div className="microprint">
          © Immigration Concierge · XPrize hackathon · 90-day MVP
        </div>
        <div className="microprint flex gap-4">
          <a className="ink-link" href="/docs/BACKLOG.md">
            Backlog
          </a>
          <a className="ink-link" href="/docs/CHECKLIST.md">
            Checklist
          </a>
          <Link className="ink-link" href="/landing-claude">
            Alt. masthead
          </Link>
        </div>
      </div>
    </footer>
  );
}

/* ── Plan card ─────────────────────────────────────────────────────────── */

function Plan({
  title,
  price,
  sub,
  lines,
  highlight,
}: {
  title: string;
  price: string;
  sub: string;
  lines: string[];
  highlight?: boolean;
}) {
  return (
    <article
      className={`lift relative flex flex-col rounded-card border bg-surface p-6 ${
        highlight ? "border-accent/50 shadow-leaf" : "border-border"
      }`}
    >
      {highlight ? (
        <div className="absolute -top-3 left-6">
          <Stamp label="Most chosen" tone="accent" rotate={-3} />
        </div>
      ) : null}
      <div className="microprint" style={{ color: "var(--accent-dark)" }}>
        {title}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="display text-5xl">{price}</span>
        <span className="microprint" style={{ color: "var(--muted)" }}>
          flat
        </span>
      </div>
      <div className="font-sans text-[13px] italic text-muted-strong">{sub}</div>

      <div className="my-5 perforation h-px" aria-hidden />

      <ul className="space-y-2.5 font-sans text-[14px]">
        {lines.map((l) => (
          <li key={l} className="flex items-start gap-3">
            <span aria-hidden className="mt-1 inline-block h-px w-3 bg-accent-dark" />
            <span className="leading-snug">{l}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
