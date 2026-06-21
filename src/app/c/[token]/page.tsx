import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageFrame, Wordmark, Seal, Guilloche, Stamp } from "@/components/brand";
import { Badge } from "@/components/ui";
import { Rise } from "@/components/Motion";
import { ThemeToggle } from "@/components/ThemeToggle";
import { packFor, jurisdictionFor } from "@/features/qualification";
import {
  decodeSnapshot,
  snapshotQualifying,
} from "@/features/qualification/letters-patent";
import { statusTone } from "@/features/case-file/criteria";
import { DisclaimerStamp } from "@/components/legal";
import { DISCLAIMER } from "@/lib/result";

// Public "Letters Patent of Extraordinary Ability" (moonshot #18) — a shareable,
// engraved certificate minted from a screening result. The result is encoded in
// the URL token (no DB), decoded here, and rendered from the real criteria pack.
// A per-result Open Graph image lives in ./opengraph-image so the link unfurls
// as a stunning card on LinkedIn/X.

export const dynamic = "force-dynamic";

interface PageParams {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { token } = await params;
  const snap = decodeSnapshot(token);
  if (!snap) return { title: "Certificate not found" };
  const title = `${snap.name} — ${snap.likelihood}% likely to qualify for the ${snap.classification}`;
  const description = `A Certificate of Extraordinary Ability: ${snapshotQualifying(snap)} of ${
    packFor(snap.classification).criteria.length
  } ${snap.classification} criteria supported. Run your own free screening.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "profile" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function LettersPatentPage({ params }: PageParams) {
  const { token } = await params;
  const snap = decodeSnapshot(token);
  if (!snap) notFound();

  const pack = packFor(snap.classification);
  const jurisdiction = jurisdictionFor(snap.classification);
  const qualifying = snapshotQualifying(snap);

  return (
    <PageFrame>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-8 py-6">
        <Wordmark context="Petition Atelier · est. 2026" />
        <ThemeToggle />
      </header>

      <section className="mx-auto max-w-3xl px-8 pb-20 pt-8">
        <Rise>
          <div className="relative overflow-hidden rounded-card border-2 border-double border-accent/30 bg-surface px-6 py-10 sm:px-10">
            <div
              className="pointer-events-none absolute inset-0 grid place-items-center text-accent-dark opacity-[0.12]"
              aria-hidden
            >
              <Guilloche size={520} rings={9} />
            </div>
            <div className="relative text-center">
              <div className="flex justify-center text-accent-dark">
                <Seal size={64} />
              </div>
              <div className="microprint mt-4" style={{ color: "var(--accent-dark)" }}>
                Certificate of Extraordinary Ability · {snap.classification}
              </div>
              <h1 className="display mt-3 text-[clamp(2rem,5vw,3.4rem)]">{snap.name}</h1>
              <p className="font-sans text-[15px] italic text-muted-strong">
                {jurisdiction.label}
              </p>

              <div className="mt-7 flex items-center justify-center gap-8">
                <div>
                  <div className="microprint">Estimated likelihood</div>
                  <div
                    className="display text-[3rem] text-foreground"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {snap.likelihood}
                    <span className="text-[1.6rem] text-muted">%</span>
                  </div>
                </div>
                <div className="h-16 w-px bg-border" aria-hidden />
                <div>
                  <div className="microprint">Criteria supported</div>
                  <div className="display text-[3rem] text-foreground">
                    {qualifying}
                    <span className="text-[1.6rem] text-muted">/{pack.criteria.length}</span>
                  </div>
                </div>
              </div>

              {/* Criteria as a coat-of-arms */}
              <div className="mt-8 flex flex-wrap justify-center gap-2">
                {pack.criteria.map((c, i) => (
                  <Badge key={c.name} tone={statusTone(snap.statuses[i])}>
                    {c.name}
                  </Badge>
                ))}
              </div>

              <div className="mt-9 flex flex-col items-center gap-3">
                <Link
                  href="/qualify"
                  className="inline-flex items-center gap-2 rounded-control bg-foreground px-7 py-3.5 font-mono text-[14px] uppercase tracking-document text-background transition-transform hover:-translate-y-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]"
                >
                  Run your own free screening
                  <span aria-hidden>→</span>
                </Link>
                <span className="microprint" style={{ color: "var(--muted)" }}>
                  Informational only · no account needed
                </span>
              </div>

              <div className="mx-auto mt-8 max-w-xl">
                <DisclaimerStamp text={DISCLAIMER} />
              </div>
            </div>

            <div className="pointer-events-none absolute right-5 top-5 hidden sm:block">
              <Stamp
                label={qualifying >= pack.threshold ? "Meets threshold" : "Below threshold"}
                meta={`${snap.likelihood}% likelihood`}
                tone="seal"
                rotate={-5}
              />
            </div>
          </div>
        </Rise>
      </section>
    </PageFrame>
  );
}
