import { type BadgeTone } from "@/components/ui";
import { type Criterion, type CriterionStatus } from "./types";

/**
 * O-1A petitions must satisfy at least this many criteria to qualify.
 * "Met" and "Strong" both count toward the threshold; "Partial" does not.
 */
export const QUALIFYING_THRESHOLD = 3;

const QUALIFYING_STATUSES: ReadonlySet<CriterionStatus> = new Set([
  "Met",
  "Strong",
]);

/** How a (possibly AI-sourced, possibly malformed) status counts toward
 *  eligibility. */
export type StatusClass = "qualifying" | "partial" | "other";

/**
 * THE single source of truth for classifying a criterion status. Both
 * `statusTone` (the table tone) and `summarizeCriteria` (the summary counts)
 * derive from this, so the two derived views can never drift apart — the bug
 * this guards against (ADR 0002). The value is AI-sourced, so it is matched at
 * runtime rather than trusting the CriterionStatus type: "Met"/"Strong" →
 * qualifying, exact "Partial" → partial, anything else (unknown/absent) → other.
 */
export function classifyStatus(status: unknown): StatusClass {
  if (status === "Partial") return "partial";
  if (QUALIFYING_STATUSES.has(status as CriterionStatus)) return "qualifying";
  return "other";
}

/**
 * Map a criterion status to the badge tone the criteria table renders.
 * qualifying → success, partial → warning, other (unknown/absent) → neutral. An
 * unscored criterion must NOT render green — that would let the table paint a
 * row "met" while summarizeCriteria excludes it.
 */
export function statusTone(status: unknown): BadgeTone {
  switch (classifyStatus(status)) {
    case "qualifying":
      return "success";
    case "partial":
      return "warning";
    default:
      return "neutral";
  }
}

export interface CriteriaSummary {
  /** Number of criteria evaluated (input rows that are well-formed). */
  total: number;
  /** Criteria with status "Met" or "Strong" — count toward qualification. */
  qualifying: number;
  /** Criteria with status "Partial". */
  partial: number;
  /** Whether the qualifying count reaches QUALIFYING_THRESHOLD. */
  meetsThreshold: boolean;
}

/**
 * Aggregate criteria into the counts the case-file summary badge renders.
 *
 * Robust against malformed input: a non-array argument yields an empty
 * summary, and rows with an unrecognized/absent status are ignored rather
 * than silently inflating the qualifying count. This keeps the eligibility
 * read-out honest regardless of upstream data-shape drift.
 */
export function summarizeCriteria(items: readonly Criterion[]): CriteriaSummary {
  const list = Array.isArray(items) ? items : [];

  let qualifying = 0;
  let partial = 0;
  let total = 0;

  for (const item of list) {
    // Same classifier statusTone uses → tone and counts can't disagree.
    const cls = classifyStatus(item?.status);
    if (cls === "partial") {
      partial += 1;
      total += 1;
    } else if (cls === "qualifying") {
      qualifying += 1;
      total += 1;
    }
    // "other" (unknown/absent): not counted toward total or any bucket.
  }

  return {
    total,
    qualifying,
    partial,
    meetsThreshold: qualifying >= QUALIFYING_THRESHOLD,
  };
}
