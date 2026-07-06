import type { Metadata } from "next";
import { PageFrame, ChapterMark } from "@/components/brand";
import { Rise } from "@/components/Motion";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { QualifyEntry } from "@/features/qualification/components/QualifyEntry";

export const metadata: Metadata = {
  title: "Do you qualify?",
  description:
    "An informational extraordinary-ability self-screening. Describe your background and see which path (O-1A, O-1B, or EB-1A) fits and how your record maps onto its criteria. Not legal advice.",
};

// — Qualification funnel ──────────────────────────────────────────────────────
// Top-of-funnel self-screening. Standalone route (local header/footer) so it can
// be shared as a lead-gen link. The screening itself runs client-side through
// /api/qualify; this page is just the brand shell around <QualifyPanel/>.

export default function QualifyPage() {
  return (
    <PageFrame>
      <SiteHeader />

      <section className="mx-auto max-w-3xl px-8 pb-16 pt-16">
        <Rise>
          <ChapterMark numeral="I" label="Qualification" />
          <h1 className="display mt-5 text-[clamp(2.2rem,5.5vw,3.8rem)]">
            Do you <em>qualify</em>?
          </h1>
          <p className="mt-6 max-w-2xl font-sans text-[16px] leading-relaxed text-muted-strong">
            Not sure which to pursue? Describe your background once and we&apos;ll
            score it against every program — <strong>O-1A</strong>,{" "}
            <strong>O-1B</strong>, and <strong>EB-1A</strong> — then recommend the
            strongest, fastest path with the gaps worth closing. Already know your
            visa? Screen it directly. This is general information to help you
            screen yourself; it is never legal advice, and an attorney of record
            reviews everything before anything is filed.
          </p>
        </Rise>

        <Rise className="mt-10">
          <QualifyEntry />
        </Rise>
      </section>

      <SiteFooter />
    </PageFrame>
  );
}

