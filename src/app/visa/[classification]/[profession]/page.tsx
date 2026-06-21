import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageFrame, Wordmark, ChapterMark } from "@/components/brand";
import { Rise } from "@/components/Motion";
import { ThemeToggle } from "@/components/ThemeToggle";
import { InstantVerdict } from "@/features/qualification/components/InstantVerdict";
import {
  livePrograms,
  packFor,
  jurisdictionFor,
  validationFor,
  type Classification,
} from "@/features/qualification";
import { PROFESSIONS, professionBySlug, exampleFor, type Profession } from "@/features/qualification/professions";
import { SITE_URL } from "@/lib/site";

// Programmatic-SEO atelier (moonshot #17) — one brand-styled, statically
// generated page per (live classification × profession), built from the real
// criteria packs + a typed profession content map. Each page shows the
// classification's criteria with profession-tuned evidence examples, FAQ +
// Service JSON-LD for rich results / AI-answer eligibility, and an embedded
// Instant Verdict so the visitor screens themselves on the page they land on.

/** Resolve a URL classification slug ("o-1a") back to a live Classification. */
function classificationForSlug(slug: string): Classification | undefined {
  return livePrograms().find((c) => c.toLowerCase() === slug.toLowerCase());
}

/** Every (live classification × profession) pair, statically generated. */
export function generateStaticParams(): { classification: string; profession: string }[] {
  return livePrograms().flatMap((c) =>
    PROFESSIONS.map((p) => ({ classification: c.toLowerCase(), profession: p.slug })),
  );
}

interface PageParams {
  params: Promise<{ classification: string; profession: string }>;
}

function resolve(
  classificationSlug: string,
  professionSlug: string,
): { classification: Classification; profession: Profession } | null {
  const classification = classificationForSlug(classificationSlug);
  const profession = professionBySlug(professionSlug);
  if (!classification || !profession) return null;
  return { classification, profession };
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { classification: cSlug, profession: pSlug } = await params;
  const resolved = resolve(cSlug, pSlug);
  if (!resolved) return { title: "Not found" };
  const { classification, profession } = resolved;
  const title = `${classification} visa for ${profession.label} — eligibility & criteria`;
  const description =
    `How ${profession.label.toLowerCase()} qualify for the ${classification} ` +
    `(${packFor(classification).label}). The exact criteria, profession-specific ` +
    `evidence examples, and a free instant eligibility screening. Informational, not legal advice.`;
  const canonical = `/visa/${classification.toLowerCase()}/${profession.slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "article" },
  };
}

export default async function VisaProfessionPage({ params }: PageParams) {
  const { classification: cSlug, profession: pSlug } = await params;
  const resolved = resolve(cSlug, pSlug);
  if (!resolved) notFound();
  const { classification, profession } = resolved;

  const pack = packFor(classification);
  const jurisdiction = jurisdictionFor(classification);
  const validation = validationFor(classification);
  const greenCard = classification === "EB-1A";

  // FAQ + Service structured data for rich results and AI-answer engines.
  const faq = [
    {
      q: `What are the ${classification} criteria for ${profession.label.toLowerCase()}?`,
      a: `The ${classification} (${pack.label}) is evaluated against ${pack.criteria.length} criteria: ${pack.criteria
        .map((c) => c.name)
        .join(", ")}. A petition must satisfy at least ${pack.threshold}.`,
    },
    {
      q: `How many criteria must ${profession.label.toLowerCase()} meet for ${classification}?`,
      a: `At least ${pack.threshold} of the ${pack.criteria.length} criteria, each backed by independent evidence. Our free screening estimates where you stand today.`,
    },
    {
      q: `Is the ${classification} a green card?`,
      a: greenCard
        ? `Yes — the EB-1A is an employment-based first-preference immigrant petition, a direct path to permanent residence.`
        : `No — the ${classification} is a nonimmigrant work visa. The EB-1A is the comparable green-card path for extraordinary ability.`,
    },
  ];
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "Service",
        serviceType: `${classification} petition preparation for ${profession.label}`,
        provider: { "@type": "Organization", name: "Immigration Concierge", url: SITE_URL },
        areaServed: jurisdiction.country,
        description: `AI-drafted ${classification} petition work product for ${profession.label.toLowerCase()}, for review and signature by an attorney of record.`,
      },
    ],
  };

  return (
    <PageFrame>
      <script
        type="application/ld+json"
        // Structured data — server-rendered, static, no user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />

      <section className="mx-auto max-w-3xl px-8 pb-16 pt-16">
        <Rise>
          <ChapterMark numeral="I" label={`${classification} · ${profession.label}`} />
          <h1 className="display mt-5 text-[clamp(2rem,5vw,3.4rem)]">
            The <em>{classification}</em> visa for {profession.label.toLowerCase()}
          </h1>
          <p className="mt-6 max-w-2xl font-sans text-[16px] leading-relaxed text-muted-strong">
            {profession.intro} {jurisdiction.label}.{" "}
            {validation ? (
              <>
                Criteria per {validation.legalBasis}
                {validation.threshold ? ` · ${validation.threshold}` : ""}.
              </>
            ) : null}{" "}
            This is general information, never legal advice.
          </p>
        </Rise>

        {/* Criteria with profession-tuned examples */}
        <Rise className="mt-10">
          <h2 className="display text-[22px]">
            The {pack.criteria.length} {classification} criteria — for {profession.label.toLowerCase()}
          </h2>
          <p className="mt-2 microprint">
            Satisfy at least {pack.threshold}. Examples below are typical for {profession.label.toLowerCase()}.
          </p>
          <ol className="mt-5 space-y-3">
            {pack.criteria.map((c, i) => {
              const example = exampleFor(profession, c.name);
              return (
                <li
                  key={c.name}
                  className="rounded-control border border-border-strong bg-surface px-4 py-3"
                >
                  <div className="flex items-baseline gap-3">
                    <span className="doc-number text-[12px] text-muted">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="display text-[17px]">{c.name}</span>
                  </div>
                  <p className="mt-1.5 font-sans text-[15px] leading-snug text-foreground-soft">
                    {example ?? c.evidence}
                  </p>
                </li>
              );
            })}
          </ol>
        </Rise>

        {/* Embedded Instant Verdict — screen yourself on this page */}
        <Rise className="mt-12">
          <ChapterMark numeral="II" label="Screen yourself now" />
          <h2 className="display mt-4 text-[22px]">
            Do you qualify for the {classification}? See your verdict.
          </h2>
          <div className="mt-5">
            <InstantVerdict initialClassification={classification} />
          </div>
        </Rise>

        {/* FAQ (mirrors the JSON-LD) */}
        <Rise className="mt-12">
          <ChapterMark numeral="III" label="Common questions" />
          <dl className="mt-5 space-y-4">
            {faq.map((f) => (
              <div key={f.q} className="rounded-control border border-border-strong bg-surface px-4 py-3">
                <dt className="display text-[16px]">{f.q}</dt>
                <dd className="mt-1.5 font-sans text-[15px] leading-snug text-muted-strong">{f.a}</dd>
              </div>
            ))}
          </dl>
        </Rise>
      </section>

      <SiteFooter />
    </PageFrame>
  );
}

function SiteHeader() {
  return (
    <header className="relative">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-6">
        <Wordmark context="Petition Atelier · est. 2026" />
        <nav className="flex items-center gap-6 font-mono text-[13px] uppercase tracking-document text-muted-strong">
          <Link href="/" className="ink-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]">
            Home
          </Link>
          <Link href="/qualify" className="ink-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]">
            Qualify
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
        <div className="microprint">© Immigration Concierge · 2026 · informational, not legal advice</div>
        <div className="microprint flex gap-4">
          <Link className="ink-link" href="/qualify">
            Free screening
          </Link>
          <Link className="ink-link" href="/faq">
            FAQ
          </Link>
        </div>
      </div>
    </footer>
  );
}
