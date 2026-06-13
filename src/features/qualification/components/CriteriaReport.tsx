import { Badge, Card, CardBody, CardHeader } from "@/components/ui";
import { isModelSource, sourceLabel } from "@/lib/llm/label";
import { DisclaimerStamp } from "@/features/guidance/components/DisclaimerStamp";
import {
  QUALIFYING_THRESHOLD,
  statusTone,
  summarizeCriteria,
} from "@/features/case-file/criteria";
import { type Criterion } from "@/features/case-file/types";
import { type QualifyResult } from "../qualification";

// — Qualification report ──────────────────────────────────────────────────────
// Presentational read-out of a screening result. Reuses the SAME eligibility
// math the case-file table relies on (summarizeCriteria / statusTone, ADRs
// 0001-0002), so an unscored ("None") criterion never renders green and the
// summary can never disagree with the rows. The disclaimer renders first and
// prominently — it is never optional on an AI output.

export function CriteriaReport({ result }: { result: QualifyResult }) {
  // summarizeCriteria is documented to be robust to arbitrary row shapes; the
  // ScoredCriterion union (which adds "None") is intentionally passed through —
  // "None"/unknown rows are ignored rather than counted (the safe direction).
  const summary = summarizeCriteria(result.criteria as unknown as readonly Criterion[]);

  return (
    <div className="space-y-4">
      {/* Disclaimer FIRST — UPL safeguard, never dismissible. */}
      <DisclaimerStamp text={result.disclaimer} />

      {/* Likelihood + summary */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-surface-muted/60">
          <div>
            <div className="microprint" style={{ color: "var(--accent-dark)" }}>
              § I — Informational screening
            </div>
            <div className="display mt-1 text-[18px]">
              {summary.qualifying} of {result.criteria.length} criteria supported
              <span className="font-sans text-[13px] italic text-muted-strong">
                {" "}— need {QUALIFYING_THRESHOLD} to qualify.
              </span>
            </div>
          </div>
          <Badge tone={isModelSource(result.source) ? "accent" : "neutral"}>
            {sourceLabel(result.source)}
          </Badge>
        </CardHeader>

        <CardBody className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="microprint" style={{ color: "var(--accent-dark)" }}>
                Estimated likelihood
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span
                  className="display text-[2.6rem] text-foreground"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {result.likelihood}
                  <span className="text-[1.4rem] text-muted">%</span>
                </span>
              </div>
            </div>
            <Badge tone={summary.meetsThreshold ? "success" : "warning"}>
              {summary.meetsThreshold ? "Meets threshold" : "Below threshold"}
            </Badge>
          </div>

          {/* Meter */}
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-background-tint/60"
            role="meter"
            aria-valuenow={result.likelihood}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Estimated approval likelihood"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-700"
              style={{ width: `${result.likelihood}%` }}
            />
          </div>
        </CardBody>
      </Card>

      {/* Criteria rows */}
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-background-tint/40 text-left">
            <tr>
              <th className="px-5 py-3 microprint font-medium">Criterion</th>
              <th className="px-5 py-3 microprint font-medium">Status</th>
              <th className="px-5 py-3 microprint font-medium">What we found</th>
            </tr>
          </thead>
          <tbody>
            {result.criteria.map((c, i) => (
              <tr
                key={c.id}
                className={`border-t border-dotted border-rule border-l-[3px] [border-left-style:solid] transition-[background-color] duration-200 hover:bg-accent-soft/35 ${
                  c.status === "Met" || c.status === "Strong"
                    ? "border-l-success"
                    : c.status === "Partial"
                      ? "border-l-warning"
                      : "border-l-transparent"
                }`}
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-baseline gap-3">
                    <span className="doc-number text-[10px] text-muted">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-sans text-[14.5px] text-foreground">
                      {c.name}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                </td>
                <td className="px-5 py-3.5">
                  {/* Evidence = what we found; rationale = why this score / what
                      would strengthen it. Show BOTH when present (the rationale is
                      the actionable read-out the model already returns). */}
                  <div className="font-sans text-[13.5px] italic text-muted-strong">
                    {c.evidence || c.rationale || "—"}
                  </div>
                  {c.evidence && c.rationale ? (
                    <div className="mt-1 font-sans text-[12px] not-italic text-muted">
                      {c.rationale}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Gaps to close */}
      {result.gaps.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="microprint" style={{ color: "var(--accent-dark)" }}>
              § II — Gaps to strengthen
            </div>
            <Badge tone="warning">{result.gaps.length}</Badge>
          </CardHeader>
          <CardBody>
            <ul className="space-y-2">
              {result.gaps.map((g, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 font-sans text-[13.5px] leading-relaxed text-foreground-soft"
                >
                  <span aria-hidden className="mt-[2px] text-accent-dark">
                    ▢
                  </span>
                  {g}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
