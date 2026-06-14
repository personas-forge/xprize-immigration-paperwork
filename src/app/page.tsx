import Image from "next/image";
import Link from "next/link";
import {
  PageFrame,
  Wordmark,
  Stamp,
  ChapterMark,
  Guilloche,
} from "@/components/brand";
import { Rise, Stagger, HoverCard } from "@/components/Motion";
import { PetitionStepper } from "@/components/PetitionStepper";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BUNDLES, FREE_SIGNUP_GRANT } from "@/lib/tokens/economy";

// Marketing landing — "The Petition". The page is composed as if the
// product itself were a formal document: an opening seal, ruled chapter
// marks, italic display headlines, a watermarked hero, a sealed price block.
//
// Pricing/positioning reflects what the product ACTUALLY is: a self-serve,
// token-metered AI drafting tool. The petition is AI-drafted work product that
// the user's OWN attorney of record reviews and signs — the tool does not
// provide the attorney or give legal advice. The pricing block is driven from
// the canonical token BUNDLES (economy.ts) so it can't drift from /billing.

export default function Page() {
  return (
    <PageFrame>
      <SiteHeader />

      <Hero />
      <PetitionStepper />
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
          <Link href="/dashboard" className="ink-link whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40">Live case file</Link>
          <Link href="/login" className="ink-link whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40">Sign in</Link>
          <Link
            href="/qualify"
            className="whitespace-nowrap rounded-control border border-foreground bg-foreground px-4 py-2 text-background transition-[background-color] hover:bg-foreground-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
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

/* ── Hero ──────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative">
      <Image
        src="/brand/hero-bg.png"
        alt=""
        aria-hidden
        width={1536}
        height={1024}
        sizes="(max-width: 1280px) 80vw, 1024px"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-auto max-w-5xl opacity-[0.10] mix-blend-multiply"
      />
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
            The petition packet a firm would charge $8,000 to $15,000 to
            assemble — drafted by AI from your CV, GitHub, press and
            publications, structured across the eight O-1 criteria. It&apos;s
            work product, ready for <em>your</em> attorney of record to review
            and sign before filing — informational drafting, never legal advice.
          </p>

          <div
            data-animate="ink-rise"
            className="mt-10 flex flex-wrap items-center gap-4"
            style={{ "--delay": "520ms" } as React.CSSProperties}
          >
            <Link
              href="/qualify"
              className="inline-flex items-center gap-2 rounded-control bg-foreground px-7 py-3.5 font-mono text-[14px] uppercase tracking-document text-background transition-transform hover:-translate-y-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
            >
              Take the 5-min qualification
              <span aria-hidden>→</span>
            </Link>
            <span className="microprint" style={{ color: "var(--muted-strong)" }}>
              Free 5-min screening · {FREE_SIGNUP_GRANT} tokens on signup · pay only for what you draft
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
                  <span className="font-sans text-[15px] italic">Dr. A. Krishnan</span>
                </div>
                <div className="flex items-baseline justify-between border-b border-dotted border-rule pb-1">
                  <span className="microprint">Classification</span>
                  <span className="doc-number text-[14px]">O-1A · Sciences</span>
                </div>
                <div className="flex items-baseline justify-between border-b border-dotted border-rule pb-1">
                  <span className="microprint">Status</span>
                  <span className="font-mono text-[13px] uppercase tracking-document text-success">
                    Filing-ready
                  </span>
                </div>
                <div className="flex items-baseline justify-between border-b border-dotted border-rule pb-1">
                  <span className="microprint">Attorney</span>
                  <span className="font-sans text-[15px] italic">J. Park, Esq.</span>
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
      t: "Pay only for what you draft",
      b: "Prepaid tokens, not retainers — a fraction of the $8K–15K a firm bills to assemble the same packet. New accounts start free; top up a bundle when you need more.",
    },
    {
      n: "II",
      t: "Drafted in minutes",
      b: "AI classifies your evidence across the eight O-1 criteria and drafts the petition letter section by section, in one pass. You and your attorney refine from there.",
    },
    {
      n: "III",
      t: "Your attorney signs — you own the filing",
      b: "Every draft is work product for your own attorney of record to review and sign before it reaches USCIS. We're a drafting tool, not a law firm — and never legal advice.",
    },
  ];
  return (
    <section className="relative border-y border-border bg-surface/60 guilloche">
      <Stagger className="mx-auto grid max-w-6xl grid-cols-1 gap-x-12 gap-y-10 px-8 py-20 md:grid-cols-3">
        {items.map((b) => (
          <Rise key={b.t}>
            <article>
              <span className="display block text-2xl italic text-accent-dark">{b.n}</span>
              <div className="mt-2 h-px w-10 bg-accent-dark/60" />
              <h3 className="display mt-4 text-3xl">{b.t}</h3>
              <p className="mt-3 font-sans text-[17px] leading-relaxed text-muted-strong">
                {b.b}
              </p>
            </article>
          </Rise>
        ))}
      </Stagger>
    </section>
  );
}

/* ── Process ───────────────────────────────────────────────────────────── */

function Process() {
  const steps: [string, string, string][] = [
    ["I", "Qualify", "5-min self-check that scores the eight O-1 criteria. Free. You get a yes/no/maybe with honest reasoning."],
    ["II", "Assemble", "Upload your CV and evidence. AI sorts each document into a criterion and drafts the petition letter, section by section."],
    ["III", "Review & sign", "Your own attorney of record reviews every word in the studio, edits where needed, and signs — the tool drafts, your attorney owns the filing."],
    ["IV", "File", "Your attorney files with USCIS; premium processing is ~15 business days to decision. Draft RFE responses in the studio if more evidence is requested."],
  ];

  return (
    <section id="how" className="mx-auto max-w-6xl px-8 py-28">
      <Rise>
        <ChapterMark numeral="II" label="How the petition is built" />
        <h2 className="display mt-5 max-w-3xl text-[clamp(2.2rem,5.6vw,3.8rem)]">
          From your inbox to <em>USCIS</em>, in four hand-checked passes.
        </h2>
      </Rise>

      <Stagger
        className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-card border border-border bg-border-strong sm:grid-cols-2 lg:grid-cols-4"
        role="list"
      >
        {steps.map(([n, t, b], i) => (
          <Rise
            key={t}
            role="listitem"
            className="group relative flex flex-col bg-surface p-6 transition-[background-color] duration-300 hover:bg-accent-soft/40"
          >
            <div className="flex items-baseline justify-between">
              <span className="display text-4xl italic text-accent-dark">{n}</span>
              <span className="microprint" style={{ color: "var(--muted)" }}>
                Step {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <h3 className="display mt-6 text-2xl">{t}</h3>
            <p className="mt-2 font-sans text-[16px] leading-relaxed text-muted-strong">
              {b}
            </p>
          </Rise>
        ))}
      </Stagger>
    </section>
  );
}

/* ── Pricing ───────────────────────────────────────────────────────────── */

function Pricing() {
  // One-time top-up bundles (the recurring monthly plan lives on /billing).
  const bundles = BUNDLES.filter((b) => !b.recurring);
  return (
    <section id="pricing" className="relative border-t border-border bg-background-tint/60">
      <div className="mx-auto max-w-6xl px-8 py-24">
        <Rise>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <ChapterMark numeral="III" label="Token ledger" />
              <h2 className="display mt-5 max-w-3xl text-[clamp(2.2rem,5.6vw,3.8rem)]">
                Pay for <em>exactly what you draft.</em>
              </h2>
              <p className="mt-4 max-w-2xl font-sans text-[17px] text-muted-strong">
                No retainers, no subscriptions. New accounts start with{" "}
                <span className="doc-number text-foreground">{FREE_SIGNUP_GRANT}</span>{" "}
                free tokens; top up a bundle when you need more — bigger bundles
                cost less per token.{" "}
                <Link
                  href="/billing"
                  className="ink-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
                >
                  See the token ledger →
                </Link>
              </p>
            </div>
            <Stamp label="Start free" meta={`${FREE_SIGNUP_GRANT} tokens`} tone="seal" rotate={4} />
          </div>
        </Rise>

        <Stagger className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {bundles.map((b) => (
            <Rise key={b.key}>
              <BundleCard
                label={b.label}
                price={b.priceLabel}
                tokens={b.tokens}
                discount={b.discountLabel}
                highlight={b.key === "pro"}
              />
            </Rise>
          ))}
        </Stagger>
        <p className="microprint mt-10" style={{ color: "var(--muted-strong)" }}>
          Tokens fund the AI drafting tools — a full petition draft spends more
          than a single form-field answer. USCIS filing fees are paid directly to
          USCIS. Informational drafting only, never legal advice; your attorney of
          record reviews before anything is filed.
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
      <Rise>
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
          <Link
            href="/qualify"
            className="rounded-control bg-seal px-8 py-4 font-mono text-[14px] uppercase tracking-document text-background shadow-seal transition-transform hover:-translate-y-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
          >
            Begin qualification
          </Link>
          <Link
            href="/dashboard"
            className="rounded-control border border-border-strong px-8 py-4 font-mono text-[14px] uppercase tracking-document text-foreground hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
          >
            See the case file
          </Link>
        </div>
      </Rise>
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
        <div className="microprint flex flex-wrap items-center gap-4">
          <a className="ink-link" href="#how">How it works</a>
          <Link className="ink-link" href="/billing">Pricing</Link>
          <Link className="ink-link" href="/faq">FAQ</Link>
          <Link className="ink-link" href="/landing-claude">Alt. masthead</Link>
        </div>
      </div>
    </footer>
  );
}

/* ── Bundle card ───────────────────────────────────────────────────────── */

// Static marketing view of a token bundle (the interactive buy flow lives on
// /billing). Driven from economy.ts BUNDLES so the price/tokens can't drift.
function BundleCard({
  label,
  price,
  tokens,
  discount,
  highlight,
}: {
  label: string;
  price: string;
  tokens: number;
  discount?: string;
  highlight?: boolean;
}) {
  return (
    <HoverCard
      className={`relative flex h-full flex-col rounded-card border bg-surface p-6 ${
        highlight ? "border-accent/50 shadow-leaf" : "border-border"
      }`}
    >
      {highlight ? (
        <div className="absolute -top-3 left-6">
          <Stamp label="Best value" tone="accent" rotate={-3} />
        </div>
      ) : null}
      <div className="microprint" style={{ color: "var(--accent-dark)" }}>
        Bundle · prepaid
      </div>
      <h3 className="display mt-2 text-3xl text-foreground">{label}</h3>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="display text-5xl">{price}</span>
        {discount ? (
          <span className="microprint" style={{ color: "var(--accent-dark)" }}>
            {discount}
          </span>
        ) : null}
      </div>

      <div className="my-5 perforation h-px" aria-hidden />

      <div className="mt-auto flex items-baseline gap-2">
        <span
          className="doc-number text-[18px] text-foreground"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {tokens.toLocaleString()}
        </span>
        <span className="microprint" style={{ color: "var(--muted)" }}>
          tokens
        </span>
      </div>
    </HoverCard>
  );
}
