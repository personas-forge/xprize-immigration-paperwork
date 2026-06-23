import { Badge, Card, CardBody, CardHeader } from "@/components/ui";
import { isModelSource, sourceLabel } from "@/lib/llm/label";
import { DisclaimerStamp } from "@/components/legal";
import { classifyStatus, statusTone, summarizeCriteria } from "@/features/case-file/criteria";
import { type Criterion } from "@/features/case-file/types";
import { packFor } from "../packs";
import { type QualifyResult } from "../qualification";

// — Qualification report ──────────────────────────────────────────────────────
// Presentational read-out of a screening result. Reuses the SAME eligibility
// math the case-file table relies on (summarizeCriteria / statusTone, ADRs
// 0001-0002), so an unscored ("None") criterion never renders green and the
// summary can never disagree with the rows. The disclaimer renders first and
// prominently — it is never optional on an AI output.

/** Left-border status accent shared by the desktop table rows and mobile cards.
 *  Derived from the SAME `classifyStatus` ladder as `statusTone` (ADR-0002), so
 *  a row's badge tone and its border accent can't disagree on the same status. */
function statusAccent(status: string): string {
  switch (classifyStatus(status)) {
    case "qualifying":
      return "border-l-success";
    case "partial":
      return "border-l-warning";
    default:
      return "border-l-transparent";
  }
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

      {/* Screen-reader announcement of the VERDICT — the outcome of the screening,
          which the visual likelihood meter alone doesn't convey to AT. role=status
          (polite) so it's spoken when the report swaps in without stealing focus. */}
      <p role="status" aria-live="polite" className="sr-only">
        {`Screening result: ${summary.meetsThreshold ? "meets" : "below"} the qualifying threshold — ${summary.qualifying} of ${result.criteria.length} criteria supported, ${threshold} needed. Informational only, not legal advice.`}
      </p>

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
          {/* No criteria supported yet → a likelihood number is noise, not signal
              (and reads as a harsh "you scored 38%"). Reframe as a starting point
              and point at the gaps, instead of leading with a discouraging % on an
              empty profile. */}
          {summary.qualifying === 0 ? (
            <p className="font-sans text-[15.5px] leading-relaxed text-muted-strong">
              No criteria are supported yet, so there&apos;s no meaningful estimate
              to show — this is a starting point, not a verdict. Begin with the gaps
              below; the likelihood appears once at least one criterion has evidence.
            </p>
          ) : (
            <>
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
                aria-valuetext={`${result.likelihood}% estimated likelihood — ${summary.meetsThreshold ? "meets" : "below"} threshold`}
                aria-label="Estimated approval likelihood"
              >
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-700"
                  style={{ width: `${result.likelihood}%` }}
                />
              </div>

              {/* EB-1A FINAL-MERITS CAVEAT: clearing 3 criteria is only STEP ONE of
                  EB-1A's two-step Kazarian analysis — USCIS then weighs the totality
                  of the record on a higher "final merits" bar. The per-classification
                  screen otherwise scores EB-1A identically to O-1A, so a confident
                  green "Meets threshold" would over-claim on a green-card path. (The
                  likelihood band is deliberately NOT damped here — see packs.ts.) */}
              {result.classification === "EB-1A" ? (
                <div
                  role="note"
                  className="rounded-control border border-warning/50 bg-warning-soft/40 px-4 py-3 font-sans text-[14.5px] leading-snug text-foreground-soft"
                >
                  <strong>EB-1A is judged on a higher bar.</strong> Meeting{" "}
                  {threshold} of the criteria is only the first step — for EB-1A
                  (an immigrant/green-card petition) USCIS then weighs the{" "}
                  <em>totality</em> of your record on a stricter &ldquo;final
                  merits&rdquo; standard. Treat a passing screen as a starting
                  point to discuss with your attorney, not a likely approval.
                </div>
              ) : null}
            </>
          )}
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
