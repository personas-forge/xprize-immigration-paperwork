# ADR 0001 — Centralize O-1A criteria status aggregation

- Status: Accepted
- Date: 2026-05-27
- Scope: `src/features/case-file` (also consumed cross-feature by the qualification
  report — see note below)

> **2026-06-14 note:** `summarizeCriteria` / `statusTone` / `QUALIFYING_THRESHOLD`
> are now also consumed by `qualification/components/CriteriaReport.tsx` (the
> multi-product `/qualify` read-out). Because that surface offers more than O-1A,
> `summarizeCriteria` takes an optional `threshold` and the report passes its
> pack's own threshold (`packFor(classification).threshold`) — the qualifying
> threshold must be pack-driven there, never the hardcoded O-1A `3`.

## Context

The case-file dashboard summarizes O-1A criteria in `CriteriaTable.tsx`. The
summary badge derived the qualifying count dynamically but **hardcoded the
partial count**:

```tsx
const met = criteria.filter((c) => c.status !== "Partial").length;
<Badge tone="success">{met} strong · 1 partial</Badge>
```

Consequences of the defect, grounded in the code:
- The partial count (`1`) is a literal. Any change to `criteria` in `data.ts`
  (a second `Partial`, a removed criterion) makes the badge silently misreport
  eligibility — a correctness risk on a legal/eligibility surface.
- `status !== "Partial"` treats *any* non-`Partial` value (including a typo or
  an absent status from upstream Document AI / Gemini scoring) as qualifying,
  inflating the count. Unsafe assumption about data shape.
- The badge tone was statically `success` regardless of whether the
  qualifying threshold (3) was actually met.

This is the single highest-priority correctness/robustness defect in the
area reviewed (status aggregation, `src/lib/format.ts`, data-shape handling).
`format.ts` was inspected and found sound for its current numeric inputs.

## Decision

Extract a single pure aggregator, `summarizeCriteria(items)`, into
`src/features/case-file/criteria.ts`, returning
`{ total, qualifying, partial, meetsThreshold }` against an explicit
`QUALIFYING_THRESHOLD = 3`. It:
- counts only exact `"Met" | "Strong"` toward `qualifying` and only `"Partial"`
  toward `partial`;
- ignores malformed rows (non-array input, unknown/absent status) instead of
  miscounting them;
- drives both the summary text and the badge tone in `CriteriaTable.tsx`.

A regression test (`criteria.test.ts`, `node:test` via `tsx --test`) pins the
current render (7 qualifying · 1 partial · 8 evaluated) and the data-drift
behavior.

## Consequences

- The eligibility read-out now stays truthful as criteria data evolves; the
  badge tone reflects the real threshold.
- Rendering is unchanged for current data (verified: 7/1/8, success tone),
  and `tsc --noEmit` passes.
- Aggregation logic is now unit-testable and reusable (e.g. the dashboard's
  "92% approval likelihood" / approval estimate could later consume it).
- Introduces a lightweight test convention (`node:test` + `tsx`); no test
  runner dependency added. A future ADR should formalize the test setup if
  test coverage expands.
