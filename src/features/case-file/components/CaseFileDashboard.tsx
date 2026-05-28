"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, CardBody, Skeleton } from "@/components/ui";
import { Stamp, ChapterMark, Seal } from "@/components/brand";
import { FieldGuidancePanel } from "@/features/guidance";
import { getCaseFacts } from "@/lib/data";
import { type CaseFact } from "../types";
import { CaseList } from "./CaseList";
import { CriteriaTable } from "./CriteriaTable";
import { PetitionDraftCard, TasksCard } from "./SidePanels";

export function CaseFileDashboard() {
  const [caseFacts, setCaseFacts] = useState<readonly CaseFact[] | null>(null);

  useEffect(() => {
    let active = true;
    getCaseFacts().then((facts) => {
      if (active) setCaseFacts(facts);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="px-8 py-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <ChapterMark numeral="I" label="Petitioner of record" />

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
            <CriteriaTable />
            <FieldGuidancePanel />
          </div>
          <div className="space-y-6 lg:col-span-4">
            <TasksCard />
            <PetitionDraftCard />
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
