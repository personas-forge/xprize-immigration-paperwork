import {
  type CaseStatus,
  type PetitionCase,
  type VisaClassification,
} from "./types";

/**
 * Pure query model for the case-list view: search + filter + sort, in one
 * place so the UI is a thin renderer and the logic is unit-testable without
 * React. All functions are total (no throws) and never mutate their input.
 */

export type CaseSortKey = "fileNumber" | "likelihood" | "targetDate" | "status";
export type SortDirection = "asc" | "desc";

export interface CaseQuery {
  /** Free-text search over petitioner, file number, and attorney. */
  search: string;
  /** Filter by classification, or "all" for no filter. */
  classification: VisaClassification | "all";
  /** Filter by case status, or "all" for no filter. */
  status: CaseStatus | "all";
  sortKey: CaseSortKey;
  sortDir: SortDirection;
}

/** The default query the case list opens with (and resets to). */
export const DEFAULT_CASE_QUERY: CaseQuery = {
  search: "",
  classification: "all",
  status: "all",
  sortKey: "targetDate",
  sortDir: "asc",
};

/**
 * Ordering used when sorting by lifecycle status, earliest stage first. Kept
 * explicit (not alphabetical) so "Intake → Approved" reads as real progress.
 */
const STATUS_ORDER: Record<CaseStatus, number> = {
  Intake: 0,
  Drafting: 1,
  "Attorney Review": 2,
  Filed: 3,
  Approved: 4,
};

function matchesSearch(c: PetitionCase, raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  return (
    c.petitioner.toLowerCase().includes(q) ||
    c.fileNumber.toLowerCase().includes(q) ||
    c.attorney.toLowerCase().includes(q) ||
    c.classification.toLowerCase().includes(q)
  );
}

/** Apply search + both filters. Returns a new array; input is untouched. */
export function filterCases(
  cases: readonly PetitionCase[],
  query: Pick<CaseQuery, "search" | "classification" | "status">,
): PetitionCase[] {
  const list = Array.isArray(cases) ? cases : [];
  return list.filter(
    (c) =>
      matchesSearch(c, query.search) &&
      (query.classification === "all" ||
        c.classification === query.classification) &&
      (query.status === "all" || c.status === query.status),
  );
}

function compare(a: PetitionCase, b: PetitionCase, key: CaseSortKey): number {
  switch (key) {
    case "fileNumber":
      return a.fileNumber.localeCompare(b.fileNumber);
    case "likelihood":
      return a.approvalLikelihood - b.approvalLikelihood;
    case "targetDate":
      return a.targetFileDate.localeCompare(b.targetFileDate);
    case "status":
      return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  }
}

/** Stable sort by key + direction. Returns a new array; input is untouched. */
export function sortCases(
  cases: readonly PetitionCase[],
  key: CaseSortKey,
  dir: SortDirection,
): PetitionCase[] {
  const factor = dir === "asc" ? 1 : -1;
  return [...(Array.isArray(cases) ? cases : [])].sort(
    (a, b) => compare(a, b, key) * factor,
  );
}

/** Run a full query: filter, then sort. The one call the UI needs. */
export function queryCases(
  cases: readonly PetitionCase[],
  query: CaseQuery,
): PetitionCase[] {
  return sortCases(filterCases(cases, query), query.sortKey, query.sortDir);
}
