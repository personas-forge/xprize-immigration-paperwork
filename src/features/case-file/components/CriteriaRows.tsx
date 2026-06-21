"use client";

import { Badge } from "@/components/ui";
import { statusTone } from "../criteria";
import { CriterionPrimerButton } from "./CriterionPrimerButton";

// The ONE O-1A criteria table. The dashboard card and the case-detail view both
// rendered their own `<table>` and had drifted (columns, spacing, header copy);
// this is the shared body. Each screen keeps its own Card / header / skeleton /
// empty-state and just configures the columns it wants here.

/** The minimum a criterion needs to render a row. `rationale`/`exhibit` are
 *  optional so both the dashboard `Criterion` (has `exhibit`) and the detail
 *  `DetailCriterion` (has `rationale`) satisfy it. */
export interface CriteriaRow {
  id: string;
  name: string;
  status: string;
  evidence: string;
  rationale?: string;
  exhibit?: string;
}

export function CriteriaRows({
  criteria,
  showExhibit = false,
  showPrimer = false,
  evidenceHeader = "Evidence",
}: {
  criteria: readonly CriteriaRow[];
  /** Render the right-aligned "Ex." exhibit column (dashboard only). */
  showExhibit?: boolean;
  /** Render the inline criterion-primer popover button (dashboard only). */
  showPrimer?: boolean;
  /** Header for the evidence column ("Evidence" vs "What we found"). */
  evidenceHeader?: string;
}) {
  return (
    <table className="w-full text-base">
      <thead className="bg-background-tint/40 text-left">
        <tr>
          <th scope="col" className="px-5 py-3 microprint font-medium">
            Criterion
          </th>
          <th scope="col" className="px-5 py-3 microprint font-medium">
            Status
          </th>
          <th scope="col" className="px-5 py-3 microprint font-medium">
            {evidenceHeader}
          </th>
          {showExhibit ? (
            <th scope="col" className="px-5 py-3 microprint text-right font-medium">
              Ex.
            </th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {criteria.map((c, i) => (
          <tr
            key={c.id}
            className="border-t border-dotted border-rule transition-[background-color] duration-200 hover:bg-accent-soft/35"
          >
            <td className="px-5 py-3.5">
              <div className="flex items-center gap-3">
                <span className="doc-number text-[12px] text-muted">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-sans text-[16.5px] text-foreground">{c.name}</span>
                {showPrimer ? <CriterionPrimerButton criterionName={c.name} /> : null}
              </div>
            </td>
            <td className="px-5 py-3.5">
              <Badge tone={statusTone(c.status)}>{c.status}</Badge>
            </td>
            <td className="px-5 py-3.5 font-sans text-[15.5px] italic text-muted-strong">
              {c.evidence || c.rationale || "—"}
            </td>
            {showExhibit ? (
              <td className="px-5 py-3.5 text-right doc-number text-[13px] text-muted">
                {c.exhibit}
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
