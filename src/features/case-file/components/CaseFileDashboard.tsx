"use client";

import Link from "next/link";
import { Badge, Button, Card, CardBody, CardHeader, Skeleton } from "@/components/ui";
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
  const { data } = useCaseFileData();
  const caseFacts = data?.caseFacts ?? null;

  return (
    <div className="px-8 py-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <ChapterMark numeral="I" label="Petitioner of record" />

        {/* The user's real, persisted cases (from the qualification flow). Only
            rendered when there are any — the keyless demo shows just the mock
            case file below. */}
        {cases.length > 0 ? <YourCasesCard cases={cases} /> : null}

        {/* Masthead — the case-file header card */}
        <Card className="relative overflow-hidden">
          <CardBody className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-6">
              <div className="flex items-center gap-3 text-accent-dark">
                <Seal size={36} />
                <div className="microprint" style={{ color: "var(--accent-dark)" }}>
                  File №&nbsp;<span className="doc-number">O1-241</span> · Petitioner
                </div>
              </div>

              <h1 className="display mt-5 text-[clamp(2rem,4.2vw,3rem)]">
                Dr. <em>Anya</em> Krishnan
              </h1>
              <p className="font-sans text-[15px] italic text-muted-strong">
                Senior Research Engineer · India → United States · O-1A
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
                      <div className="mt-2 doc-number text-[14px] text-foreground">
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
            <CriteriaTable criteria={data?.criteria ?? null} />
            <FieldGuidancePanel />
          </div>
          <div className="space-y-6 lg:col-span-4">
            <TasksCard tasks={data?.tasks ?? null} />
            <PetitionDraftCard excerpt={data?.petitionExcerpt ?? null} />
          </div>
        </div>

        <CaseList />

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="success">92% approval likelihood</Badge>
          <Badge tone="neutral">$2,500 flat fee</Badge>
          <Badge tone="neutral">USCIS premium $2,805 passthrough</Badge>
        </div>
      </div>
    </div>
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
              className="flex items-center justify-between gap-4 px-5 py-3.5 transition-[background-color] duration-200 hover:bg-accent-soft/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
            >
              <div className="flex items-baseline gap-3">
                <span className="doc-number text-[11px] text-muted">{c.fileNumber}</span>
                <span className="font-sans text-[14.5px] text-foreground">{c.petitioner}</span>
                <span className="microprint" style={{ color: "var(--muted)" }}>
                  {c.classification}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone="neutral">{c.status}</Badge>
                <span className="doc-number text-[12px] text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
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
