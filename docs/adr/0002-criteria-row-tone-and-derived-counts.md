# ADR 0002 — Make criteria row tone status-safe and derive counts from data

- Status: Accepted
- Date: 2026-05-27
- Scope: `src/features/case-file` (extends ADR 0001)

## Context

ADR 0001 centralized eligibility aggregation in `summarizeCriteria()` and
removed the unsafe `status !== "Partial"` assumption **from the summary badge**.
Reviewing the same surface, the assumption survives in two places in
`CriteriaTable.tsx`, grounded in the current code:

1. Per-row tone (`CriteriaTable.tsx:7`):
   ```tsx
   function toneFor(status: CriterionStatus) {
     return status === "Partial" ? "warning" : "success";
   }
   ```
   Any value that is not `"Partial"` — including an unknown/absent status from
   upstream Document AI / Gemini scoring (the exact threat ADR 0001 names) —
   renders a **green `success` badge**. The summary, however, *excludes* that
   same row (`summarizeCriteria` ignores unknown statuses). Result: the table
   paints an unscored criterion as "met" while the eligibility count silently
   drops it — table and summary disagree on a legal eligibility surface.

2. Hardcoded denominator and threshold (`CriteriaTable.tsx:18,21`):
   `{summary.total} of 8 evaluated` and `Need 3 to qualify`. The `8` is
   decoupled from `criteria.length` and the `3` from `QUALIFYING_THRESHOLD`;
   adding/removing a criterion or changing the threshold silently desyncs the
   read-out (e.g. a 9th criterion renders "9 of 8 evaluated").

`#1` is the single highest-priority correctness defect: it actively
misrepresents eligibility for malformed data. `#2` is a related robustness
gap in the same component. `summarizeCriteria` itself is sound and tested
(verified: 7 qualifying · 1 partial · 8 evaluated).

## Decision

Extend ADR 0001's centralization to the row level instead of re-deriving tone
inline:

- Add an exhaustive, status-safe `statusTone(status)` helper to `criteria.ts`:
  `"Partial" → "warning"`, `"Met" | "Strong" → "success"`, anything else
  (unknown/absent) → `"neutral"`. Guard at runtime — data is AI-sourced, so do
  not rely on the `CriterionStatus` type alone. An unscored criterion must NOT
  render green.
- Wire `CriteriaTable` row badges to `statusTone`; replace the hardcoded `8`
  with `criteria.length` and `Need 3` with `QUALIFYING_THRESHOLD`.
- Regression test in `criteria.test.ts`: pin the current render (7/1/8,
  success tone) AND assert `statusTone("Unknown")`/absent is not `"success"`,
  and that the denominator tracks `criteria.length`.

Engineer owns the implementation + regression test.

## Consequences

- The criteria table and the summary badge can no longer disagree; malformed
  rows are visually neutral, not green — eligibility is honestly represented.
- The read-out (`N of M evaluated`, `Need K to qualify`) tracks the data and
  the threshold constant, so it stays correct as criteria/threshold evolve.
- Rendering is preserved for current data (8 criteria, threshold 3, all rows
  Met/Strong/Partial → identical badges and counts); this is pinned by the
  regression test and `tsc --noEmit`.
- Extends, does not contradict, ADR 0001 — same safety principle, now applied
  at row granularity.
