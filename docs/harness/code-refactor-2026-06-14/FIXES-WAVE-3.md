# Code Refactor — Fix Wave 3 — LLM parse/coercion consolidation

> 3 commits, 6 findings closed + 1 false positive caught & documented.
> Baseline preserved: tsc 0→0 errors; tests 283→283 pass / 0 fail (Fixes 1 & 3 are
> behavior-preserving; no tests added/removed). Lint clean on all 6 touched files.

## Commits

| # | Commit | Finding closed | Severity | Notes |
|---|---|---|---|---|
| 1 | `131e8b4` | petition #1 ≡ rfe #2; llm-engine #2 (partial) | H | extract `toSection` + `tryParseSections` |
| 2 | `3488dcb` | rfe #3 (the `RfeSection` half) | M | `parse*` half **rejected — false positive** |
| 3 | `d1ba51f` | petition #5 ≡ rfe #4 | L/M | share `str` + `criterionLine` + caps |

## What was fixed

1. **Shared `toSection` + `tryParseSections`.** The section-coercer — the load-bearing validity gate for paid work product — was copy-pasted byte-for-byte across `drafting.ts`, `rfe.ts`, and `saveRecovery.ts`, and the `{sections:[...]}` parse loop was duplicated between the draft and RFE strict parsers. Both now live once in `drafting.ts` (the `DraftSection` owner) and are imported by rfe + saveRecovery. A future hardening (length caps, control-char stripping) lands in one place. Kept in the feature layer (not `@/lib/llm`) to avoid the feature→lib import cycle the report warned about.
2. **Removed the dead `RfeSection` re-export** (`export type { DraftSection as RfeSection }`) — zero importers repo-wide.
3. **Shared `str` + `criterionLine` + common caps** (`MAX_PETITIONER`/`MAX_TEXT`/`MAX_CRITERIA`) via a new `criteria-text.ts`. The byte-identical input sanitizer and the citation-discipline prompt-bullet format no longer live in two places. Per the scan's caution, the two `parse*Request` validators and the `criteriaLines` wrappers stay per-feature (the request shapes + RFE's empty-criteria guard genuinely differ).

## Verify-before-fix catch — a FALSE POSITIVE rejected

Findings petition #2 / rfe #3 proposed deleting `parseDraftResponse` / `parseSectionResponse` / `parseRfeResponse` as "test-only dead wrappers." **This is a false positive.** After deleting them, `tsc` immediately failed: the LLM eval harness (`scripts/llm-eval/run.ts:114,127,137`) imports and calls all three to produce a complete result for evaluation. The scan agent's verification grepped `src/` only and missed `scripts/`; my own first grep made the same omission. **The wrappers are live and were kept** — I reverted the deletion and removed only the genuinely-dead `RfeSection` re-export.

This is the second FP this run that a `src/`-scoped grep produced (Wave 2's qualification `DISCLAIMER` re-export was the first, via relative-path consumers). The lesson is now a catalogue item.

## Verification

| Gate | After Wave 2 | After Wave 3 |
|---|---|---|
| `tsc --noEmit` errors | 0 | 0 |
| tests pass / fail | 283 / 0 | 283 / 0 |
| lint (touched files) | clean | clean |

## Cumulative status (waves 1–3)

| Wave | Theme | Findings closed | Commits |
|---|---|---:|---:|
| 1 | Dead-code deletion | 7 | 7 |
| 2 | Disclaimer / UPL single source of truth | 6 | 5 |
| 3 | LLM parse/coercion consolidation | 6 | 3 |

**19 of 88 findings closed; 1 finding rejected as a false positive (documented).** Pattern catalogue: 8 items.

## Patterns established (catalogue items 7–8)

7. **Grep `scripts/` and `e2e/`, not just `src/`, before calling an export dead.** A helper can have its only non-test consumer in the eval harness (`scripts/llm-eval/run.ts`) or a Playwright spec. A `src/`-scoped deadness grep is necessary but not sufficient — `tsc --noEmit` after the deletion is the authoritative check (it sees the whole `tsconfig` include set). Two of this run's FPs came from this exact omission.
8. **Single-source a shared helper at the type owner, not by inverting the dependency.** `toSection` operates on `DraftSection` (owned by `drafting`). Moving it to `@/lib/llm` (as one report suggested) would force a lib→feature import — a cycle/inversion. Export it from the type's home feature and let the twin feature import across; the "twin of drafting" coupling already exists by design.

## What remains

19 → ~63 distinct issues open. The two big architectural themes are next (deferred at the user's pause point): **Wave 4 — adapter migration completion (ADR-0010)**, auth-sensitive (`/api/rfe`, categorize, `cases/[id]/page.tsx` inline gate); **Wave 5 — orchestrator adoption (ADR-0004)**, money-path sensitive (`draft`/`rfe`/`categorize` onto `executeAiOperation`; the `draft/save` 429 disclaimer drift). Then Wave 6 (UI chrome dedup) and Wave 7 (money-path + engine-mirror + misc, incl. the deferred form-field-guidance #3 `GuidanceResponse`→`Result<T>`).
