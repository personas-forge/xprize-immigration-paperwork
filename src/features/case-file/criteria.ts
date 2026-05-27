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
    const status = item?.status;
    if (status === "Partial") {
      partial += 1;
      total += 1;
    } else if (QUALIFYING_STATUSES.has(status as CriterionStatus)) {
      qualifying += 1;
      total += 1;
    }
    // Unknown/absent status: not counted toward total or any bucket.
  }

  return {
    total,
    qualifying,
    partial,
    meetsThreshold: qualifying >= QUALIFYING_THRESHOLD,
  };
}
