# ADR 0003 — Guard `src/lib/format.ts` against non-finite / non-number inputs

- Status: Accepted
- Date: 2026-06-02
- Scope: `src/lib/format.ts` (display layer)
- Relates to: ADR 0001, ADR 0002 (`src/features/case-file` status-safe at runtime)

## Context

The seed flags accumulated correctness/robustness risk in `src/features/case-file`
status aggregation **and** `src/lib/format.ts` edge cases, and asks for the single
highest-priority correctness defect — production-ready, with a regression test,
rendering preserved.

Grounding the two named areas in the actual code:

- **Status aggregation is already hardened.** `criteria.ts` (`summarizeCriteria`,
  `statusTone`) guards malformed/AI-sourced statuses at runtime and is tested
  (ADR 0001/0002); `case-list.ts` (`filterCases`/`sortCases`/`queryCases`) is
  `Array.isArray`-guarded, total, non-mutating. No live defect found there.
- **`src/lib/format.ts` is unguarded.** Every helper trusts a `number` it never
  validates:
  - `format.ts:30` — `formatPercent` returns `` `${value.toFixed(decimals)}%` ``.
    For `null`/`undefined` (the exact AI-sourced data-drift ADR 0001/0002 names)
    `.toFixed` **throws `TypeError`**, crashing the render. For `NaN`/`Infinity`
    it emits `"NaN%"` / `"Infinity%"`.
  - `formatCurrency`, `formatSignedCurrency`, `formatNumber` emit `"$NaN"` /
    `"NaN"` for `NaN`/`Infinity` (e.g. `Math.abs(NaN)` in `formatSignedCurrency`,
    whose sign branches both fall through to `""`).

This is the same threat ADR 0002 fixed one layer over — AI-sourced numeric values
reaching a leaf renderer with no validation boundary — but `format.ts` never got
the guard. `formatPercent`'s throw is the highest-priority item: a cosmetic
`"$NaN"` is ugly; a thrown `TypeError` takes the surface down.

(Note: `format.ts` currently has no importers; it is exported display API that the
case-file surfaces' inline `${likelihood}%` will route through next. Hardening it
now closes the defect before the wiring lands — see Out of scope.)

## Decision

Make the formatters **total and safe** — guard each entry on a finite-number
check and return a single placeholder for invalid input. **Recommended path
(one): degrade-safe, not fail-loud.**

- Add `const INVALID = "—";` and a `finite(v): v is number` guard
  (`typeof v === "number" && Number.isFinite(v)`).
- Each exported helper returns `INVALID` when `!finite(value)`, otherwise behaves
  **exactly as today** (valid-input output is byte-identical — existing rendering
  preserved).

**Considered & rejected — fail-loud (throw):** the sibling `ai-bookkeeper`
ledger `formatMoney` throws on non-finite (banker-rounding / money-arithmetic
decisions, 2026-05-27/28). That convention is correct *there* — `formatMoney`
sits behind a validated arithmetic boundary where non-finite is a programmer
error to surface. This `format.ts` is a leaf display helper consuming AI-sourced
scores with **no upstream validation boundary**, and a throw crashes a client
render — the opposite of the seed's "prioritize stability". We follow this repo's
own ADR 0002 precedent (guard at runtime, degrade safely) rather than the ledger
repo's fail-loud norm, and record the contrast here so the divergence is
deliberate, not silent.

Engineer owns the implementation + regression test (TEAM MODE: scoper hands off,
does not implement).

## Consequences

- No formatter can crash or emit `"$NaN"`/`"NaN%"` on AI-sourced data drift;
  invalid values render a neutral `"—"`, honest and stable.
- Valid-input output is unchanged — zero churn for every current/future caller.
- Cross-repo divergence (degrade-safe here vs. fail-loud in ledger) is documented,
  not silent.

## Out of scope (future work — separate tickets, do NOT bundle)

1. Route the case-file inline percent renders
   (`CaseDetailView.tsx:123,128`, `CaseFileDashboard.tsx:140`, `CaseList.tsx:256`)
   through `formatPercent` so the new guard protects the actual rendered surface.
2. Revisit fail-loud convergence only if `format.ts` ever feeds an arithmetic
   boundary.
