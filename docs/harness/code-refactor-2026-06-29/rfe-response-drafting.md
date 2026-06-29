# Code Refactor — RFE Response Drafting
> Total: 5
> Critical: 0 | High: 1 | Medium: 2 | Low: 2

## 1. Compliance/JSON prompt scaffolding duplicated verbatim across the RFE and Petition prompt builders
- **Severity**: High
- **Category**: consolidation
- **File**: `src/features/rfe/rfe.ts:244-248` and `:286` (also `:450`) vs `src/features/drafting/drafting.ts:255-259` and `:277`
- **Scenario**: `buildRfePrompt` and `buildDraftPrompt` already share leaf helpers (`marketBarFraming`, `criterionLine`, `parseCriteriaArray` in `criteria-text.ts`), but three STRICT-RULE lines are still copy-pasted word-for-word in each builder:
  - Rule 2 — `"2. This is a DRAFT for attorney review — never legal advice, never final."`
  - Rule 3 — `"3. Formal, professional tone suitable for a USCIS filing."`
  - Rule 4 — the 3-line "Do NOT cite case law… the attorney of record will add any case-law authorities." block.
  These appear identically at `rfe.ts:244-248` and `drafting.ts:255-259`. Separately, the JSON envelope preamble `"Return STRICT JSON ONLY (no markdown, no prose), shaped exactly:"` is hand-duplicated in all three builders (`rfe.ts:286`, `rfe.ts:450` forecast, `drafting.ts:277`).
- **Root cause**: When the RFE feature was cloned from drafting, only the per-criterion rendering and market-bar framing were extracted to `criteria-text.ts`; the shared *compliance* rules (rules 2/3/4) and the JSON preamble were left inline in each builder.
- **Impact**: These three rules are a legal/compliance contract ("draft not legal advice", "no case law") that MUST stay in lockstep across both paid LLM endpoints. With two verbatim copies, a future hardening edit (e.g. tightening the case-law rule for a regulatory change) can land in one prompt and silently miss the other — a compliance drift bug on signable attorney work product, not just cosmetic dup.
- **Fix sketch**: Add to `criteria-text.ts` a `SHARED_FILING_RULES: readonly string[]` (the draft/legal-advice/tone/case-law lines) and a `STRICT_JSON_PREAMBLE` constant, then splice `...SHARED_FILING_RULES` into both `buildRfePrompt` and `buildDraftPrompt` (each keeps its own feature-specific rule 1 + data-marker rule 5). Single-sources the compliance contract the way `marketBarFraming` already single-sources the value framing.

## 2. Deterministic exhibit-citation sentence duplicated between mockRfe and the drafting mock
- **Severity**: Medium
- **Category**: duplication
- **File**: `src/features/rfe/rfe.ts:347-349` vs `src/features/drafting/drafting.ts:791-796`
- **Scenario**: Both deterministic fallbacks build the identical sentence fragment from a criterion's exhibits. `mockRfe`: `` `This is documented by ${c.exhibits.map((ex) => `(Exhibit ${ex.number})`).join(", ")}. ` ``. `criterionBody` (drafting): the same `` `This is documented by ${exhibits.map((ex) => `(Exhibit ${ex.number})`).join(", ")}. ` ``. Same output string, two hand-rolled copies.
- **Root cause**: `exhibitBullets` (the *prompt-side* exhibit renderer) was already extracted to `drafting.ts` and reused by RFE, but the *mock-output-side* "This is documented by (Exhibit N)" sentence was never lifted, so each mock re-implements it.
- **Impact**: Moderate. The two keyless/template outputs can drift in phrasing or in how multiple exhibits are joined, and any change to the citation rendering (e.g. "(Exhibits 1, 2)" plural form) has to be made in two places.
- **Fix sketch**: Add an exported `exhibitCitationSentence(c: { exhibits?: readonly DraftExhibit[] }): string` beside `exhibitBullets` in `drafting.ts` (returns `""` when no exhibits) and call it from both `mockRfe` and `criterionBody`.

## 3. `parseRfeResponse` is dead in production — only its own unit tests call it
- **Severity**: Medium
- **Category**: dead-code
- **File**: `src/features/rfe/rfe.ts:325-327` (re-exported `src/features/rfe/index.ts:15`)
- **Scenario**: `parseRfeResponse(text, req)` = `tryParseRfeResponse(text) ?? mockRfe(req)`. Grep across `src/` shows it is referenced only at its definition, the `index.ts` re-export, and four times in `rfe.test.ts` — never in any route or component. The live route (`src/app/api/rfe/route.ts:95-96`) deliberately uses the two halves separately (`guard: tryParseRfeResponse`, `mock: mockRfe`) so it can reclaim the token and label a silent fallback "mock". Its twin `parseDraftResponse` (`drafting.ts:411`) is in the exact same state (tests-only).
- **Root cause**: `parseRfeResponse` is a legacy convenience wrapper from before the `executeAiOperation` `guard`+`mock` split; the combined entry point became obsolete but was kept (and kept under test).
- **Impact**: A maintainer reading `parseRfeResponse` reasonably assumes it is the canonical "parse a model RFE response" path and may edit it expecting route behaviour to change — but the route bypasses it. Dead surface that tests keep green, masking that it is unused.
- **Fix sketch**: Delete `parseRfeResponse` + its index re-export + the two `parseRfeResponse` tests in `rfe.test.ts` (the underlying `tryParseRfeResponse`/`mockRfe` behaviour stays covered by their own tests). Apply the same to `parseDraftResponse` for symmetry, or, if kept intentionally, add a one-line "// convenience wrapper — route uses guard+mock directly" note so it doesn't read as the live path.

## 4. The 4-field scored-criterion shape is declared three times
- **Severity**: Low
- **Category**: structure
- **File**: `src/features/rfe/components/RfeStudio.tsx:27-32`, `src/features/drafting/criteria-text.ts:23-28`, `src/features/rfe/rfe.ts:48-53`
- **Scenario**: `RfeStudioCriterion { name; status; evidence; rationale }` (RfeStudio), `CriterionLineInput { name; status; evidence; rationale }` (criteria-text), and the inline parameter object of `toRfeCriterion(c: { name; status; evidence; rationale })` are byte-for-byte the same shape. RfeStudio maps `RfeStudioCriterion[]` through `toRfeCriterion`, so all three describe the same value at the same boundary.
- **Root cause**: Each site re-typed the criterion inline instead of importing the already-exported `CriterionLineInput`.
- **Impact**: Low — three definitions to keep in sync if a field is added (e.g. an `exhibit` column); easy to update one and miss another.
- **Fix sketch**: Have `toRfeCriterion` accept `CriterionLineInput`, and `type RfeStudioCriterion = CriterionLineInput` (or import it directly) in `RfeStudio.tsx`.

## 5. `parseCriteria` is a no-op wrapper around the imported `parseCriteriaArray`
- **Severity**: Low
- **Category**: cleanup
- **File**: `src/features/rfe/forecastOperation.ts:47-49`
- **Scenario**: `function parseCriteria(value: unknown): RfeCriterion[] { return parseCriteriaArray(value); }` — a one-line passthrough that adds no logic, used at exactly one call site (`:88`). `parseCriteriaArray` is already imported at `:22`.
- **Root cause**: Leftover local alias; the wrapper's only effect is a narrower return-type annotation that the call site does not need.
- **Impact**: Trivial indirection — a reader has to jump to confirm `parseCriteria` does nothing but forward.
- **Fix sketch**: Delete the wrapper and call `parseCriteriaArray(record.criteria)` directly at `:88`.
