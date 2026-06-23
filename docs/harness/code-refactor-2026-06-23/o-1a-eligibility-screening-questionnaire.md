# Code Refactor — O-1A Eligibility Screening & Questionnaire
> Total: 5 (C0/H2/M2/L1)

## 1. `SAMPLE` CV constant triplicated byte-for-byte across three Qualify components
- **Severity**: High
- **Category**: duplication
- **File**: src/features/qualification/components/QualifyPanel.tsx:35; src/features/qualification/components/InstantVerdict.tsx:26; src/features/qualification/components/BestPathFinder.tsx:18
- **Scenario**: The identical 3-line sample profile string ("Senior research engineer. 6 peer-reviewed papers (412 citations), best-paper award…") is declared as a private `const SAMPLE` in three sibling components. Grep `Senior research engineer|const SAMPLE` over src/ shows three component copies (plus two unrelated test fixtures with different text). All three back a "Use a sample" button that fills the same screening textarea.
- **Root cause**: Each component grew its own "Use a sample" affordance independently; no shared sample lives in the feature module, so the copy was pasted three times.
- **Impact**: The product's canonical demo profile is duplicated three ways. Editing the sample (e.g. to add a criterion it should key, or fix copy) requires finding and updating all three or they silently diverge — and a diverged sample produces inconsistent demo screenings between the landing hero, the best-path finder, and the authenticated panel.
- **Fix sketch**: Hoist one `export const SAMPLE_PROFILE` into the feature (e.g. `src/features/qualification/prefill.ts` or a small `samples.ts`) and import it in all three components. Single source, ~6 deleted lines.

## 2. `statusAccent` re-implements the centralized status ladder instead of deriving from `classifyStatus`
- **Severity**: High
- **Category**: duplication
- **File**: src/features/qualification/components/CriteriaReport.tsx:17-23
- **Scenario**: `CriteriaReport` already imports `statusTone` + `summarizeCriteria` from `@/features/case-file/criteria` (the ADR-0001/0002 single source that maps a status through `classifyStatus`). Yet it also hand-rolls `statusAccent(status)` — a fourth copy of the SAME ladder (`"Met"||"Strong" → success, "Partial" → warning, else → transparent`) to pick a left-border class. Grep `border-l-success|statusAccent` confirms it is local to this file, used twice (desktop table row + mobile card). The badge tone (`statusTone`) and the border accent are now two parallel classifications of the same status.
- **Root cause**: The border-accent needs a different *output vocabulary* (Tailwind `border-l-*` classes, not `BadgeTone`), so the author re-derived the buckets inline rather than routing through the shared `classifyStatus` classifier.
- **Impact**: Exactly the drift ADR-0002 was written to prevent: if the qualifying ruleset changes (e.g. a new status, or "Partial" recategorized), `statusTone` and `statusAccent` must be edited in lockstep or a row's badge and its left border disagree on the same legal/eligibility surface. It's duplicated classification logic that WILL diverge under maintenance.
- **Fix sketch**: Reimplement `statusAccent` on top of the shared classifier — `switch (classifyStatus(status)) { qualifying → "border-l-success"; partial → "border-l-warning"; default → "border-l-transparent" }` (import `classifyStatus` alongside the existing `statusTone`). The accent then provably tracks the badge tone.

## 3. Dead `id` / `useId()` plumbing on the screening form inputs (no `htmlFor` consumer)
- **Severity**: Medium
- **Category**: dead-code
- **File**: src/features/qualification/components/QualifyPanel.tsx:68-70,131,142,177
- **Scenario**: `QualifyPanel` calls `useId()` three times (`nameId`, `classId`, `profileId`) and stamps each onto an input's `id=`. But every input is *wrapped* by its `<label>`, so the label association is implicit. Grep `htmlFor` across `src/features/qualification/components` returns **no matches** — nothing references these ids (no `htmlFor`, no `aria-labelledby`). The same dead pattern repeats in `InstantVerdict.tsx` (68-70-ids) and `BestPathFinder.tsx`, but those are out of this context's strict file set.
- **Root cause**: Inputs were given explicit ids for label association, then the labels were authored as wrappers (implicit association) and the ids were never removed — leftover plumbing.
- **Impact**: Three `useId()` calls and three `id` attributes per component that do nothing — noise that implies an association contract (htmlFor) that doesn't exist, and a small per-render `useId` cost. Misleads the next editor into thinking the ids are load-bearing.
- **Fix sketch**: Drop the three `useId()` calls and the `id={…}` attributes (implicit wrapping already associates label↔control). If explicit ids are preferred for testability, add the matching `htmlFor` instead — but pick one, don't keep unreferenced ids.

## 4. `packFor(req.classification)` recomputed twice in `mockQualification`
- **Severity**: Medium
- **Category**: cleanup
- **File**: src/features/qualification/qualification.ts:243,256
- **Scenario**: Within one function, `mockQualification` calls `packFor(req.classification)` at line 243 (`.criteria.map(...)`) and again at line 256 (`const pack = packFor(req.classification)`) for the same `req.classification`. `packFor` does an `isClassification` membership check + record lookup each time. The first result is discarded after the map.
- **Root cause**: The pack was looked up ad hoc where first needed (the criteria map), then re-fetched into a named `pack` when threshold/criteria were needed lower down — the two reads were never merged.
- **Impact**: Minor: a redundant lookup and a reader has to notice both calls resolve the same pack. Mostly a readability/consistency nit on an otherwise tight pure module.
- **Fix sketch**: Hoist `const pack = packFor(req.classification);` to the top of the function and reuse it for the `.criteria.map`, the `threshold`, and the gap filter. One lookup, clearer.

## 5. `CriterionName` is a bare `type … = string` alias that adds indirection without constraint
- **Severity**: Low
- **Category**: naming
- **File**: src/features/qualification/qualification.ts:29 (used at :40, re-exported via index.ts:8)
- **Scenario**: `export type CriterionName = string;` with the comment "Across packs these vary, so it is a plain string." Its only structural use is `name: CriterionName` on `ScoredCriterion` (line 40). Grep `CriterionName` across src/ shows just the declaration, that one field, and the barrel re-export — no external consumer constrains or branches on it.
- **Root cause**: A semantic alias kept for documentation, but since it resolves to plain `string` it confers no type safety (any string is a `CriterionName`).
- **Impact**: Cosmetic. It reads like a nominal/branded type but isn't, and it's carried through the public barrel, so a consumer might import it expecting meaning it doesn't have. Low — the doc-comment intent is reasonable, so this is a judgment call rather than a clear defect.
- **Fix sketch**: Either keep it (it documents intent) or inline `name: string` on `ScoredCriterion` and drop the alias + its barrel export. If kept, the comment already explains why; no code change strictly required.

---
*Note: `petitions.createCaseWithCriteria` (src/lib/data/petitions.ts:74) initially looked dead (the route uses the adapter's `petitions.createCase`), but it IS live — `adapters/petition.ts:77` wires `data.createCaseWithCriteria` into `PetitionDeps` and calls it at line 157. Verified-before-flagging; NOT reported.*
