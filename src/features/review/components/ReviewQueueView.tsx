"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui";
import { ChapterMark } from "@/components/brand";
import { DashboardTopBar } from "@/components/DashboardTopBar";
import { ThemeScope } from "@/features/dashboard/ThemeScope";
import { ink, parchment } from "@/features/dashboard/themes";
import { BalancePill, LocalThemeToggle } from "@/features/dashboard/DashboardChrome";
import { type SavedCaseSummary } from "@/features/case-file/types";

// — Attorney review queue ─────────────────────────────────────────────────────
// Every case awaiting the attorney of record. Gated by ATTORNEY_EMAILS (empty =
// demo-unlocked for everyone). Each row opens the case detail, where the
// attorney can request changes, sign, and file.

export function ReviewQueueView({
  cases,
  balance,
  isAttorney,
}: {
  cases: readonly SavedCaseSummary[];
  balance: number | null;
  isAttorney: boolean;
}) {
  const [dark, setDark] = useState(false);

  return (
    <ThemeScope theme={dark ? ink : parchment}>
      <DashboardTopBar
        product="Immigration Concierge"
        context="Attorney review queue"
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
            <ChapterMark numeral="V" label="Attorney review queue" />
            <Link
              href="/dashboard"
              className="font-mono text-[13px] uppercase tracking-document text-muted-strong ink-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
            >
              ← Dashboard
            </Link>
          </div>

          {!isAttorney ? (
            <Card>
              <CardBody>
                <p className="font-sans text-[16px] text-foreground-soft">
                  This queue is for the attorney of record. Your account
                  isn&apos;t on the attorney allowlist.
                </p>
              </CardBody>
            </Card>
          ) : cases.length === 0 ? (
            <Card>
              <CardBody>
                <p className="font-sans text-[16px] italic text-muted-strong">
                  No cases are awaiting review. When an applicant submits a
                  drafted petition, it appears here.
                </p>
              </CardBody>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <CardHeader className="bg-surface-muted/60">
                <div className="microprint" style={{ color: "var(--accent-dark)" }}>
                  § — Awaiting review
                </div>
                <Badge tone="accent">{cases.length} in queue</Badge>
              </CardHeader>
              <ul>
                {cases.map((c) => (
                  <li key={c.id} className="border-t border-dotted border-rule first:border-t-0">
                    <Link
                      href={`/dashboard/cases/${c.id}`}
                      className="flex items-center justify-between gap-4 px-5 py-3.5 transition-[background-color] duration-200 hover:bg-accent-soft/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
                    >
                      <div className="flex items-baseline gap-3">
                        <span className="doc-number text-[13px] text-muted">{c.fileNumber}</span>
                        <span className="font-sans text-[16.5px] text-foreground">{c.petitioner}</span>
                        <span className="microprint" style={{ color: "var(--muted)" }}>
                          {c.classification}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
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
          )}
        </div>
      </div>
    </ThemeScope>
  );
}

