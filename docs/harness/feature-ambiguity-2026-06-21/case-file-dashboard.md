# Case File Dashboard — Feature Scout + Ambiguity Guardian

> Context #8 · Group: Evidence & Case Management
> Total: 5 findings

## 1. Real case-detail view has no eligibility read-out — only the mock dashboard does
- **Lens**: feature-scout
- **Priority**: High
- **Category**: feature
- **File**: `src/features/case-file/components/CaseDetailView.tsx:140-156`
- **Observation**: The mock `CriteriaTable` (used on the illustrative dashboard) renders the honest eligibility summary — `{summary.total} of N evaluated · need 3 to qualify · {qualifying} strong · {partial} partial` — via `summarizeCriteria` (`CriteriaTable.tsx:34-42`). The qualification flow surfaces the same "needs K of N qualifying" math (`qualification/best-path.ts:77-90`). But the real, user-scoped `CaseDetailView` — the page a paying applicant actually opens at `/dashboard/cases/[id]` — shows only `<Badge tone="neutral">{criteria.length} criteria</Badge>` and a flat row list. It never calls `summarizeCriteria`, so it never tells the applicant *how many of their criteria qualify or whether they clear the threshold for their classification*.
- **Proposal**: In `CaseDetailView`, pass the case `classification` to a pack-threshold lookup (the `pack.threshold` already in `best-path.ts`) and call `summarizeCriteria(criteria, threshold)`; render the same `N of M · need K to qualify · X strong · Y partial` header and threshold badge the mock card uses. Reuse the existing helper — no new logic.
- **Value / Risk-if-ignored**: This is the single most important answer the product owes a logged-in applicant ("am I eligible?"), and it is present on the demo card but absent on the real one. Without it the only honest eligibility signal lives on illustrative data, while real cases get a bare count.
- **Effort**: M

## 2. Detail-view "{classification} criteria" badge hardcodes O-1A threshold logic out of view
- **Lens**: ambiguity-guardian
- **Priority**: High
- **Category**: edge_case
- **File**: `src/features/case-file/components/CaseDetailView.tsx:142-146`
- **Observation**: `QUALIFYING_THRESHOLD = 3` is documented as O-1A-specific, and `summarizeCriteria` explicitly accepts a per-pack `threshold` so the read-out is "never hardcoded to O-1A (ADR-0001)" (`criteria.ts:61-77`). The detail view renders criteria for *any* classification (O-1A / O-1B / EB-1A — `jurisdictionFor(classification)`), but because it shows only a raw `{criteria.length} criteria` badge it silently dodges the threshold question entirely — there is no recorded decision about what "qualifying" means for an EB-1A or O-1B case here. A future dev wiring an eligibility badge in could easily reach for the O-1A `QUALIFYING_THRESHOLD` constant and mis-score a non-O-1A case.
- **Proposal**: Record (ADR or inline comment) the per-classification threshold source for the detail view and route any eligibility count through `summarizeCriteria(criteria, packThreshold)` rather than the bare `QUALIFYING_THRESHOLD` — make the O-1A=3 / pack-specific distinction explicit at the one place a real case is scored.
- **Value / Risk-if-ignored**: A wrong threshold on a real case is a wrong *legal-eligibility* statement to a paying applicant. The ambiguity (which threshold applies on the detail page?) is currently unresolved and invisible.
- **Effort**: S

## 3. 30-second cache TTL is an unexplained magic number guarding stale legal data
- **Lens**: ambiguity-guardian
- **Priority**: Medium
- **Category**: trade-off
- **File**: `src/features/case-file/caseFileData.ts:59`
- **Observation**: `CACHE_TTL_MS = 30_000` is the "safety net if a write path forgets" to call `clearCaseFileDataCache` after mutating a case's facts/tasks/criteria/evidence. The comment explains *why a TTL exists* but not *why 30 seconds* — there is no recorded trade-off between staleness (a user edits evidence, returns, and sees up-to-30s-old criteria/eligibility) and refetch cost. With the live key (`__live__`) fed by instant in-memory fixtures today the value is harmless, but the file is explicitly written for "once the fixtures become real per-case reads," at which point 30s of silently-stale criteria on a legal surface is a real decision no one signed off on.
- **Proposal**: Document the staleness-vs-refetch reasoning behind `30_000` (or derive it from a named constant like `CASE_DATA_STALENESS_BUDGET_MS`), and note the explicit expectation that every mutation path *must* call `clearCaseFileDataCache(caseId)` — the TTL is the backstop, not the contract.
- **Value / Risk-if-ignored**: When fixtures become real reads, an undocumented 30s window can show an applicant or attorney a pre-mutation eligibility/criteria snapshot with no trail explaining why that staleness was deemed acceptable.
- **Effort**: S

## 4. Side panels render fabricated "Draft 3 · 14 min read" and stub buttons that do nothing
- **Lens**: feature-scout
- **Priority**: Medium
- **Category**: functionality
- **File**: `src/features/case-file/components/SidePanels.tsx:55-58,78-85`
- **Observation**: `PetitionDraftCard` hardcodes `Draft 3 · 14 min read` regardless of the actual excerpt, and its "Regenerate §III.A" / "Send to attorney" buttons (and `TasksCard` has no add/complete affordance) have no `onClick` — they are inert. On the mock dashboard this is "illustrative," but the same draft-card pattern and copy sit one route away from the real `CaseDetailView` where `DraftStudio` and `ReviewPanel` are wired and live. The static "Draft 3" / "14 min" metadata is decoupled from any real draft and reads as truthful case state.
- **Proposal**: Either derive the draft label/read-time from the excerpt (or omit it) and wire the two buttons to the existing `DraftStudio` regenerate + `ReviewPanel` "send to attorney" actions, or clearly mark this card as a non-interactive sample (matching the masthead's "Illustrative example" caption). Don't ship dead primary/seal buttons next to live ones.
- **Value / Risk-if-ignored**: Inert primary CTAs and invented draft metadata erode trust on a legal product and create a dead-end where a user expects to regenerate or send a draft.
- **Effort**: M

## 5. `formatWhen` silently emits an empty string for unparseable dates, losing the event timestamp
- **Lens**: ambiguity-guardian
- **Priority**: Medium
- **Category**: edge_case
- **File**: `src/app/dashboard/cases/[id]/page.tsx:23-28`
- **Observation**: `formatWhen` returns `""` when `new Date(value)` is `NaN`, and that empty string is passed as each review event's `when` into `ReviewPanel` (`page.tsx:91-97`). There is no recorded intent for what a blank timestamp should mean on an attorney-review/filing timeline, and a missing/garbage `createdAt` becomes an invisible gap rather than a flagged "date unknown." On a filing/SOL-sensitive audit trail, an event that silently loses its date is exactly the kind of thing an auditor later can't reconstruct.
- **Proposal**: Decide and document the contract: render an explicit placeholder (e.g. "date unknown") instead of `""`, and/or log when `createdAt` fails to parse so a bad-data event is surfaced, not hidden. Make the empty-string case a deliberate, recorded choice.
- **Value / Risk-if-ignored**: A blank date on a legal review/filing event is a silent data-loss on an audit surface — a future dev or auditor can't tell "no date" from "date that failed to parse."
- **Effort**: S
