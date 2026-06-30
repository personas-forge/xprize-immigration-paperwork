/**
 * Citation-integrity audit subsystem.
 *
 * Parses inline `(Exhibit N)` citations out of a draft's prose and audits them
 * against the exhibits actually on file: which resolve, which are hallucinated
 * (`unresolved` — the load-bearing safety signal the live adjudication gate
 * enforces), which known exhibits went uncited, and the overall utilization
 * `coverage`. Pure (no network/React/env) and consumed by the draft/RFE studios
 * and `draftOperation`. Extracted from the drafting module — re-exported from
 * `./drafting` so import paths are unchanged.
 */

import { type DraftRequest, type DraftSection } from "./drafting";

/** Matches an inline exhibit citation token: `(Exhibit 3)`, `(Exhibits 3, 4)`,
 *  `(Ex. 3)`. The capture group holds the raw number list, parsed separately so
 *  ranges/lists/`and` all resolve to individual ordinals. */
const CITATION_TOKEN = /\((?:exhibits?|ex\.?)\s*([^)]*?)\)/gi;

/** Every exhibit ordinal cited in a body, in order (with repeats). */
export function extractCitedExhibits(body: string): number[] {
  const nums: number[] = [];
  for (const m of body.matchAll(CITATION_TOKEN)) {
    for (const n of m[1].matchAll(/\d+/g)) nums.push(Number(n[0]));
  }
  return nums;
}

/** The de-duplicated, sorted exhibit index for a draft request — the
 *  `(Exhibit N) name` table appended to the petition packet. */
export interface ExhibitIndexEntry {
  number: number;
  name: string;
}

export function buildExhibitIndex(req: DraftRequest): ExhibitIndexEntry[] {
  const byNumber = new Map<number, string>();
  for (const c of req.criteria) {
    for (const ex of c.exhibits ?? []) {
      if (!byNumber.has(ex.number)) byNumber.set(ex.number, ex.name);
    }
  }
  return [...byNumber.entries()]
    .map(([number, name]) => ({ number, name }))
    .sort((a, b) => a.number - b.number);
}

/**
 * The result of auditing a draft's inline citations against the exhibits
 * actually on file. `unresolved` is the load-bearing safety signal: a cited
 * exhibit number with no matching vault document — the "you can never ship a
 * letter that cites evidence you don't have" guarantee. As of the
 * feature-ambiguity pass this is ENFORCED, not advisory: `draftOperation`'s
 * `adjudicate` feeds `unresolved` to the live adjudication report
 * (`exhibitCitationGate`), so any unresolved citation FAILS the gate and turns
 * `attorneyReady` false — the badge + the server-side report agree. `coverage`
 * is exhibit UTILIZATION (known exhibits cited ÷ known exhibits), not a
 * claim-level meter.
 */
export interface CitationAudit {
  /** Distinct exhibit numbers cited across all sections, sorted. */
  cited: number[];
  /** Cited numbers that resolve to a known on-file exhibit, sorted. */
  resolved: number[];
  /** Cited numbers with NO matching exhibit — flagged for the attorney. */
  unresolved: number[];
  /** Known exhibits never cited by the draft, sorted. */
  uncited: number[];
  /** Known exhibits cited ÷ total known exhibits (0..1; 1 when none on file). */
  coverage: number;
}

/**
 * Audit a draft's sections against the case's known exhibit ordinals. Pure and
 * unit-testable beside `tryParseSections` — the route runs it to surface a
 * coverage meter and quarantine any hallucinated `(Exhibit N)` citation.
 */
export function auditCitations(
  sections: readonly DraftSection[],
  knownExhibitNumbers: readonly number[],
): CitationAudit {
  const known = new Set(knownExhibitNumbers);
  const citedSet = new Set<number>();
  for (const s of sections) {
    for (const n of extractCitedExhibits(s.body)) citedSet.add(n);
  }
  const cited = [...citedSet].sort((a, b) => a - b);
  const resolved = cited.filter((n) => known.has(n));
  const unresolved = cited.filter((n) => !known.has(n));
  const uncited = [...known].filter((n) => !citedSet.has(n)).sort((a, b) => a - b);
  const coverage = known.size === 0 ? 1 : resolved.length / known.size;
  return { cited, resolved, unresolved, uncited, coverage };
}

/** Audit a draft against the exhibits attached to its own request (convenience
 *  over `auditCitations` + `buildExhibitIndex`). */
export function auditDraftCitations(
  sections: readonly DraftSection[],
  req: DraftRequest,
): CitationAudit {
  return auditCitations(sections, buildExhibitIndex(req).map((e) => e.number));
}
