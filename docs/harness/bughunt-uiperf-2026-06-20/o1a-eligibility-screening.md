> Total: 5 | Critical: 1 | High: 2 | Medium: 1 | Low: 1
> Context: O-1A Eligibility Screening & Questionnaire
> Lens mix: bug-hunter 3, ui-perfectionist 2

## 1. Verdict threshold is read from live form state, not the screened classification
- **Severity**: Critical
- **Lens**: bug-hunter
- **Category**: criteria-aggregation correctness / state desync
- **File**: src/features/qualification/components/QualifyPanel.tsx:270 (and InstantVerdict.tsx:198)
- **Scenario**: User submits a screening for classification **A**, then changes the "Visa type" `<select>` to classification **B** WITHOUT re-submitting. The panel still shows the prior `result` (criteria scored for A), but `CriteriaReport` is now rendered with `threshold={packFor(classification).threshold}` where `classification` is the *current* dropdown state (B). The "Meets / Below threshold" badge and the "need N to qualify" line are computed against the wrong program's rule, on a legal-eligibility surface.
- **Root cause**: The screened classification is part of the request but is NOT echoed back into `result` / not pinned alongside it. The component derives the threshold from mutable form state (`classification`) instead of from the value the result was actually computed for. `summarizeCriteria(result.criteria, threshold)` is correct math fed a stale/mismatched `threshold`.
- **Impact**: A user can be shown "Meets threshold" / "Below threshold" and "need 2 to qualify" that does not match the criteria actually scored. Today this is *masked* because all three LIVE packs (O-1A/O-1B/EB-1A) share threshold 3 — but UK-Global-Talent (threshold 2) and the differing `criteria.length` (8 vs 10) mean a wrong "X of N" denominator and a wrong "need N" the moment a second-threshold or different-size pack goes live, or if the result's criteria length (8) is shown under a 10-criterion pack's "need 3". A wrong qualifies/doesn't read is the worst-case bug here.
- **Fix sketch**: Pin the classification to the result: have `/api/qualify` (and preview) return `classification` in the payload, and render `CriteriaReport threshold={packFor(result.classification).threshold}` / disable or clear `result` when the dropdown changes. Freeze the form's classification into `result` on submit so the read-out can never drift from the screened pack.

## 2. Mock likelihood % is decoupled from the qualify/doesn't verdict
- **Severity**: High
- **Lens**: bug-hunter
- **Category**: scoring math / misleading legal signal
- **File**: src/features/qualification/qualification.ts:247-249
- **Scenario**: A profile keying **2** criteria (below the 3 threshold) yields `likelihood = 38 + 2*8 = 54%`, rendered as a large "54%" headline immediately beside a "Below threshold" warning badge. A profile keying **0** criteria still shows a 38% floor. Conversely the cap of 95 means a profile keying all 8 reads 95% (`38 + 8*8 = 102 → 95`).
- **Root cause**: `likelihood` is a hardcoded affine heuristic (`base 38, +8/criterion`) computed independently of `summarizeCriteria.meetsThreshold`. There is no relationship between the headline percentage and the actual qualifying verdict — the two can tell opposite stories (a comfortable-looking 54% that does NOT qualify; a 38% floor with zero evidence).
- **Impact**: The percentage is the single most prominent number in `CriteriaReport` (2.6rem display). A self-petitioner reads "54%" as a meaningful approval chance while the real, legally-relevant signal (3-of-8 criteria) says they do not yet qualify. On an immigration self-screening this is a materially misleading read, and the 38% non-zero floor for an empty/irrelevant profile implies a baseline chance that does not exist.
- **Fix sketch**: Either derive likelihood from the verdict (e.g. clamp to a low band when `qualifying < threshold`, and start the floor at/near 0 for zero qualifying), or demote the % to a clearly secondary "informational estimate" and let the criteria count be the headline. At minimum, never let likelihood ≥ 50% coexist with "Below threshold". Document the heuristic's bounds in a test.

## 3. Verdict change is not announced to screen readers (only an aria-label meter)
- **Severity**: High
- **Lens**: ui-perfectionist
- **Category**: a11y — verdict not announced
- **File**: src/features/qualification/components/CriteriaReport.tsx:45-105
- **Scenario**: A keyboard / screen-reader user submits the form, the report swaps in. The "Meets threshold / Below threshold" badge, the "X of N criteria supported — need N to qualify" line, and the likelihood headline appear with NO live region. The only announced element is the meter (`role="meter" aria-label="Estimated approval likelihood"`), which reads the % but never the pass/fail verdict. Focus stays on the submit button; nothing tells a non-sighted user the outcome.
- **Root cause**: The result block in `QualifyPanel` (`status === "done"`) and the summary card in `CriteriaReport` are plain `<div>`s with no `role="status"` / `aria-live="polite"`. The error and paywall states correctly use `role="alert"`, but the *success verdict* — the whole point of the screen — is silent.
- **Impact**: The primary outcome of an eligibility screening is inaccessible to assistive-tech users; they receive a likelihood number with no qualifies/doesn't context, the worst part to drop on a legal surface. A11y blocker on the core flow.
- **Fix sketch**: Wrap the summary header (verdict line + threshold badge) in a container with `role="status" aria-live="polite"`, or move focus to a heading announcing the verdict on transition to "done". Ensure the badge text ("Meets threshold") is part of the announced region, not just the meter.

## 4. Empty / all-"None" screening shows a confusing "0 of 8 supported — 38%" with no guidance framing
- **Severity**: Medium
- **Lens**: ui-perfectionist
- **Category**: empty/edge-state UX
- **File**: src/features/qualification/components/CriteriaReport.tsx:51-105
- **Scenario**: A sparse profile (e.g. the test's "long walks on the beach") parses to all-"None" criteria. The report renders "0 of 8 criteria supported — need 3 to qualify", a 38% likelihood, "Below threshold", eight grey rows each showing "—", and a "Gaps to strengthen (8)" card. There is no empathetic empty-state framing — it reads as a flat rejection with a misleading 38%.
- **Root cause**: There is no distinct visual treatment for the zero-qualifying case; the report is a single layout for every outcome. The "—" placeholder rows and the non-zero % give a harsh, slightly contradictory impression rather than a "here's where to start" framing.
- **Impact**: The most discouraging possible first experience for exactly the users who most need guidance; combined with finding #2 the numbers also look internally inconsistent (0/8 yet 38%).
- **Fix sketch**: Add a zero-qualifying branch: lead with the gaps ("Here's what to gather first") instead of a 0/8 verdict, soften the rows, and suppress or reframe the likelihood headline when nothing is supported.

## 5. Likelihood meter uses `role="meter"` where `role="progressbar"`/text would be clearer; no visible value on the bar
- **Severity**: Low
- **Lens**: ui-perfectionist
- **Category**: a11y / visual polish
- **File**: src/features/qualification/components/CriteriaReport.tsx:90-103
- **Scenario**: The likelihood bar carries `role="meter"` with min/now/max but the numeric value lives in a separate sibling block above it; the bar itself has only the aria-label "Estimated approval likelihood" with no in-context association to the headline number, and `meter` semantics are unevenly supported across AT.
- **Root cause**: The visual % and the semantic meter are two disconnected nodes; the bar conveys magnitude visually but its accessible name doesn't include the value, and `meter` (a gauge) is a weaker fit than a labelled value for a single estimate.
- **Impact**: Minor — the value is reachable via the meter's `aria-valuenow`, but the association is loose and the redundant decorative bar adds little for AT users. Polish only.
- **Fix sketch**: Associate the headline number with the bar via `aria-describedby`, or fold the value into the meter's accessible name (`aria-label={\`Estimated approval likelihood ${likelihood}%\`}`). Consider whether the bar needs a role at all given the value is already shown.
