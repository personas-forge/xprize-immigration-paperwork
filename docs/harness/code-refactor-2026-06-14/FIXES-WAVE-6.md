# Code Refactor — Fix Wave 6 — UI chrome de-duplication

> 3 commits, 3 findings closed (1 high + 2 low). View-layer wave, scoped honestly.
> Baseline preserved: tsc 0→0; tests 281→281 pass / 0 fail; **`next build` compiled
> successfully**; lint clean. All three changes are **byte-identical** to the prior
> render (the user evaluates visually — no rendered-output change was made).

## Commits

| # | Commit | Finding | Severity |
|---|---|---|---|
| 1 | `(DashboardChrome)` | brand-design-system #2 ≡ case-file #1 | H |
| 2 | `6558fc0` | brand-design-system #5 (glyph prop) | L |
| 3 | `045b46c` | case-file-dashboard #5 (teal/midnight) | L |

## What was fixed

1. **Extracted shared `BalancePill` + `LocalThemeToggle`.** Both were copy-pasted byte-for-byte across all three dashboard shells (DashboardView, CaseDetailView, ReviewQueueView) — ~70 lines of duplicate JSX. Moved to `@/features/dashboard/DashboardChrome`; the prop contract (`{balance}` / `{dark,onToggle}`) and markup are unchanged → rendered output identical. Renamed the prop-driven toggle `LocalThemeToggle` to distinguish it from the canonical persisted `@/components/ThemeToggle`.
2. **Removed the vestigial `glyph` prop** from `DashboardTopBar` (self-documented "accepted for API compat; unused" — the Wordmark draws the mark) and the `glyph="✦"` passed by all three shells.
3. **Removed dead `teal`/`midnight` theme aliases** + their now-false justification comment (every consumer imports `ink`/`parchment`; nothing imports the aliases).

## Scoped out (deferred, with rationale — NOT skipped)

This wave deliberately did the **safe, byte-identical** chrome dedup and stopped. The remaining UI findings each carry a real cost the "scope UI refactors honestly" lesson warns against:

- **case-file #2 — criteria-table merge (H).** `CriteriaTable` (mock dashboard) and `CaseDetailView`'s inline table genuinely differ: different row shapes (`exhibit` vs `rationale`), and the detail table omits the primer button + summary badge. Merging into one component needs flags for every divergence → a god-component. Deferred (forcing it is the over-broad refactor the medical-bill-negotiator lesson flags).
- **marketing #2 — SiteHeader/SiteFooter across 5 routes (H).** The copies have already **drifted** (different footer nav links per page), so consolidating to one component is a *visible nav change*, entangled with the retired-pricing decision (#1/#4). Changing marketing nav is visual UX the user should review. Deferred.
- **marketing #1 — retired flat-fee pricing copy (H) & #3 — landing-claude content dup (M).** Both are **product/copy decisions** (the scan itself says "flag before deleting") — out of scope for an autonomous refactor. **Flagged for the user:** the homepage advertises a retired $2,500/$3,500/$4,500 flat-fee model while `/billing` sells token bundles — a live pricing contradiction worth a deliberate copy update.
- **case-file #3 — `createPersistentValue` store dedup (M).** `bannerDismiss` has an **injectable-storage** API with 6 dedicated tests; `usePersistentQuery` is hook-only/window-based. A shared primitive is marginal and risks the tested injectable contract — same "don't force genuinely-different things together" call as the criteria-table.
- **rfe #5 — RfeStudio paywall/placeholder JSX (L).** Visual leaf-component extraction; higher-risk/lower-reward, and the two studios have real layout differences. Deferred.

## Verification

| Gate | After Wave 5 | After Wave 6 |
|---|---|---|
| `tsc --noEmit` errors | 0 | 0 |
| tests pass / fail | 281 / 0 | 281 / 0 |
| `next build` | PASS | PASS |
| lint (touched files) | clean | clean |

## Cumulative status (waves 1–6)

| Wave | Theme | Findings closed | Commits |
|---|---|---:|---:|
| 1 | Dead-code deletion | 7 | 7 |
| 2 | Disclaimer / UPL single source of truth | 6 | 5 |
| 3 | LLM parse/coercion consolidation | 6 | 3 |
| 4 | Adapter migration (ADR-0010) | 7 | 5 |
| 5 | Orchestrator adoption (ADR-0004) | 3 + critical | 4 |
| 6 | UI chrome de-duplication | 3 | 3 |

**32 of 88 findings closed; critical substantially addressed; 1 FP rejected; 2 Low intentionally kept.** Pattern catalogue: 11 items.

## Pattern established (catalogue item 11)

11. **For a visually-evaluated UI, prefer byte-identical extraction; defer the rest honestly.** Dedup chrome only where the copies are *character-identical* (extract, keep the prop contract, rendered output unchanged). When copies have **drifted** (marketing nav) consolidation is a visible change needing review; when the "shared" thing genuinely differs (criteria-table columns/features, the injectable-vs-window store contracts) merging risks a god-component or breaks a tested contract. Naming the deferral + its reason is the deliverable, not a half-done merge.

## What remains

32 → ~49 distinct issues open. Next per the INDEX: **Wave 7 — money-path + engine-mirror + misc** — checkout `tokens` metadata + refund symmetry (checkout #1/#3), the drifted eval-harness engine mirror (llm-eval #1/#2 ≡ llm-engine #1), the deferred guidance #3 `GuidanceResponse`→`Result<T>`, the pricing-link repointing (marketing #4), and the small leftovers (ai-orchestrator #4 docstring, rate-limiting #4 `windowMs`). Plus the cross-wave deferrals above (criteria-table, SiteHeader, the pricing copy decision, createPersistentValue, RfeStudio) and the draft-route orchestrator migration — best done with route-test coverage / a product decision.
