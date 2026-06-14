# Code Refactor — Fix Wave 1 — Dead-code deletion

> 7 commits, 7 findings closed. Net −677 LOC (2 insertions, 679 deletions across 16 files).
> Baseline preserved: tsc 0→0 errors; tests 298→282 pass / 0 fail (the 16-test drop is the
> deleted dead-code tests, `questionnaire.test.ts` + `format.test.ts`; no live coverage lost).
> Lint clean on all touched files.

## Commits

| # | Commit | Finding closed | Severity | Files |
|---|---|---|---|---|
| 1 | `fb7737d` | eligibility-screening #1 — dead `questionnaire.ts` module | H | questionnaire.ts (+test), qualification/index.ts |
| 2 | `d22f7e9` | brand-design-system #1 — dead `src/lib/format.ts` | H | format.ts (+test), adr/0003 |
| 3 | `845b21c` | evidence-vault #3 — dead `documents.ts` mock layer | M | data/documents.ts, data/index.ts |
| 4 | `9ea5092` | attorney-review #1 ≡ auth-session #2 — dead `setCaseStatus` wrapper | H | data/reviews.ts |
| 5 | `a9f5f0b` | validation #1 — dead `isStale` (superseded by `freshnessOf`) | H | validation.ts (+test), qualification/index.ts |
| 6 | `4295b76` | case-file #4 — dead `getCaseById` / `getFormById` reads | M | data/cases.ts, data/forms.ts, data/index.ts |
| 7 | `fdc024d` | brand #3, #4 — unused `StatCard` / `SectionHeader` kit exports | M | ui/StatCard.tsx, ui/SectionHeader.tsx, ui/index.ts |

## What was fixed (all Theme E — definitely-dead exported surface)

1. **`questionnaire.ts` whole module** — `buildQuestionnaire`/`scoreQuestionnaire`/`answersToProfile` (~177 src + 146 test LOC) had zero UI/route callers; the standalone questionnaire flow was superseded by the qualify screening path. The biggest single LOC win of the wave.
2. **`src/lib/format.ts`** — `formatCurrency`/`formatSignedCurrency`/`formatNumber`/`formatPercent` and the `@/lib/format` path had no production importer. ADR-0003 (which documented only this module's non-finite guard) removed with it.
3. **`src/lib/data/documents.ts`** — the `getDocuments()` mock fixture had no consumer; the vault reads through `lib/data/evidence.ts`. The shared `CaseDocument` type lives in `@/features/case-file/types` and is untouched.
4. **`reviews.setCaseStatus`** — the bare non-atomic `store.setCaseStatus` passthrough had no caller; the workflow advances status through the atomic `transitionCase` compare-and-set. Leaving a non-atomic status setter in a legal audit path was an attractive-nuisance. The `Store.setCaseStatus` method it wrapped is untouched.
5. **`isStale`** — no production caller; both real consumers (the freshness CI script and `/validation`) use the richer `freshnessOf()`. Keeping it duplicated the `REVALIDATE_AFTER_DAYS` threshold. Test trimmed to keep `daysBetween` coverage.
6. **`getCaseById` / `getFormById`** — no non-barrel callers; the case detail page reads through the gated adapter. `getCaseById` only searched the mock fixture — an IDOR-adjacent footgun if it had ever been wired. The now-unused `PetitionCase` import was dropped too.
7. **`StatCard` / `SectionHeader`** — exported from the UI kit barrel with zero consumers (distinct from legitimately single-use kit components).

## Verification

| Gate | Baseline (B2) | After Wave 1 |
|---|---|---|
| `tsc --noEmit` errors | 0 | 0 |
| tests pass / fail | 298 / 0 | 282 / 0 |
| lint (touched files) | — | clean |

The test delta (−16) is entirely the deleted dead-code tests. Every test that exercises live code still passes.

## Cumulative status (waves 1–N)

| Wave | Theme | Findings closed | Commits |
|---|---|---:|---:|
| 1 | Dead-code deletion | 7 | 7 |

**7 of 88 findings closed.** Pattern catalogue: 4 items (below).

## Patterns established (catalogue items 1–4)

1. **Barrel-only export = dead.** A symbol referenced only by its own definition, its test, and a barrel `index.ts` re-export has no real consumer. Verify by grepping the symbol repo-wide and confirming every hit is def/test/barrel before deleting. (Caught: `questionnaire`, `format`, `getCaseById`, `getFormById`, `StatCard`, `SectionHeader`.)
2. **Superseded-helper duplication.** When a richer function replaces an older one (`freshnessOf` ⊃ `isStale`, `transitionCase` ⊃ `setCaseStatus`), the old one lingers as dead surface AND duplicates a constant/threshold. Delete the loser, not just deprecate it — especially when it's a non-atomic or unscoped footgun in a sensitive path.
3. **Deleting code means deleting its test — and trimming shared-helper tests.** A test that asserts only the deleted symbol is deleted wholesale; a test that asserts the deleted symbol *and* a surviving one (e.g. `daysBetween / isStale`) is trimmed to the survivor, not deleted. Re-run the single test file before committing.
4. **Unused-import fallout.** Removing a function often orphans an import that was only its return type (`PetitionCase`). `tsc --noEmit` (TS6133) catches it deterministically — re-run after every deletion and clear the orphan in the same commit.

## What remains

87 → 81 distinct issues open. Deferred dead-code items not taken this wave (folded into later waves to avoid touching their files twice): `getAnalytics` + analytics subscriber (event-bus #1, removes a subscriber), `OPERATIONS`/`OP_COST`/`costOf` re-exports (token-economy — its own structural pass), `isOk` (part of the AdapterResult API, touched in Wave 4), and the trivial one-liners (`provisional` status, `teal`/`midnight` theme aliases, `daysBetween`/`liveJurisdictions` barrel re-exports, `glyph` prop, `windowMs` param) → Wave 7 misc cleanup.

Next per the INDEX plan: **Wave 2 — Disclaimer / UPL single source of truth** (collapse the divergent `ATTORNEY_DISCLAIMER` + redundant `DISCLAIMER` re-exports to one canonical constant).
