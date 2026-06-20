import { Badge, Card, CardBody, CardHeader } from "@/components/ui";
import { isModelSource, sourceLabel } from "@/lib/llm/label";
import { DisclaimerStamp } from "@/components/legal";
import { statusTone, summarizeCriteria } from "@/features/case-file/criteria";
import { type Criterion } from "@/features/case-file/types";
import { packFor } from "../packs";
import { type QualifyResult } from "../qualification";

// — Qualification report ──────────────────────────────────────────────────────
// Presentational read-out of a screening result. Reuses the SAME eligibility
// math the case-file table relies on (summarizeCriteria / statusTone, ADRs
// 0001-0002), so an unscored ("None") criterion never renders green and the
// summary can never disagree with the rows. The disclaimer renders first and
// prominently — it is never optional on an AI output.

/** Left-border status accent shared by the desktop table rows and mobile cards. */
function statusAccent(status: string): string {
  return status === "Met" || status === "Strong"
    ? "border-l-success"
    : status === "Partial"
      ? "border-l-warning"
      : "border-l-transparent";
}

export function CriteriaReport({ result }: { result: QualifyResult }) {
  // The qualifying threshold is derived from the classification the result was
  // actually SCORED against (pinned into the result), NOT from mutable form
  // state — otherwise changing the visa-type dropdown after a screening would
  // render the verdict against the wrong program's rule (a legal-correctness bug).
  const threshold = packFor(result.classification).threshold;
  // summarizeCriteria is documented to be robust to arbitrary row shapes; the
  // ScoredCriterion union (which adds "None") is intentionally passed through —
  // "None"/unknown rows are ignored rather than counted (the safe direction).
  const summary = summarizeCriteria(
    result.criteria as unknown as readonly Criterion[],
    threshold,
  );

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
              <span className="font-sans text-[15px] italic text-muted-strong">
                {" "}— need {threshold} to qualify.
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
        {/* Desktop: a 3-column table. Mobile: stacked cards (below). */}
        <table className="hidden w-full text-base md:table">
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
                className={`border-t border-dotted border-rule border-l-[3px] [border-left-style:solid] transition-[background-color] duration-200 hover:bg-accent-soft/35 ${statusAccent(
                  c.status,
                )}`}
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
                <td className="px-5 py-3.5">
                  {/* Evidence = what we found; rationale = why this score / what
                      would strengthen it. Show BOTH when present (the rationale is
                      the actionable read-out the model already returns). */}
                  <div className="font-sans text-[15.5px] italic text-muted-strong">
                    {c.evidence || c.rationale || "—"}
                  </div>
                  {c.evidence && c.rationale ? (
                    <div className="mt-1 font-sans text-[14px] not-italic text-muted">
                      {c.rationale}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile: each criterion as a stacked card so the evidence text isn't
            crushed into a narrow third column. */}
        <ul className="md:hidden">
          {result.criteria.map((c, i) => (
            <li
              key={c.id}
              className={`border-t border-dotted border-rule border-l-[3px] [border-left-style:solid] px-5 py-4 first:border-t-0 ${statusAccent(
                c.status,
              )}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-baseline gap-2.5">
                  <span className="doc-number text-[12px] text-muted">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-sans text-[16.5px] text-foreground">
                    {c.name}
                  </span>
                </div>
                <Badge tone={statusTone(c.status)}>{c.status}</Badge>
              </div>
              <div className="mt-2 font-sans text-[15px] italic leading-snug text-muted-strong">
                {c.evidence || c.rationale || "—"}
              </div>
              {c.evidence && c.rationale ? (
                <div className="mt-1 font-sans text-[14px] not-italic leading-snug text-muted">
                  {c.rationale}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
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
                  className="flex items-start gap-3 font-sans text-[15.5px] leading-relaxed text-foreground-soft"
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
