# Wave B — Compliance prompt scaffolding + drafting structure

Branch: `vibeman/code-refactor-2026-06-29` (builds on Wave A).
Theme: behavior-preserving consolidation of the petition-draft ↔ RFE prompt
scaffolding, and a structural split of the 857-line `drafting.ts`.

**Gates:** `tsc --noEmit` clean and `npm test` **443 → 443** passing throughout
(no test added/weakened/deleted). Prompt text is byte-identical — proven by the
existing `buildDraftPrompt`/`buildSectionPrompt`/`buildRfePrompt`/
`buildRfeForecastPrompt`/`buildCritiquePrompt` content tests, which assert on the
assembled prompt strings and stayed green without edits.

## Commits

| Hash | Findings | One-line |
|------|----------|----------|
| `159b8ba` | petition #1/#2/#3, rfe #1 | Single-source compliance prompt scaffolding (`SHARED_FILING_RULES`, `STRICT_JSON_PREAMBLE`, `criteriaHaveExhibits`, shared `criteriaLines`) + fix lying header comment |
| `a9bc0ca` | petition #5, rfe #2 | Single-source the mock `exhibitCitationSentence` |
| `d5b1140` | petition #4 | Split critique → `critique.ts` and citation-audit → `citation-audit.ts` |
| `331d779` | rfe #4, rfe #5 | Dedupe scored-criterion shape to `CriterionLineInput`; drop no-op `parseCriteria` wrapper |

## Findings closed

- **petition #1 / rfe #1 (HIGH)** — Lifted the byte-identical STRICT-RULES rules
  2/3/4 into `SHARED_FILING_RULES` and the JSON envelope line into
  `STRICT_JSON_PREAMBLE` (both in `criteria-text.ts`). Spliced into
  `buildDraftPrompt`, `buildCritiquePrompt`, `buildRfePrompt`,
  `buildRfeForecastPrompt`. Each builder keeps its own feature-specific rule 1 +
  data-marker rule 5. Output unchanged (content tests green).
- **petition #2 (MED)** — `criteriaHaveExhibits()` replaces the triplicated
  `c.exhibits && c.exhibits.length > 0` gate (`hasExhibits`, `rfeHasExhibits`,
  `buildSectionPrompt`).
- **petition #3 (MED)** — One shared `criteriaLines(criteria, { emptyFallback? })`
  (in `drafting.ts`, beside its `exhibitBullets` dependency) replaces the
  draft/RFE/forecast copies; the inaccurate `criteria-text.ts` header comment is
  corrected.
- **petition #4 (MED)** — `drafting.ts` 857 → 661 lines. The Adjudicator-critique
  subsystem moved to `critique.ts` (175 lines) and the citation-integrity audit to
  `citation-audit.ts` (102 lines). Pure move: `drafting.ts` re-exports both, so the
  index barrel, `./drafting` importers, operations, components, and tests are
  unchanged. Type-only imports back to `./drafting` are erased → **no runtime
  cycle**. `numericVersion` (a draft-version helper, not critique) was relocated
  beside the other coercion helpers rather than moved.
- **petition #5 / rfe #2 (LOW/MED)** — `exhibitCitationSentence()` replaces the
  duplicated `"This is documented by (Exhibit N), …. "` mock fragment in
  `criterionBody` and `mockRfe`.
- **rfe #4 (LOW)** — `toRfeCriterion` now takes `CriterionLineInput`;
  `RfeStudioCriterion` aliases it (was a third byte-identical copy).
- **rfe #5 (LOW)** — Deleted the no-op `parseCriteria` wrapper in
  `forecastOperation.ts`; call `parseCriteriaArray` directly.

## Deliberately left inline (byte-identity could not be proven)

- **The `(Exhibit N)` citation rule** (petition #1's "triplicated with drift"
  fragment). The three copies — `CITATION_RULE` (draft), the `buildSectionPrompt`
  inline pair, and the `buildRfePrompt` rule 6 — are **three different wordings**.
  Unifying them into one canonical const would CHANGE the emitted prompt text of
  at least two paid endpoints, i.e. edit a compliance contract. That is out of
  scope for a behavior-preserving wave, so each wording stays inline. **Follow-up
  (needs a product/compliance decision):** if the team wants one canonical exhibit
  citation rule, that is an intentional prompt-text change with test updates — not
  a refactor.
- **`buildSectionPrompt`'s compressed prose preamble** (petition #1's "4th copy").
  It is a deliberately shortened, differently-worded preamble — not byte-identical
  to `SHARED_FILING_RULES` — so it was not folded in.

## Deferred

- **rfe #3 (MED, dead code)** — `parseRfeResponse` / `parseDraftResponse` are
  tests-only convenience wrappers (the route uses `tryParse*` + `mock*` directly).
  The clean fix is deletion, but that requires removing their unit tests, which
  this wave's rules forbid (no weakening/deleting tests). Left as-is. The report's
  own alternative — a one-line "// convenience wrapper — route uses guard+mock
  directly" note — is a safe follow-up.

## Net effect

`criteria-text.ts` now owns the shared compliance scaffolding
(`SHARED_FILING_RULES`, `STRICT_JSON_PREAMBLE`, `criteriaHaveExhibits`,
`criterionLine`, `parseCriteriaArray`, `marketBarFraming`); `drafting.ts` owns the
shared renderers (`criteriaLines`, `exhibitBullets`, `exhibitCitationSentence`) and
re-exports the critique + citation-audit subsystems from their new sibling modules.
The two paid LLM endpoints can no longer drift on the compliance/citation contract.
