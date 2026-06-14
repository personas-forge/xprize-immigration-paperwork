# Code Refactor — Fix Wave 8 — Long-tail structural cleanup

> 5 commits, 6 findings closed (1 high + 4 med + 1 low; + 1 low ADR note folded in).
> Baseline preserved: tsc 0→0; tests 283→284 pass / 0 fail (+1 threshold test);
> `next build` PASSES; lint clean.

## Commits

| # | Commit | Finding(s) | Severity |
|---|---|---|---|
| 1 | `(qualify threshold)` | eligibility-screening #2 (+#5 ADR note) | H (+L) |
| 2 | `(barrel re-exports)` | validation-jurisdiction #2 | M |
| 3 | `(date helpers)` | validation-jurisdiction #3 | M |
| 4 | `(formField)` | attorney-review #3 | M |
| 5 | `(ensureAdminApp)` | auth-session #3 | L |

## What was fixed

1. **Pack-driven eligibility threshold (the last unaddressed HIGH).** `CriteriaReport` reused the case-file aggregator whose `QUALIFYING_THRESHOLD = 3` is an O-1A constant, so the `/qualify` report's "need N" text + Meets/Below badge ignored the selected pack's threshold — a latent correctness bug (harmless today since all 3 live packs are 3, but the planned UK pack is 2). `summarizeCriteria` now takes an optional `threshold` (defaults to `QUALIFYING_THRESHOLD`, so the case-file dashboard is unchanged); `CriteriaReport` takes a `threshold` prop and `QualifyPanel` passes `packFor(classification).threshold`. +1 test; ADR-0001 noted (closes #5).
2. **Dropped unused `daysBetween` / `liveJurisdictions` barrel re-exports** — internal helpers that leaked into the `@/features/qualification` public surface with zero external importers (tsc confirms). Kept as module exports.
3. **Single-sourced `todayIso()` + `addDays()`** — the same date primitives were re-inlined in the `/validation` page, the CI freshness script, `freshnessOf`'s `dueBy` math, and the test. One home in `validation.ts`; `freshnessOf` uses `addDays` (identical math, verified by its test).
4. **Extracted `formField()`** in the review server actions — `addReviewNote` + `attorneyRequestChanges` each inlined `String(get).trim().slice(0,4000)`; the 4000-cap now lives in one helper.
5. **Single-sourced the firebase-admin app init** — `adminAuth` + `adminDb` each inlined the guarded `initializeApp`; extracted `ensureAdminApp()` (credential resolution unchanged). Both still share one default app.

## Resolved-by-earlier-wave / intentionally left

- **eligibility #4 (idFor dup, M)** — was 3 copies; Wave 1's deletion of `questionnaire.ts` + its test removed 2, leaving `qualification.ts` as the sole copy. **Resolved** — no dedup needed.
- **validation #4 (`provisional` ValidationStatus, L)** — left as-is: the report itself flags it may be a roadmapped tier, and the `Record<ValidationStatus,…>` maps are exhaustive. Won't-fix unless the tier is confirmed dead.

## Verification

| Gate | After Wave 7 / follow-ups | After Wave 8 |
|---|---|---|
| `tsc --noEmit` errors | 0 | 0 |
| tests pass / fail | 283 / 0 | 284 / 0 |
| `next build` | PASS | PASS |
| lint (touched files) | clean | clean |

## Cumulative status (waves 1–8 + 3 follow-ups)

~52 of 88 findings closed; the lone CRITICAL closed (5/5 charged routes on the orchestrator); 1 false positive rejected; the engine shared-core + pricing surface + draft migration follow-ups all landed. Branch `refactor/code-refactor-2026-06-14`, off `main`, not pushed.

## What remains (the honest tail)

- **FAQ answer content** — flagged for the user; service-scope/legal claims needing a business decision.
- **Lower-value structural dups not yet taken** (acceptable to leave; per-theme pickups): guidance #3 (`GuidanceResponse`→`Result<T>`), criteria-table merge (case-file #2 — god-component risk), `createPersistentValue` (case-file #3 — contract mismatch), SiteHeader/Footer dedup (marketing #2 — drifted nav), RfeStudio paywall JSX (rfe #5), consent #2/#3 (profile-derivation / email-prop), rate-limiting #2/#3 (module location / IP-extraction), llm-engine #3/#4, token-economy #2/#3/#4, data-adapter #4/#5, evidence-vault #4, event-bus #2/#3/#4, validation #5, attorney-review #2/#4, eligibility... .
- **Intentionally kept:** addReviewNote double-resolve (L), ai-orchestrator #3 type-mirroring (intentional test isolation), validation #4 `provisional` (possibly roadmapped).

These are genuine M/L polish — none block; close per-theme as the codebase evolves.
