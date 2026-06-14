# Code Refactor Scan — O-1A Eligibility Screening & Questionnaire

> Total: 5 (C0 / H2 / M2 / L1)

## 1. Entire `questionnaire.ts` module is dead (no UI/route caller)
- **Severity**: high
- **Category**: dead-code
- **File**: src/features/qualification/questionnaire.ts:86 (whole module: buildQuestionnaire / scoreQuestionnaire / answersToProfile + EligibilityQuestion/Questionnaire/Answer/Answers/EligibilityOutcome/Verdict types)
- **Scenario**: The "structured eligibility questionnaire" was built and unit-tested as the GUIDED alternative to the free-text profile box, but nothing in the app ever calls it. `QualifyPanel.tsx` only renders the free-text `<textarea>` → `/api/qualify`; there is no yes/no/unsure UI, and `/api/qualify` consumes `profile` directly (never `answersToProfile`).
- **Root cause**: A feature whose front-end (a questionnaire screen) was never built. The barrel `index.ts:36-45` re-exports it, which keeps it "used" for the type-checker but it has no runtime consumer.
- **Impact**: ~177 lines of source + 146 lines of test (`questionnaire.test.ts`) maintained for a path users can't reach. Carries a second copy of the criterion-id slug logic (see finding 4) and a duplicate `DISCLAIMER` import, inflating the qualification feature surface.
- **Verification**: `grep -rn "buildQuestionnaire|scoreQuestionnaire|answersToProfile"` across the whole repo returns ONLY: questionnaire.ts itself, its test, the barrel `index.ts`, `CHANGELOG.md`, and `docs/plans/feature-roadmap-2026-06-13.md:413` — whose own text states "a grep shows zero UI/route callers — only the free-text textarea exists." No dynamic import, no Next.js convention, no API route references it.
- **Fix sketch**: Either (a) build the questionnaire UI the roadmap describes (wire `buildQuestionnaire`/`scoreQuestionnaire` into a guided panel, bridge to `/api/qualify` via `answersToProfile`), or (b) delete `questionnaire.ts` + `questionnaire.test.ts` and drop its block from `index.ts:35-45`. Pick one — leaving it dead is the worst option. Confirm with product owner since it is a designed-but-unbuilt feature, not accidental cruft.

## 2. CriteriaReport hardcodes the O-1A threshold (3) for every classification it renders
- **Severity**: high
- **Category**: duplication
- **File**: src/features/qualification/components/CriteriaReport.tsx:5,32,49,74
- **Scenario**: `/qualify` offers O-1A, O-1B and EB-1A (`livePrograms()`), and persists the selected `classification`. But the report's "need {QUALIFYING_THRESHOLD} to qualify" text and `summary.meetsThreshold` both come from `@/features/case-file/criteria`, where `QUALIFYING_THRESHOLD = 3` is a fixed O-1A constant — it ignores `result`'s actual pack `threshold`. The pack model (`packs.ts:33`) already carries a per-classification `threshold` (and `VisaPack`/`packFor`/`packs.threshold` is the documented single source of truth per ADR-001 / questionnaire.ts).
- **Root cause**: `CriteriaReport` borrowed the case-file dashboard's aggregator wholesale. The case-file is O-1A-only, so its constant `3` was never parameterized; the multi-product qualify report reused it without threading the pack threshold through.
- **Impact**: Latent correctness bug on an eligibility surface. Today all three LIVE packs happen to be `threshold: 3`, so nothing misreports — but the planned `UK-Global-Talent` pack is `threshold: 2`, and the moment any offered pack's threshold differs from 3 the report will show the wrong "need N" and a wrong Meets/Below-threshold badge. This is exactly the class of defect ADR-0001 was written to kill (a literal threshold drifting from the data).
- **Verification**: Read `CriteriaReport.tsx` (imports `QUALIFYING_THRESHOLD` + `summarizeCriteria` from case-file), `criteria.ts:8,93` (`QUALIFYING_THRESHOLD = 3`, `meetsThreshold: qualifying >= QUALIFYING_THRESHOLD`), `packs.ts:169-205` (UK pack threshold 2), and `jurisdictions.ts:63` (O-1A/O-1B/EB-1A live). `summarizeCriteria` never receives a threshold argument.
- **Fix sketch**: Pass the pack threshold into the report (e.g. `summarizeCriteria(criteria, packFor(classification).threshold)` with an optional threshold param defaulting to `QUALIFYING_THRESHOLD`) and render that value instead of the hardcoded constant. Have `QualifyPanel` pass `classification` to `CriteriaReport`, or read it from the persisted result.

## 3. Redundant `DISCLAIMER` re-export from qualification.ts
- **Severity**: medium
- **Category**: structure
- **File**: src/features/qualification/qualification.ts:19,25
- **Scenario**: `qualification.ts` imports `DISCLAIMER` from `@/features/guidance/guidance` (line 19) for internal use, then immediately re-exports it (`export { DISCLAIMER };`, line 25). The feature barrel re-exports it again (`index.ts:2`), and the evidence barrel re-re-exports it (`evidence.ts:26`). The canonical owner is `@/features/guidance`.
- **Root cause**: Convenience re-export added so callers could grab the disclaimer from the qualification module; it created a third hop in a re-export chain for a constant that has a clear home.
- **Impact**: Two consumers actually import it via this chain (`QualifyPanel.tsx:7`, plus the qualification test), so it is not dead — but the multi-level re-export obscures the source of truth for a compliance-critical constant and was specifically called out as a de-barreling target in the repo's memory-optimization work. Low blast radius, easy to straighten.
- **Verification**: `grep` shows `DISCLAIMER` defined in guidance, imported into qualification.ts (used by `buildQualifyResult`), re-exported at line 25, and pulled by `QualifyPanel.tsx` from `"../qualification"`. Changing the import sites to `@/features/guidance/guidance` is mechanical.
- **Fix sketch**: Drop the `export { DISCLAIMER };` at line 25; point `QualifyPanel.tsx` (and the test) at `@/features/guidance/guidance` directly. Keep the internal import for `buildQualifyResult`.

## 4. Criterion-id slug logic (`idFor`) duplicated three times
- **Severity**: medium
- **Category**: duplication
- **File**: src/features/qualification/qualification.ts:78 ; src/features/qualification/questionnaire.ts:72 ; src/features/qualification/questionnaire.test.ts:19
- **Scenario**: The exact slug expression `name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")` is copy-pasted as `idFor` in `qualification.ts`, again as `idFor` in `questionnaire.ts`, and a third time as `slug()` in `questionnaire.test.ts`. The comment in questionnaire.ts:69 even says it "MUST match `idFor` in qualification.ts" — an invariant enforced only by a hand-copied regex.
- **Root cause**: No shared helper for the criterion-name → stable-id transform; each consumer re-implemented it. The id is the join key between a scored criterion, a questionnaire answer, and persisted criteria rows, so a drift between copies would silently break that mapping.
- **Impact**: Correctness risk by copy-paste (the link between QuestionPanel answers and the scoring engine depends on byte-identical slugging). Resolving finding 1 by deleting questionnaire.ts removes two of the three copies for free; otherwise factor out one helper.
- **Verification**: `grep "toLowerCase().replace(/[^a-z0-9]"` returns exactly those three sites and nothing else; `packs.ts` does not define ids (it is name-keyed). No other slug variants exist in the feature.
- **Fix sketch**: Export a single `criterionId(name: string)` (in `packs.ts`, the criteria source of truth) and have `qualification.ts` + `questionnaire.ts` import it; the test should assert against the real helper rather than re-deriving it. If questionnaire.ts is deleted (finding 1), only the qualification.ts ↔ test pair remains to dedupe.

## 5. Stale doc-scope claim in ADR-0001 vs. shared aggregator now used by qualify
- **Severity**: low
- **Category**: cleanup
- **File**: docs/adr/0001-criteria-status-aggregation.md:6,54
- **Scenario**: ADR-0001 scopes itself to `src/features/case-file` and notes the aggregator is "reusable (e.g. the dashboard's likelihood could later consume it)." In reality `summarizeCriteria`/`statusTone`/`QUALIFYING_THRESHOLD` are now also consumed by the qualification feature's `CriteriaReport.tsx` (a different feature), and the ADR also references `src/lib/format.ts` as inspected-and-sound — a file the memory notes flags as dead in a sibling project's audit.
- **Root cause**: ADR not updated after the qualify report adopted the case-file aggregator (the cross-feature coupling behind finding 2).
- **Impact**: Cosmetic/documentation only — the ADR understates the real consumer set, which is exactly why finding 2's threshold coupling is easy to miss. No code effect.
- **Verification**: `grep "summarizeCriteria"` / `"QUALIFYING_THRESHOLD"` shows imports from both `case-file/components/CriteriaTable.tsx` AND `qualification/components/CriteriaReport.tsx`. ADR scope line still says only `src/features/case-file`.
- **Fix sketch**: When fixing finding 2, add a one-line note to ADR-0001 (or a follow-up ADR) recording that the aggregator is shared with the qualification report and that the threshold must be pack-driven there.
