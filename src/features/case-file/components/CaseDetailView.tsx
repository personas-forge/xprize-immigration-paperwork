"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, Card, CardBody, CardHeader, PanelErrorBoundary } from "@/components/ui";
import { Stamp, ChapterMark, Seal } from "@/components/brand";
import { DashboardTopBar } from "@/components/DashboardTopBar";
import { ThemeScope } from "@/features/dashboard/ThemeScope";
import { ink, parchment } from "@/features/dashboard/themes";
import { BalancePill, LocalThemeToggle } from "@/features/dashboard/DashboardChrome";
import { DraftStudio } from "@/features/drafting/components/DraftStudio";
import { type DraftSection } from "@/features/drafting";
import { ReviewPanel, type ReviewEventView } from "@/features/review/components/ReviewPanel";
import { RfeStudio } from "@/features/rfe/components/RfeStudio";
import { EvidenceVault, type DocumentView } from "@/features/evidence/components/EvidenceVault";
import { RoadmapStepper } from "./RoadmapStepper";
import { type ModelSource } from "@/lib/llm/label";
import { jurisdictionFor } from "@/features/qualification";
import { statusTone } from "../criteria";

// — Case detail view ──────────────────────────────────────────────────────────
// The DB-backed counterpart to the mock dashboard: one real, user-scoped case
// (created by the qualification flow), its AI-scored criteria, and the Drafting
// Studio wired to the case so generated drafts persist (versioned) against it.
// Re-uses the dashboard chrome (top bar + parchment/ink theme toggle).

export interface DetailCriterion {
  id: string;
  name: string;
  status: string;
  evidence: string;
  rationale: string;
}

export function CaseDetailView({
  caseId,
  fileNumber,
  petitioner,
  classification,
  status,
  likelihood,
  criteria,
  initialSections,
  initialSource,
  balance,
  receiptNumber,
  isAttorney,
  isOwner,
  events,
  documents,
  rfeInitialSections,
  rfeInitialText,
  rfeInitialSource,
}: {
  caseId: string;
  fileNumber: string;
  petitioner: string;
  classification: string;
  status: string;
  likelihood: number;
  criteria: readonly DetailCriterion[];
  initialSections: DraftSection[] | null;
  initialSource: ModelSource;
  balance: number | null;
  receiptNumber: string | null;
  isAttorney: boolean;
  isOwner: boolean;
  events: readonly ReviewEventView[];
  documents: readonly DocumentView[];
  rfeInitialSections: DraftSection[] | null;
  rfeInitialText: string;
  rfeInitialSource: ModelSource;
}) {
  const [dark, setDark] = useState(false);
  const jurisdiction = jurisdictionFor(classification);

  return (
    <ThemeScope theme={dark ? ink : parchment}>
      <DashboardTopBar
        glyph="✦"
        product="Immigration Concierge"
        context={`${fileNumber} · ${petitioner} · ${classification}`}
        actions={
          <>
            <BalancePill balance={balance} />
            <LocalThemeToggle dark={dark} onToggle={() => setDark((d) => !d)} />
          </>
        }
      />

      <div className="px-8 py-10">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="flex items-center justify-between">
            <ChapterMark numeral="I" label="Petition case file" />
            <Link
              href="/dashboard"
              className="font-mono text-[13px] uppercase tracking-document text-muted-strong ink-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
            >
              ← All cases
            </Link>
          </div>

          {/* Masthead */}
          <Card className="relative overflow-hidden">
            <CardBody className="grid grid-cols-12 gap-6">
              <div className="col-span-12 lg:col-span-6">
                <div className="flex items-center gap-3 text-accent-dark">
                  <Seal size={36} />
                  <div className="microprint" style={{ color: "var(--accent-dark)" }}>
                    File №&nbsp;<span className="doc-number">{fileNumber}</span> · Petitioner
                  </div>
                </div>
                <h1 className="display mt-5 text-[clamp(2rem,4.2vw,3rem)]">
                  {petitioner}
                </h1>
                <p className="font-sans text-[17px] italic text-muted-strong">
                  {jurisdiction.label} · {classification}
                </p>
              </div>

              <div className="col-span-12 grid grid-cols-3 gap-px overflow-hidden rounded-card border border-border bg-border lg:col-span-6">
                <Fact label="Status" value={status} />
                <Fact label="Classification" value={classification} />
                <Fact label="Likelihood" value={`${likelihood}%`} />
              </div>
            </CardBody>

            <div className="pointer-events-none absolute right-6 top-6 hidden lg:block">
              <Stamp label={status} meta={`${likelihood}% likelihood`} tone="seal" rotate={6} />
            </div>
          </Card>

          {/* Client roadmap — what's done / what's next. */}
          <RoadmapStepper
            status={status}
            hasEvidence={documents.length > 0}
            hasDraft={Boolean(initialSections && initialSections.length > 0)}
          />

          {/* Criteria */}
          <Card className="overflow-hidden">
            <CardHeader className="bg-surface-muted/60">
              <div className="microprint" style={{ color: "var(--accent-dark)" }}>
                § II — {classification} criteria · AI-scored
              </div>
              <Badge tone="neutral">{criteria.length} criteria</Badge>
            </CardHeader>
            {criteria.length === 0 ? (
              <CardBody>
                <p className="font-sans text-[16px] italic text-muted-strong">
                  No scored criteria on file for this case.
                </p>
              </CardBody>
            ) : (
              <table className="w-full text-base">
                <thead className="bg-background-tint/40 text-left">
                  <tr>
                    <th className="px-5 py-3 microprint font-medium">Criterion</th>
                    <th className="px-5 py-3 microprint font-medium">Status</th>
                    <th className="px-5 py-3 microprint font-medium">What we found</th>
                  </tr>
                </thead>
                <tbody>
                  {criteria.map((c, i) => (
                    <tr
                      key={c.id}
                      className="border-t border-dotted border-rule transition-[background-color] duration-200 hover:bg-accent-soft/35"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-baseline gap-3">
                          <span className="doc-number text-[12px] text-muted">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="font-sans text-[16.5px] text-foreground">
                            {c.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                      </td>
                      <td className="px-5 py-3.5 font-sans text-[15.5px] italic text-muted-strong">
                        {c.evidence || c.rationale || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* Evidence vault — categorized exhibits + coverage gaps. */}
          <PanelErrorBoundary label="Evidence vault">
            <EvidenceVault
              caseId={caseId}
              classification={classification}
              initialDocuments={documents}
            />
          </PanelErrorBoundary>

          {/* Drafting Studio — wired to this case, so drafts persist (versioned). */}
          <DraftStudio
            petitioner={petitioner}
            classification={classification}
            criteria={criteria}
            caseId={caseId}
            initialSections={initialSections}
            initialSource={initialSource}
          />

          {/* Attorney review & filing workflow. */}
          <ReviewPanel
            caseId={caseId}
            status={status}
            receiptNumber={receiptNumber}
            isAttorney={isAttorney}
            isOwner={isOwner}
            hasDraft={Boolean(initialSections && initialSections.length > 0)}
            events={events}
          />

          {/* RFE response drafter — relevant once the petition is filed. */}
          {status === "Filed" ? (
            <RfeStudio
              caseId={caseId}
              petitioner={petitioner}
              classification={classification}
              criteria={criteria}
              initialSections={rfeInitialSections}
              initialRfeText={rfeInitialText}
              initialSource={rfeInitialSource}
            />
          ) : null}
        </div>
      </div>
    </ThemeScope>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-4 py-4">
      <div className="microprint">{label}</div>
      <div className="mt-2 doc-number text-[16px] text-foreground">{value}</div>
    </div>
  );
}

