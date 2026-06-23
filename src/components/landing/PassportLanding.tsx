"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Seal, Guilloche, Stamp } from "@/components/brand";
import { useActiveSection } from "@/components/landing/useActiveSection";
import {
  CriteriaRadar,
  ApprovalGauge,
  ProcessTimeline,
  CostCompareBars,
} from "@/components/landing/charts";
import { ThemeToggle } from "@/components/ThemeToggle";
import { InstantVerdict } from "@/features/qualification/components/InstantVerdict";
import { BUNDLES, FREE_SIGNUP_GRANT, bundlePriceLabel } from "@/lib/tokens/economy";
import { FIRM_FEE } from "@/lib/site";
import { easeArrival } from "@/lib/motion";

// ── Homepage · "Passport / Arrival" ─────────────────────────────────────────
// The site identity as a passport: a vertical column of stamp-tabs for
// navigation, full-screen sections that snap one-per-movement (viewport lock),
// an arrival visual that draws a flight path and presses an approval stamp, the
// 8 criteria as inked visa stamps, and a "record measured" section built on the
// themed Recharts set (which re-skins with the parchment/ink theme toggle).

const SECTIONS = [
  { id: "arrival", n: "00", label: "Arrival" },
  { id: "criteria", n: "01", label: "Criteria" },
  { id: "checkpoints", n: "02", label: "Process" },
  { id: "evidence", n: "03", label: "Evidence" },
  { id: "allowance", n: "04", label: "Pricing" },
  { id: "depart", n: "05", label: "Begin" },
] as const;

// The Pro bundle's price/tokens for the cost-comparison caption — derived from
// the BUNDLES catalog (same source the pricing cards render) so the headline
// comparison can't quote a stale price the grid has moved past.
const PRO_BUNDLE = BUNDLES.find((b) => b.key === "pro");
const PRO_PRICE_CAPTION = PRO_BUNDLE
  ? `${bundlePriceLabel(PRO_BUNDLE)} for ${PRO_BUNDLE.tokens.toLocaleString("en-US")} tokens`
  : "$48 for 8,000 tokens";

export function PassportLanding() {
  const rootRef = useRef<HTMLDivElement>(null);
  const { active, index } = useActiveSection(
    SECTIONS.map((s) => s.id),
    rootRef,
  );
  const progress = index / (SECTIONS.length - 1);

  return (
    <div className="relative h-screen overflow-hidden bg-background text-foreground">
      {/* atmospheric corner rosettes */}
      <div
        aria-hidden
        className="pointer-events-none fixed -right-40 -top-40 z-0 text-accent-dark opacity-[0.10]"
      >
        <Guilloche size={560} rings={9} />
      </div>
      <div
        aria-hidden
        className="pointer-events-none fixed -bottom-48 -left-48 z-0 text-seal opacity-[0.07]"
      >
        <Guilloche size={520} rings={7} />
      </div>

      <PassportNav active={active} progress={progress} />
      <MobileProgress progress={progress} active={active} />

      <div
        ref={rootRef}
        className="relative z-10 h-screen overflow-y-scroll lg:snap-y lg:snap-mandatory motion-safe:scroll-smooth [scrollbar-width:thin]"
      >
        <Arrival />
        <Criteria />
        <Checkpoints />
        <Evidence />
        <Allowance />
        <Depart />
      </div>
    </div>
  );
}

/* ── Side navigation — passport stamp-tabs + route line ──────────────────── */

function PassportNav({ active, progress }: { active: string; progress: number }) {
  return (
    <nav
      aria-label="Page sections"
      className="fixed left-0 top-0 z-30 hidden h-screen w-24 flex-col items-center justify-center lg:flex"
    >
      {/* route line — dashed track + gold progress fill */}
      <div aria-hidden className="absolute inset-y-24 left-1/2 w-px -translate-x-1/2">
        <div className="perforation-y h-full w-px opacity-60" />
        <motion.div
          className="absolute left-0 top-0 w-px bg-accent-dark"
          initial={false}
          animate={{ height: `${progress * 100}%` }}
          transition={{ duration: 0.5, ease: easeArrival }}
        />
        {/* travelling marker */}
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 text-accent-dark"
          initial={false}
          animate={{ top: `${progress * 100}%` }}
          transition={{ duration: 0.5, ease: easeArrival }}
        >
          <span className="-mt-2 block text-[13px] leading-none">✦</span>
        </motion.div>
      </div>

      <ul className="relative flex flex-col items-center gap-5">
        {SECTIONS.map((s) => {
          const on = active === s.id;
          return (
            <li key={s.id} className="group relative">
              <a
                href={`#${s.id}`}
                aria-current={on ? "true" : undefined}
                aria-label={`${s.label} (section ${s.n})`}
                className={[
                  "doc-number relative grid h-11 w-11 place-items-center rounded-full border text-[12px] transition-all duration-300",
                  on
                    ? "border-accent-dark bg-foreground text-background shadow-leaf scale-110"
                    : "border-border-strong bg-surface/80 text-muted-strong hover:border-accent-dark hover:text-foreground",
                ].join(" ")}
              >
                {s.n}
              </a>
              {/* hover/active label chip */}
              <span
                className={[
                  "pointer-events-none absolute left-14 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-control border border-border-strong bg-surface px-2.5 py-1 font-mono text-[11px] uppercase tracking-document text-foreground shadow-leaf transition-all duration-300",
                  on ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                ].join(" ")}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ul>

      {/* theme toggle + footer seal in the rail */}
      <div className="absolute bottom-7 flex flex-col items-center gap-4">
        <ThemeToggle />
        <Link
          href="/"
          aria-label="Immigration Concierge home"
          className="text-accent-dark opacity-70 transition-opacity hover:opacity-100"
        >
          <Seal size={30} />
        </Link>
      </div>
    </nav>
  );
}

function MobileProgress({ progress, active }: { progress: number; active: string }) {
  const current = SECTIONS.find((s) => s.id === active);
  return (
    <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/85 px-5 py-3 backdrop-blur lg:hidden">
      <span className="flex items-center gap-2 text-accent-dark">
        <Seal size={22} />
        <span className="microprint text-foreground">{current?.label}</span>
      </span>
      <span className="flex items-center gap-3">
        <span className="h-1 w-24 overflow-hidden rounded-pill bg-surface-muted">
          <span
            className="block h-full bg-accent-dark transition-[width] duration-500"
            style={{ width: `${Math.max(8, progress * 100)}%` }}
          />
        </span>
        <ThemeToggle />
      </span>
    </div>
  );
}

/* ── Shared section shell ────────────────────────────────────────────────── */

function Section({
  id,
  children,
  className = "",
  align = "center",
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
  // "start" lets a section grow downward from the top (e.g. Arrival, whose
  // screener expands when a verdict is revealed) instead of centring — which
  // would push the top out of view under the fixed nav.
  align?: "center" | "start";
}) {
  return (
    <section
      id={id}
      className={`relative flex min-h-screen w-full flex-col px-6 py-24 lg:snap-start lg:snap-always lg:pl-32 lg:pr-12 ${
        align === "start" ? "justify-start" : "justify-center"
      } ${className}`}
    >
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3" style={{ color: "var(--accent-dark)" }}>
      <span className="inline-block h-px w-10 bg-accent-dark" />
      <span className="microprint">{children}</span>
    </div>
  );
}

// fade+rise reveal that honors reduced motion (returns a plain div).
function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.7, ease: easeArrival, delay }}
    >
      {children}
    </motion.div>
  );
}

/* ── §00 · Arrival (hero) ────────────────────────────────────────────────── */

function Arrival() {
  return (
    <Section id="arrival" align="start">
      <FlightPath />
      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-6">
          <Reveal>
            <Eyebrow>File №&nbsp;O1-241 · Form I-129 · O-1A / O-1B / EB-1A</Eyebrow>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="display mt-6 text-[clamp(2.5rem,4.8vw,4rem)] text-foreground">
              Extraordinary ability,
              <br />
              <em>on the record.</em>
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-6 max-w-xl font-sans text-[18px] leading-relaxed text-foreground-soft">
              The petition packet immigration firms {FIRM_FEE.verb}{" "}
              {FIRM_FEE.range} to assemble — drafted by AI from your real record,
              then handed to <em className="text-accent-dark">your</em> attorney
              of record to review and sign. Informational drafting, never legal
              advice.
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/qualify"
                className="inline-flex items-center gap-2 rounded-control bg-foreground px-7 py-4 font-mono text-[14px] uppercase tracking-document text-background transition-transform hover:-translate-y-[2px] focus-ring"
              >
                Take the free qualification <span aria-hidden>→</span>
              </Link>
              <Link
                href="/dashboard"
                className="rounded-control border border-border-strong px-7 py-4 font-mono text-[14px] uppercase tracking-document text-foreground transition-colors hover:border-foreground focus-ring"
              >
                See the case file
              </Link>
            </div>
          </Reveal>
          <Reveal delay={0.32}>
            <p className="microprint mt-6" style={{ color: "var(--muted-strong)" }}>
              Free 5-min screening · {FREE_SIGNUP_GRANT} tokens on signup · pay
              only for what you draft
            </p>
          </Reveal>
        </div>

        {/* Live screener — paste a record, watch the certificate assemble.
            This IS the product (the static passport mock made real). */}
        <div className="lg:col-span-6">
          <Reveal delay={0.2}>
            <InstantVerdict initialClassification="O-1A" />
          </Reveal>
        </div>
      </div>
    </Section>
  );
}

// Faint dotted flight arc drawn across the hero on first view.
function FlightPath() {
  const reduce = useReducedMotion();
  return (
    <svg
      aria-hidden
      viewBox="0 0 600 240"
      className="pointer-events-none absolute inset-x-0 top-1/4 -z-0 mx-auto h-auto w-[90%] max-w-4xl text-accent-dark opacity-[0.18]"
      fill="none"
    >
      <motion.path
        d="M40 196 C 200 60, 380 60, 560 44"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeDasharray="2 8"
        strokeLinecap="round"
        initial={reduce ? false : { pathLength: 0 }}
        whileInView={reduce ? undefined : { pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 2, ease: easeArrival }}
      />
      <circle cx="40" cy="196" r="4" fill="currentColor" />
      <circle cx="560" cy="44" r="5" fill="currentColor" />
    </svg>
  );
}

/* ── §01 · Criteria ──────────────────────────────────────────────────────── */

const CRITERIA = [
  "Nationally recognized awards",
  "Selective association membership",
  "Published material about you",
  "Judging the work of others",
  "Original contributions of major significance",
  "Authorship of scholarly articles",
  "Critical role at distinguished organizations",
  "High remuneration in the field",
];

function Criteria() {
  return (
    <Section id="criteria">
      <Reveal>
        <Eyebrow>§ I — The eight criteria</Eyebrow>
        <h2 className="display mt-5 max-w-3xl text-[clamp(2.1rem,5vw,3.6rem)]">
          The statute asks for three. <em>Establish three, clearly.</em>
        </h2>
        <p className="mt-4 max-w-2xl font-sans text-[18px] leading-relaxed text-foreground-soft">
          Each piece of your record is a stamp in the book. We sort your
          evidence across all eight and build your case on your strongest three.
        </p>
      </Reveal>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CRITERIA.map((c, i) => (
          <StampCard key={c} n={i + 1} label={c} i={i} />
        ))}
      </div>
    </Section>
  );
}

function StampCard({ n, label, i }: { n: number; label: string; i: number }) {
  const reduce = useReducedMotion();
  const rot = (i % 3) - 1; // -1, 0, 1 — hand-pressed feel
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.82, rotate: rot * 5 }}
      whileInView={reduce ? undefined : { opacity: 1, scale: 1, rotate: rot }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ delay: 0.05 * i, duration: 0.5, ease: [0.34, 1.3, 0.64, 1] }}
      whileHover={reduce ? undefined : { y: -4, rotate: 0 }}
      className="relative flex h-40 flex-col justify-between rounded-card border-2 border-double border-seal/60 bg-surface/70 p-4"
    >
      <div className="flex items-center justify-between">
        <span className="doc-number text-[13px] text-seal">
          № {String(n).padStart(2, "0")}
        </span>
        <span className="text-success">✓</span>
      </div>
      <p className="font-sans text-[15.5px] leading-snug text-foreground">{label}</p>
      <span className="microprint" style={{ color: "var(--muted)" }}>
        Admitted
      </span>
    </motion.div>
  );
}

/* ── §02 · Checkpoints (process) ─────────────────────────────────────────── */

const STEPS: [string, string, string][] = [
  ["I", "Qualify", "A 5-minute self-check maps your record onto the right criteria — O-1A, O-1B, or EB-1A. Free. Honest yes / no / maybe."],
  ["II", "Assemble", "Upload your CV and evidence. AI sorts each document by criterion and drafts the petition letter, section by section."],
  ["III", "Sign", "Your own attorney of record reviews every word, edits where judgment is needed, and signs — you own the filing."],
  ["IV", "File", "Your attorney files with premium processing. Draft RFE responses in the studio if USCIS asks for more."],
];

function Checkpoints() {
  return (
    <Section id="checkpoints">
      <Reveal>
        <Eyebrow>§ II — How the petition is built</Eyebrow>
        <h2 className="display mt-5 max-w-3xl text-[clamp(2.1rem,5vw,3.6rem)]">
          From your inbox to <em>USCIS</em>, in four hand-checked passes.
        </h2>
      </Reveal>

      <div className="relative mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-card border border-border-strong bg-border-strong sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(([num, title, body], i) => (
          <Reveal key={title} delay={0.08 * i} className="h-full">
            <div className="group flex h-full flex-col bg-surface p-6 transition-colors hover:bg-accent-soft/40">
              <div className="flex items-baseline justify-between">
                <span className="display text-4xl italic text-accent-dark">{num}</span>
                <span className="microprint" style={{ color: "var(--muted)" }}>
                  Gate {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="display mt-6 text-2xl">{title}</h3>
              <p className="mt-2 font-sans text-[16px] leading-relaxed text-foreground-soft">
                {body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ── §03 · Evidence (data viz) ───────────────────────────────────────────── */

function Evidence() {
  return (
    <Section id="evidence" align="start">
      <Reveal>
        <Eyebrow>§ III — Your record, measured</Eyebrow>
        <h2 className="display mt-4 max-w-3xl text-[clamp(2rem,4.4vw,3.2rem)]">
          What a <em>strong</em> case looks like.
        </h2>
        <p className="mt-3 max-w-2xl font-sans text-[17px] leading-relaxed text-foreground-soft">
          Illustrative figures — not a prediction or a quote. They show how the
          engine reasons about coverage, cost, likelihood, and the road to a
          decision.
        </p>
      </Reveal>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Reveal>
          <Panel title="Criteria coverage" caption="Gold = a strong record · dashed bordeaux = the evidentiary bar">
            <CriteriaRadar height={250} />
          </Panel>
        </Reveal>
        <Reveal delay={0.06}>
          <Panel
            title="A firm's fee, vs a Pro bundle"
            caption={`${FIRM_FEE.range} ${FIRM_FEE.verb} · vs ${PRO_PRICE_CAPTION}`}
          >
            <CostCompareBars height={200} />
          </Panel>
        </Reveal>
        <Reveal delay={0.12}>
          <Panel title="Filing-ready likelihood" caption="Illustrative — your attorney makes the call">
            <ApprovalGauge value={92} height={200} />
          </Panel>
        </Reveal>
        <Reveal delay={0.18}>
          <Panel title="Path to a decision" caption="Premium ≈ 15 business days">
            <ProcessTimeline height={200} />
          </Panel>
        </Reveal>
      </div>
    </Section>
  );
}

function Panel({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full rounded-card border border-border bg-surface/70 p-6 shadow-leaf">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="display text-xl">{title}</h3>
      </div>
      <div className="mt-4">{children}</div>
      <p className="microprint mt-4" style={{ color: "var(--muted-strong)" }}>
        {caption}
      </p>
    </div>
  );
}

/* ── §04 · Allowance (pricing) ───────────────────────────────────────────── */

function Allowance() {
  const bundles = BUNDLES.filter((b) => !b.recurring);
  return (
    <Section id="allowance">
      <Reveal>
        <Eyebrow>§ IV — Token ledger</Eyebrow>
        <h2 className="display mt-5 max-w-3xl text-[clamp(2.1rem,5vw,3.6rem)]">
          Pay for <em>exactly what you draft.</em>
        </h2>
        <p className="mt-4 max-w-2xl font-sans text-[18px] leading-relaxed text-foreground-soft">
          No retainers, no subscriptions. New accounts start with{" "}
          <span className="doc-number text-foreground">{FREE_SIGNUP_GRANT}</span>{" "}
          free tokens; top up a bundle when you need more — bigger bundles cost
          less per token.
        </p>
      </Reveal>

      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {bundles.map((b, i) => (
          <Reveal key={b.key} delay={0.07 * i} className="h-full">
            <BoardingPass
              label={b.label}
              price={bundlePriceLabel(b)}
              tokens={b.tokens}
              discount={b.discountLabel}
              highlight={b.featured ?? false}
            />
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.2}>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/billing"
            className="rounded-control bg-foreground px-7 py-3.5 font-mono text-[14px] uppercase tracking-document text-background transition-transform hover:-translate-y-[2px] focus-ring"
          >
            See the token ledger →
          </Link>
          <span className="microprint" style={{ color: "var(--muted-strong)" }}>
            USCIS filing fees are paid directly to USCIS · never legal advice
          </span>
        </div>
      </Reveal>
    </Section>
  );
}

function BoardingPass({
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
    <div
      className={[
        "relative flex h-full flex-col rounded-card border bg-surface p-6 transition-transform hover:-translate-y-1",
        highlight ? "border-accent/60 shadow-leaf" : "border-border",
      ].join(" ")}
    >
      {highlight ? (
        <div className="absolute -top-3 right-5">
          <Stamp label="Best value" tone="accent" rotate={-3} />
        </div>
      ) : null}
      <div className="microprint" style={{ color: "var(--accent-dark)" }}>
        Bundle · prepaid
      </div>
      <h3 className="display mt-2 text-3xl">{label}</h3>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="display text-5xl">{price}</span>
        {discount ? (
          <span className="microprint" style={{ color: "var(--accent-dark)" }}>
            {discount}
          </span>
        ) : null}
      </div>
      <div className="perforation my-5 h-px" aria-hidden />
      <div className="mt-auto flex items-baseline gap-2">
        <span className="doc-number text-[18px] text-foreground">
          {tokens.toLocaleString()}
        </span>
        <span className="microprint" style={{ color: "var(--muted)" }}>
          tokens
        </span>
      </div>
    </div>
  );
}

/* ── §05 · Depart (closing) ──────────────────────────────────────────────── */

function Depart() {
  const reduce = useReducedMotion();
  return (
    <Section id="depart" className="text-center">
      <div className="mx-auto max-w-2xl">
        <motion.div
          className="mx-auto mb-8 inline-block text-accent-dark"
          initial={reduce ? false : { opacity: 0, scale: 1.25, rotate: -8 }}
          whileInView={reduce ? undefined : { opacity: 1, scale: 1, rotate: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.34, 1.3, 0.64, 1] }}
        >
          <Seal size={90} />
        </motion.div>
        <Reveal>
          <h2 className="display text-[clamp(2.4rem,6.5vw,4.8rem)]">
            Find out if you qualify — <em>today,</em> for free.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mx-auto mt-6 max-w-lg font-sans text-[18px] leading-relaxed text-foreground-soft">
            If the answer is no, you pay nothing — and you&apos;ll know exactly
            what would change it.
          </p>
        </Reveal>
        <Reveal delay={0.18}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/qualify"
              className="rounded-control bg-seal px-8 py-4 font-mono text-[14px] uppercase tracking-document text-background shadow-seal transition-transform hover:-translate-y-[2px] focus-ring"
            >
              Begin qualification
            </Link>
            <Link
              href="/dashboard"
              className="rounded-control border border-border-strong px-8 py-4 font-mono text-[14px] uppercase tracking-document text-foreground transition-colors hover:border-foreground focus-ring"
            >
              See the case file
            </Link>
          </div>
        </Reveal>

        <div className="mt-16 flex flex-wrap items-center justify-center gap-5">
          <span className="microprint" style={{ color: "var(--muted-strong)" }}>
            Immigration Concierge · not a law firm · never legal advice · 2026
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-4">
          <Link className="ink-link microprint" href="/faq">FAQ</Link>
          <Link className="ink-link microprint" href="/billing">Pricing</Link>
          <Link className="ink-link microprint" href="/validation">Validation</Link>
        </div>
      </div>
    </Section>
  );
}
