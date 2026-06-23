"use client";

import Link from "next/link";
import { Badge, Button, buttonClasses, Card, CardBody, CardHeader, PanelErrorBoundary, Skeleton } from "@/components/ui";
import { Stamp, ChapterMark, Seal } from "@/components/brand";
import { FieldGuidancePanel } from "@/features/guidance";
import { type SavedCaseSummary } from "../types";
import { useCaseFileData } from "../useCaseFileData";
import { CaseList } from "./CaseList";
import { CriteriaTable } from "./CriteriaTable";
import { PetitionDraftCard, TasksCard } from "./SidePanels";

export function CaseFileDashboard({
  cases = [],
}: {
  cases?: readonly SavedCaseSummary[];
}) {
  // Single owner of the case-file data: one composited fetch (case facts +
  // outstanding tasks + petition excerpt) drilled into the child cards as
  // props, replacing the three independent useEffect fetches (ADR-0009).
  const { data, error, reload } = useCaseFileData();
  const caseFacts = data?.caseFacts ?? null;

  return (
    <div className="px-8 py-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <ChapterMark numeral="I" label="Petitioner of record" />

        {/* A fetch rejection used to leave every card on infinite skeletons with
            no signal. Surface it with a retry instead of a silent dead-end. */}
        {error ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-danger/40 bg-danger-soft/50 px-5 py-4"
          >
            <span className="font-sans text-[15.5px] text-danger">
              We couldn&apos;t load your case file. Please try again.
            </span>
            <Button variant="secondary" onClick={reload}>
              Retry
            </Button>
          </div>
        ) : null}

        {/* The user's real, persisted cases (from the qualification flow). Shows
            an empty-state CTA when none exist yet. */}
        {cases.length > 0 ? <YourCasesCard cases={cases} /> : <EmptyCasesCallout />}

        {/* Masthead — the case-file header card */}
        <Card className="relative overflow-hidden">
          <CardBody className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-6">
              <div className="flex items-center gap-3 text-accent-dark">
                <Seal size={36} />
                <div className="microprint" style={{ color: "var(--accent-dark)" }}>
                  File №&nbsp;<span className="doc-number">O1-241</span> · Sample case
                </div>
              </div>

              {/* Illustrative masthead — NOT the user's data. Real, persisted cases
                  render in "Your cases" above; this shows what a worked case file
                  looks like so an empty account isn't a blank page. */}
              <h1 className="display mt-5 text-[clamp(2rem,4.2vw,3rem)]">
                Dr. <em>Anya</em> Krishnan
              </h1>
              <p className="font-sans text-[17px] italic text-muted-strong">
                Senior Research Engineer · India → United States · O-1A
              </p>
              <p className="microprint mt-2" style={{ color: "var(--muted)" }}>
                Illustrative example — your real cases appear under “Your cases.”
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button variant="primary">Open petition letter</Button>
                <Button variant="secondary">Voice intake transcript</Button>
              </div>
            </div>

            <div className="col-span-12 grid grid-cols-3 gap-px overflow-hidden rounded-card border border-border bg-border lg:col-span-6">
              {caseFacts === null
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="bg-surface px-4 py-4">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="mt-2 h-4 w-24" />
                    </div>
                  ))
                : caseFacts.map((fact) => (
                    <div key={fact.label} className="bg-surface px-4 py-4">
                      <div className="microprint">{fact.label}</div>
                      <div className="mt-2 doc-number text-[16px] text-foreground">
                        {fact.value}
                      </div>
                    </div>
                  ))}
            </div>
          </CardBody>

          {/* Status stamp pinned to the corner — the visual hero of the card */}
          <div className="pointer-events-none absolute right-6 top-6 hidden lg:block">
            <Stamp label="Drafting" meta="Phase III of IV" tone="seal" rotate={6} />
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8 space-y-6">
            <PanelErrorBoundary label="Criteria">
              <CriteriaTable criteria={data?.criteria ?? null} />
            </PanelErrorBoundary>
            <FieldGuidancePanel />
          </div>
          <div className="space-y-6 lg:col-span-4">
            <PanelErrorBoundary label="Outstanding tasks">
              <TasksCard tasks={data?.tasks ?? null} />
            </PanelErrorBoundary>
            <PanelErrorBoundary label="Petition draft">
              <PetitionDraftCard excerpt={data?.petitionExcerpt ?? null} />
            </PanelErrorBoundary>
          </div>
        </div>

        <CaseList />

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="success">Sample · 92% modeled likelihood</Badge>
          <Badge tone="neutral">Prepaid tokens · start free</Badge>
          <Badge tone="neutral">USCIS premium $2,805 (paid to USCIS)</Badge>
        </div>
      </div>
    </div>
  );
}

// — Empty state — shown when the user has no cases yet ──────────────────────────
function EmptyCasesCallout() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-surface-muted/60">
        <div className="microprint" style={{ color: "var(--accent-dark)" }}>
          § — Your cases
        </div>
      </CardHeader>
      <CardBody className="flex flex-col items-center gap-4 py-10 text-center">
        <p className="font-sans text-[17px] text-muted-strong max-w-sm">
          Your case file will appear here — begin by qualifying your profile
        </p>
        <Link href="/qualify" className={buttonClasses("primary", "md")}>
          Qualify your profile
        </Link>
      </CardBody>
    </Card>
  );
}

// — Your cases — real, DB-backed cases the user created via /qualify ──────────
function YourCasesCard({ cases }: { cases: readonly SavedCaseSummary[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-surface-muted/60">
        <div className="microprint" style={{ color: "var(--accent-dark)" }}>
          § — Your cases
        </div>
        <Badge tone="accent">{cases.length} on file</Badge>
      </CardHeader>
      <ul>
        {cases.map((c) => (
          <li key={c.id} className="border-t border-dotted border-rule first:border-t-0">
            <Link
              href={`/dashboard/cases/${c.id}`}
              className="flex items-center justify-between gap-4 px-5 py-3.5 transition-[background-color] duration-200 hover:bg-accent-soft/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]"
            >
              <div className="flex items-baseline gap-3">
                <span className="doc-number text-[13px] text-muted">{c.fileNumber}</span>
                <span className="font-sans text-[16.5px] text-foreground">{c.petitioner}</span>
                <span className="microprint" style={{ color: "var(--muted)" }}>
                  {c.classification}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone="neutral">{c.status}</Badge>
                <span className="doc-number text-[14px] text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {c.approvalLikelihood}%
                </span>
                <span aria-hidden className="text-accent-dark">→</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
