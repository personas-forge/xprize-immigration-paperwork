"use client";

import { useState } from "react";
import { Badge } from "@/components/ui";
import { type AdjudicationReport, type RiskLevel } from "@/lib/llm/adjudication-gates";

/**
 * Live adjudication-risk badge (moonshot #1).
 *
 * Renders the per-document "USCIS-readiness / compliance risk" verdict the
 * orchestrator attaches to every paid generation, with the EXACT reasons
 * (e.g. "cites case law → attorney must verify", "specifics not in the record").
 * The user-visible "attorney-ready" state is bound to zero hard failures.
 *
 * Presentational only — it reuses the same gate results the offline eval runs,
 * so what the user sees can't drift from what CI asserts.
 */

const RISK_COPY: Record<RiskLevel, { label: string; tone: "success" | "warning" | "danger" }> = {
  ready: { label: "Attorney-ready", tone: "success" },
  review: { label: "Review advised", tone: "warning" },
  blocked: { label: "Not attorney-ready", tone: "danger" },
};

const VERDICT_MARK: Record<string, string> = { pass: "✓", warn: "▲", fail: "✕" };

export function AdjudicationBadge({ report }: { report: AdjudicationReport }) {
  const [open, setOpen] = useState(report.risk !== "ready");
  const { label, tone } = RISK_COPY[report.risk];
  // Only the gates worth a human's eyes (warnings + failures) are listed.
  const flagged = report.gates.filter((g) => g.verdict !== "pass");

  return (
    <div className="rounded-control border border-border-strong bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="microprint" style={{ color: "var(--accent-dark)" }}>
            Compliance check
          </span>
          <Badge tone={tone}>{label}</Badge>
        </div>
        {flagged.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="font-mono text-[12px] uppercase tracking-document text-muted-strong underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
          >
            {open ? "Hide" : "Show"} {flagged.length} reason{flagged.length === 1 ? "" : "s"}
          </button>
        ) : (
          <span className="microprint" style={{ color: "var(--success)" }}>
            All invariants held
          </span>
        )}
      </div>

      {open && flagged.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {flagged.map((g) => (
            <li key={g.id} className="flex items-start gap-2.5">
              <span
                aria-hidden
                className="mt-[1px] font-mono text-[12px]"
                style={{ color: g.verdict === "fail" ? "var(--danger)" : "var(--warning)" }}
              >
                {VERDICT_MARK[g.verdict] ?? "•"}
              </span>
              <span className="font-sans text-[14px] leading-snug text-foreground-soft">
                <span className="font-mono text-[12px] uppercase tracking-document text-muted-strong">
                  {g.id}
                </span>
                {g.detail ? ` — ${g.detail}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
