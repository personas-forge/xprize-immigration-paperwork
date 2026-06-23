import { type PetitionCase } from "./types";

/**
 * Pure CSV serialization for the case list. No DOM, no Blob — the component
 * layer turns the returned string into a download. Kept pure so the (fiddly)
 * quoting/escaping rules are unit-tested directly.
 */

/** RFC-4180-ish escaping: quote when the cell contains "," | '"' | newline. */
export function csvCell(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toRow(cells: (string | number)[]): string {
  return cells.map(csvCell).join(",");
}

const CASE_HEADERS = [
  "File number",
  "Petitioner",
  "Classification",
  "Status",
  "Approval likelihood",
  "Target file date",
  "Attorney",
] as const;

/** Serialize a list of cases to CSV (header row + one row per case). */
export function casesToCsv(cases: readonly PetitionCase[]): string {
  const rows = [toRow([...CASE_HEADERS])];
  for (const c of cases) {
    rows.push(
      toRow([
        c.fileNumber,
        c.petitioner,
        c.classification,
        c.status,
        `${c.approvalLikelihood}%`,
        c.targetFileDate,
        c.attorney,
      ]),
    );
  }
  return rows.join("\r\n");
}
