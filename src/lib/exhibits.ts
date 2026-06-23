/**
 * The persisted exhibit-label format ("Ex. 3") and its inverse.
 *
 * The label is assigned by BOTH store drivers (pglite + firestore) when a
 * document is filed, and mirrored by the optimistic client when persistence is
 * skipped. Single-sourcing the prefix here keeps those three producers from
 * drifting (e.g. one switching to "Exhibit 3" while the others stay "Ex. 3",
 * which would make the optimistic ordinal read differently from saved siblings).
 */
export const EXHIBIT_PREFIX = "Ex. ";

/** Format a 1-based ordinal as an exhibit label: 3 → "Ex. 3". */
export function formatExhibit(ordinal: number): string {
  return `${EXHIBIT_PREFIX}${ordinal}`;
}

/** Parse the ordinal out of an exhibit label ("Ex. 3" → 3); 0 when none. */
export function parseExhibitOrdinal(label: string): number {
  const m = /\d+/.exec(label);
  return m ? Number(m[0]) : 0;
}
