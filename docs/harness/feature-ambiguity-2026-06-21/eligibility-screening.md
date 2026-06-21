# O-1A Eligibility Screening & Questionnaire — Feature Scout + Ambiguity Guardian

> Context #2 · Group: Eligibility & Qualification
> Total: 5 findings

## 1. A completed screening can't be resumed — anonymous & best-path screenings are never saved, forcing a CV re-paste

- **Lens**: feature-scout
- **Priority**: High
- **Category**: feature
- **File**: `src/app/api/qualify/best-path/route.ts` · `src/features/qualification/components/InstantVerdict.tsx:90` · `src/app/api/qualify/route.ts:86`
- **Observation**: Only the single-classification `/api/qualify` persists a case (route.ts:86-103, `petitions.createCase`). The landing `InstantVerdict` preview (`/api/qualify/preview`) and the lead-with funnel "Find my best path" (`/api/qualify/best-path`) produce a full scored screening but save nothing — the best-path result is thrown away and the user is handed off to `QualifyPanel` to run the screening *again*. `goDeeper()` (InstantVerdict.tsx:90) only stashes raw text into one-shot `sessionStorage`, cleared on read; a refresh or a return visit loses everything.
- **Proposal**: Persist the best-path recommendation (and, for signed-in users, the per-program scores) the same way `/api/qualify` persists a case, and surface a "your last screening" entry on `/qualify` / the dashboard. At minimum, let an authenticated best-path run create the recommended case directly (it already computes the winning `classification`), so "Continue" lands on a saved case instead of a blank re-entry form.
- **Value / Risk-if-ignored**: The screening is the top of the funnel and the moment the applicant is most engaged; making them re-paste a CV between the free read and the real read is the single biggest drop-off risk in the flow. A saved, re-openable screening is also the natural hook for follow-up email and return visits.
- **Effort**: M

## 2. EB-1A's higher "final-merits / green-card" bar is invisible in the single-classification screening — only the best-path LLM prompt mentions it

- **Lens**: ambiguity-guardian
- **Priority**: High
- **Category**: edge_case
- **File**: `src/features/qualification/qualification.ts:272` · `src/features/qualification/components/CriteriaReport.tsx:30` · `src/features/qualification/validation.ts:124`
- **Observation**: The validation record states EB-1A is "judged on a HIGHER 'final merits' totality bar" (best-path.ts:182-184) and the best-path LLM prompt is told to say so. But the per-classification screening treats EB-1A identically to O-1A: `mockLikelihood` (qualification.ts:272) and `CriteriaReport` (line 30) derive "Meets threshold" + a 55–95% likelihood purely from `qualifying >= pack.threshold` (3 of 10), and `qualifyGates` only range-checks the number. An EB-1A applicant who keys 3 of 10 sees the same green "Meets threshold · 78%" verdict an O-1A applicant sees — even though clearing 3 criteria is legally only step one of EB-1A's two-step Kazarian analysis. The reasoning for treating the two identically here is recorded nowhere.
- **Proposal**: Decide and document whether the single-classification read should (a) carry an EB-1A-specific caveat in `CriteriaReport` ("meeting 3 criteria is the first step; EB-1A also requires a final-merits showing"), and/or (b) damp the EB-1A likelihood band. Record the decision next to the threshold in `packs.ts` / the validation note so a future dev doesn't "simplify" it away.
- **Value / Risk-if-ignored**: A falsely confident EB-1A "Meets threshold · 78%" on a green-card path is exactly the kind of over-claim the disclaimer is meant to prevent — it could push someone toward an EB-1A self-petition the record doesn't actually support.
- **Effort**: M

## 3. `mockLikelihood` silently returns a hardcoded 55% for a degenerate `threshold <= 0` pack, contradicting its own documented "0 → 0%" intent

- **Lens**: ambiguity-guardian
- **Priority**: Medium
- **Category**: edge_case
- **File**: `src/features/qualification/qualification.ts:273`
- **Observation**: The doc comment (lines 264-270) promises three bands: 0 qualifying → 0%, below threshold → 0-45%, met → 55-95%. But the guard on line 273 — `if (qualifying <= 0 || threshold <= 0) return … qualifying <= 0 ? 0 : 55` — folds a *second*, undocumented case into that line: a pack with `threshold <= 0` but `qualifying > 0` returns a flat **55%** regardless of how many criteria matched, skipping the entire scaled band. No pack ships `threshold <= 0` today, so this is dead defensively, but the magic `55` and the compound condition give no hint of *why* a thresholdless pack should read "just barely meets." A new program added with `threshold: 0` (or a data bug) would silently produce a meaningless 55% verdict.
- **Proposal**: Split the degenerate `threshold <= 0` case out with an explicit comment stating the intended behavior (e.g. "a pack with no threshold can't compute a meaningful likelihood — return 0 / flag it"), or assert `threshold > 0` at pack-load. Name the `55`/`45` band boundaries as constants shared with the doc comment.
- **Proposal note**: pairs naturally with the validation CI gate, which could also assert every live pack has `threshold >= 1`.
- **Value / Risk-if-ignored**: Low blast radius today, but it's a money/eligibility surface where a future thresholdless pack would emit a fabricated-looking 55% with no trace of intent — the exact "future dev couldn't recover the reasoning" case.
- **Effort**: S

## 4. The screening is profession-blind — `professions.ts` field-tuned evidence exists for SEO pages but never reaches the prompt, report, or gaps

- **Lens**: feature-scout
- **Priority**: Medium
- **Category**: user_benefit
- **File**: `src/features/qualification/professions.ts:26` · `src/features/qualification/qualification.ts:124`
- **Observation**: `professions.ts` already encodes rich, field-specific evidence examples per criterion for 10 professions (chef, athlete, filmmaker, composer, …) and is wired into the programmatic-SEO landing matrix. The actual screening never uses it: `buildQualifyPrompt` (qualification.ts:124) sends only the generic criterion names, the keyless `mockQualification` matches generic keywords, and the `gaps` shown in `CriteriaReport` are the pack's generic one-liners (e.g. "List publications with venues"). A chef or athlete gets gap advice templated for a scientist. The prompt's Rule 5 even warns the model not to under-score non-default fields — but never tells it *which* field the applicant is in.
- **Proposal**: Let the applicant pick (or infer) their profession on `/qualify`, then (a) pass the profession's tuned examples into `buildQualifyPrompt` as concrete per-criterion guidance, and (b) render profession-specific gap copy in `CriteriaReport` via `exampleFor`. The data and helper already exist; this wires them into the live screen.
- **Value / Risk-if-ignored**: Non-science applicants (the arts/athletics half of O-1B/EB-1A) currently get the weakest read and the least actionable gaps — the segment most likely to under-screen and bounce. Reusing existing data makes the screening feel field-aware, a clear differentiator.
- **Effort**: M

## 5. `MIN_PROFILE = 40` is an unexplained magic number duplicated across three layers, and persisted criterion `status` is an unvalidated `string`

- **Lens**: ambiguity-guardian
- **Priority**: Medium
- **Category**: code_quality
- **File**: `src/features/qualification/qualification.ts:76` · `src/features/qualification/components/QualifyPanel.tsx:79` · `src/lib/data/petitions.ts:22`
- **Observation**: The 40-character minimum is hardcoded three times — server `MIN_PROFILE` (qualification.ts:76, with the only error copy), and inline literal `40` in both `QualifyPanel.onSubmit` (line 79) and `InstantVerdict.reveal` — with no recorded rationale for *why* 40 (vs. enough text to screen meaningfully). The three are kept in sync by hand; the client copies ("X more characters") will silently disagree with the server if it ever changes. Separately, the persistence seam types criterion `status` as a bare `string` "validated in app code" (`CriterionInput`, petitions.ts:18-22), but the route writes `assessment.criteria` straight through (route.ts:99) — including `"None"` rows — with no re-validation before the DB write, so the "validated in app code" assumption isn't actually enforced at the boundary.
- **Proposal**: Export `MIN_PROFILE` (and a single helper returning its error copy) and import it in both client forms so there's one source of truth, with a one-line comment on the chosen value. At the data layer, narrow `CriterionInput.status` to the `ScoreStatus` union (or validate on write) so the "validated upstream" claim is type-enforced.
- **Value / Risk-if-ignored**: Low correctness risk today, but the duplicated threshold is a classic drift bug (a server bump leaves the UI lying about readiness), and an untyped persisted `status` lets a malformed value reach the case file that later eligibility math (`summarizeCriteria`) silently ignores — a quiet wrong-count on a legal surface.
- **Effort**: S
