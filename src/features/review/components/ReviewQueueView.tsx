"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui";
import { ChapterMark } from "@/components/brand";
import { DashboardTopBar } from "@/components/DashboardTopBar";
import { ThemeScope } from "@/features/dashboard/ThemeScope";
import { ink, parchment } from "@/features/dashboard/themes";
import { BalancePill, LocalThemeToggle } from "@/features/dashboard/DashboardChrome";
import { type SavedCaseSummary } from "@/features/case-file/types";
import { ageBucket, formatAge, sortOldestFirst, BUCKET_TONE } from "@/features/review/queue-age";

// — Attorney review queue ─────────────────────────────────────────────────────
// Every case awaiting the attorney of record. Gated by ATTORNEY_EMAILS (empty =
// demo-unlocked for everyone). Each row opens the case detail, where the
// attorney can request changes, sign, and file.

export function ReviewQueueView({
  cases,
  balance,
  isAttorney,
  canView,
}: {
  cases: readonly SavedCaseSummary[];
  balance: number | null;
  /** True only for the attorney of record — drives the deep-link + (on the case
   *  detail) the sign/file affordances. */
  isAttorney: boolean;
  /** True for an attorney OR a read-only ops/case-manager — gates the board. */
  canView: boolean;
}) {
  const [dark, setDark] = useState(false);
  // Null on first render (SSR) to avoid hydration mismatch from clock skew.
  const [nowMs, setNowMs] = useState<number | null>(null);
  // Set clock on mount and refresh every 60s so badges stay current.
  // Initial tick is deferred via setTimeout so setState is in a callback
  // (not synchronous in the effect body) — satisfies react-hooks/set-state-in-effect.
  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    const initId = setTimeout(tick, 0);
    const id = setInterval(tick, 60_000);
    return () => {
      clearTimeout(initId);
      clearInterval(id);
    };
  }, []);

  const sorted = sortOldestFirst(cases as SavedCaseSummary[]);

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
              className="font-mono text-[13px] uppercase tracking-document text-muted-strong ink-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]"
            >
              ← Dashboard
            </Link>
          </div>

          {!canView ? (
            <Card>
              <CardBody>
                <p className="font-sans text-[16px] text-foreground-soft">
                  This queue is for the attorney of record (and case managers on
                  the ops allowlist). Your account isn&apos;t allow-listed.
                </p>
              </CardBody>
            </Card>
          ) : (
            <>
              {!isAttorney ? (
                <div className="rounded-control border border-dashed border-border-strong bg-surface-muted/40 px-4 py-2.5">
                  <span className="microprint" style={{ color: "var(--accent-dark)" }}>
                    Read-only · case-manager view
                  </span>
                  <p
                    className="mt-1 font-sans text-[14.5px] leading-snug"
                    style={{ color: "var(--muted-strong)" }}
                  >
                    Track queue age and SLAs here. Sign-off, filing, and
                    request-changes are the attorney of record&apos;s — those
                    actions aren&apos;t available to your role.
                  </p>
                </div>
              ) : null}

              {cases.length === 0 ? (
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
                    {sorted.map((c) => {
                      const bucket = nowMs !== null ? ageBucket(c.submittedAt, nowMs) : null;
                      const label = nowMs !== null ? formatAge(c.submittedAt, nowMs) : null;
                      const tone = bucket ? BUCKET_TONE[bucket] : "neutral";
                      const rowClass = "flex items-center justify-between gap-4 px-5 py-3.5";
                      const inner = (
                        <>
                          <div className="flex items-baseline gap-3">
                            <span className="doc-number text-[13px] text-muted">{c.fileNumber}</span>
                            <span className="font-sans text-[16.5px] text-foreground">{c.petitioner}</span>
                            <span className="microprint" style={{ color: "var(--muted)" }}>
                              {c.classification}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            {label !== null && (
                              <Badge tone={tone} aria-label={`In queue ${label}`}>
                                {label}
                              </Badge>
                            )}
                            <span className="doc-number text-[14px] text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
                              {c.approvalLikelihood}%
                            </span>
                            {isAttorney ? (
                              <span aria-hidden className="text-accent-dark">→</span>
                            ) : null}
                          </div>
                        </>
                      );
                      return (
                        <li key={c.id} className="border-t border-dotted border-rule first:border-t-0">
                          {isAttorney ? (
                            <Link
                              href={`/dashboard/cases/${c.id}`}
                              className={`${rowClass} transition-[background-color] duration-200 hover:bg-accent-soft/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]`}
                            >
                              {inner}
                            </Link>
                          ) : (
                            <div className={rowClass}>{inner}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </ThemeScope>
  );
}

