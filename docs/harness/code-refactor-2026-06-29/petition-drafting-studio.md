# Code Refactor — Petition Letter Drafting Studio
> Total: 5
> Critical: 0 | High: 1 | Medium: 3 | Low: 1

## 1. Compliance STRICT-RULES preamble + citation rule are copy-pasted across the draft & RFE prompts (and a 3rd compressed copy)
- **Severity**: High
- **Category**: consolidation
- **File**: `src/features/drafting/drafting.ts:251-263` (buildDraftPrompt rules) + `:170-176` (`CITATION_RULE`) + `:312-322` (buildSectionPrompt) ↔ `src/features/rfe/rfe.ts:239-259` (buildRfePrompt)
- **Scenario**: The two paid endpoints' prompts share the same compliance/citation discipline, hand-maintained in parallel. `marketBarFraming` was already lifted to `criteria-text.ts`, but the STRICT-RULES legal block was not.
- **Root cause**: Rules 2-4 are **byte-identical** between the two builders — rule 2 "This is a DRAFT for attorney review…", rule 3 "Formal, professional tone…", and rule 4 (3 lines) "Do NOT cite case law or court decisions…" (`drafting.ts:255-260` == `rfe.ts:244-248`, confirmed by grep returning both verbatim). The exhibit citation rule is **triplicated with drift**: `drafting.ts:170-176` (`CITATION_RULE` constant), `drafting.ts:320-321` (buildSectionPrompt inline), and `rfe.ts:254-259` — three different wordings of "cite (Exhibit N), never invent one." A fourth compressed prose copy of the whole preamble sits at `buildSectionPrompt` `drafting.ts:312-317`. (Note: `qualification.ts:130` carries a 4th copy of the STRICT-RULES header, out of this context's scope.)
- **Impact**: A safety-critical, anti-hallucination instruction set is maintained in 3-4 places. A hardening edit (e.g. tightening the no-fabrication clause) made in one prompt silently fails to reach the others — exactly the drift the already-drifted citation-rule wordings demonstrate. This is the highest-value consolidation in the feature.
- **Fix sketch**: Add to `criteria-text.ts` (where `marketBarFraming` already lives) shared builders: `legalRules({ rule1, dataMarker })` returning the numbered STRICT-RULES block with feature-specific rule 1 / marker name injected, and `citationRule(kind)` returning the single canonical (Exhibit N) instruction. Have `buildDraftPrompt`, `buildSectionPrompt`, and `buildRfePrompt` all call them. The existing prompt-content tests (`drafting.test.ts:80-96`, `:229-246`) pin the behavior, so the refactor is verifiable.

## 2. Exhibit-gating predicate `c.exhibits && c.exhibits.length > 0` is triplicated
- **Severity**: Medium
- **Category**: duplication
- **File**: `src/features/drafting/drafting.ts:165` (`hasExhibits`) + `:306` (inline in `buildSectionPrompt`) ↔ `src/features/rfe/rfe.ts:118` (`rfeHasExhibits`)
- **Scenario**: Three identical copies of `req.criteria.some((c) => c.exhibits && c.exhibits.length > 0)` decide whether each prompt emits its citation rule.
- **Root cause**: `hasExhibits` and `rfeHasExhibits` are the same one-liner under two names; `buildSectionPrompt` re-inlines the same `.some(...)` test rather than reusing either. The exported names are redundant given `DraftCriterion`/`RfeCriterion` both satisfy the same `{ exhibits? }` shape.
- **Impact**: This predicate **gates the citation discipline** — if one copy drifts (e.g. someone adds an empty-string guard to one), a prompt silently stops emitting the "never invent an exhibit" rule while still listing exhibits, re-opening the hallucinated-citation risk. Low-effort to unify; correctness-adjacent.
- **Fix sketch**: Add `criteriaHaveExhibits(criteria: readonly { exhibits?: readonly unknown[] }[])` to `criteria-text.ts`; replace all three call sites (and `buildSectionPrompt`'s `match.some(...)`) with it.

## 3. `criteriaLines` / `criterionBlock` flat-map is duplicated draft↔rfe, and the `criteria-text.ts` header comment now misstates it
- **Severity**: Medium
- **Category**: duplication
- **File**: `src/features/drafting/drafting.ts:154-160` (`criterionBlock` + `criteriaLines`) ↔ `src/features/rfe/rfe.ts:111-114` (`criteriaLines`); stale comment at `src/features/drafting/criteria-text.ts:7-9`
- **Scenario**: Both features render their criteria with the identical `flatMap([criterionLine(c), ...exhibitBullets(c)])`. The criteria-text header comment claims each feature "legitimately keeps its own `criteriaLines` wrapper."
- **Root cause**: The wrappers are not legitimately different — the bodies are byte-identical; the RFE version only adds a one-line empty-array guard (`rfe.ts:112`). The comment was accurate when the wrappers genuinely diverged, but no longer is — a lying comment that discourages the obvious consolidation.
- **Impact**: The per-criterion bullet rendering (load-bearing for citation discipline, per the criterion-line format) is maintained in two places, and the comment actively tells future maintainers not to merge them.
- **Fix sketch**: Lift `criteriaLines(criteria: readonly CriterionLineInput[], opts?: { emptyFallback?: string }): string[]` into `criteria-text.ts` (alongside `criterionLine`); both features call it. Then correct/remove the now-inaccurate "each feature keeps its own `criteriaLines`" sentence.

## 4. `drafting.ts` is an 857-line module bundling three separable subsystems
- **Severity**: Medium
- **Category**: structure
- **File**: `src/features/drafting/drafting.ts:424-588` (adjudicator critique) and `:682-771` (citation-integrity audit)
- **Scenario**: Beyond core letter drafting (parse / prompt / mock / result envelopes), the file also houses the entire "Adjudicator redline / critique" subsystem (moonshot #19 — `SectionCritique`, `buildCritiquePrompt`, `clampScore`, `mockCritique`, `tryParseCritique`, `buildCritiqueResult`, `scoreTone`, `critiquesByHeading`, ~165 lines) and the citation-integrity audit (`CITATION_TOKEN`, `extractCitedExhibits`, `auditCitations`, …, ~90 lines).
- **Root cause**: Features accreted into the original drafting module over successive moonshots rather than landing in their own files.
- **Impact**: The critique subsystem is fully self-contained (its own prompt, parser, mock, and types) and is consumed by a distinct `/api/draft/critique` route — yet it can't be navigated, tested, or reasoned about independently. The single file is now the largest in the feature and mixes "draft a letter" with "grade a letter."
- **Fix sketch**: Extract `critique.ts` (the redline subsystem) and optionally `citations.ts` (the audit/`buildExhibitIndex` block) as sibling modules; re-export from `index.ts` so no external import path changes. Pure functions + existing tests make this mechanical and low-risk.

## 5. Mock exhibit-citation sentence is duplicated between the draft and RFE fallbacks
- **Severity**: Low
- **Category**: duplication
- **File**: `src/features/drafting/drafting.ts:792-795` (`criterionBody`) ↔ `src/features/rfe/rfe.ts:347-348` (`mockRfe`)
- **Scenario**: Both deterministic fallbacks build the same "This is documented by (Exhibit N), (Exhibit N)." string from a criterion's exhibits.
- **Root cause**: `\`This is documented by ${exhibits.map((ex) => \`(Exhibit ${ex.number})\`).join(", ")}. \`` is copy-pasted into both mock builders (the only difference is draft pre-binds `exhibits = c.exhibits ?? []`).
- **Impact**: Minor — the keyless/template citation trail is rendered by two copies; a change to the exhibit-citation phrasing (or to keep it in lockstep with the live `(Exhibit N)` token the audit parses, `CITATION_TOKEN`) must be made twice.
- **Fix sketch**: Add `citeExhibitsSentence(exhibits: readonly DraftExhibit[]): string` to `criteria-text.ts` (returns "" when empty); call from both mock bodies.
