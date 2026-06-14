# Code Refactor Scan — Attorney Review & Filing Workflow

> Total: 4 (C0 / H1 / M2 / L1)

## 1. Dead exported wrapper `setCaseStatus` in the review data layer
- **Severity**: high
- **Category**: dead-code
- **File**: src/lib/data/reviews.ts:57-69
- **Scenario**: `reviews.ts` exports an async `setCaseStatus(caseId, status, opts)` wrapper that calls `store.setCaseStatus(...)`. The five review server actions advance status exclusively through `transitionCase` (the atomic compare-and-set), never through this wrapper.
- **Root cause**: When the workflow moved to the atomic `transitionCase` (status guard + same-transaction event append, per the module doc on lines 71-78), the older non-atomic `setCaseStatus` data-layer wrapper was left behind. It is not re-exported through the `@/lib/data` barrel (`src/lib/data/index.ts` only re-exports `cases`/`forms`/`documents`).
- **Impact**: ~13 lines of dead, exported public surface in a sensitive legal-workflow module. Worse than inert: it is the *non-atomic* status setter, so any future caller who reaches for it would bypass the compare-and-set that the whole module was rebuilt to guarantee (the doc comment itself warns "a phantom 'filed' in a legal workflow is worse than a visible error"). It is an attractive-nuisance footgun.
- **Verification**: `grep -rn "setCaseStatus"` across the WHOLE repo: every hit other than this file is the Store *method* on the interface/implementations (`store.ts:211`, `firestore-store.ts:314`, `pglite-store.ts:460`) or the `store-events.ts:47` proxy that wraps `target.setCaseStatus` — none import the `reviews.ts` wrapper. `grep "import.*setCaseStatus"` returns zero matches. The barrel (`index.ts`) does not export it. The actions import only `{ addReviewEvent, transitionCase }` from `@/lib/data/reviews` (actions.ts:26). `getReviewEvents` (same file) IS live (cases/[id]/page.tsx:54), so this is a targeted removal, not a whole-module deletion.
- **Fix sketch**: Delete the `setCaseStatus` export (lines 57-69) and drop the "`setCaseStatus` advances the case lifecycle" clause from the module doc (line 7). The underlying `store.setCaseStatus` method stays — it is still used internally by `transitionCase`'s implementations and the events proxy. No behavior change; no gate touched.

## 2. Repeated server-action boilerplate (auth + transition + revalidate) in actions.ts
- **Severity**: medium
- **Category**: duplication
- **File**: src/features/review/actions.ts:40-180
- **Scenario**: All five actions repeat the same scaffolding: (a) `const user = await getUser(); if (!user) return;` (5×); (b) the privileged-action gate `if (!user || !isConfiguredAttorney(user.email)) return;` (3× — attorneyRequestChanges, attorneySignAndFile, attorneyRecordDecision); (c) the tail `const applied = await transitionCase({...}); if (applied) revalidateCase(caseId);` (4×).
- **Root cause**: Each action was written end-to-end without extracting the common authenticate -> gate -> transition -> revalidate spine.
- **Impact**: The auth/attorney gate is the security-critical line and it is copy-pasted three times; a future change (e.g., adding rate-limiting or audit on the gate) must be made in three places, and a single missed edit silently weakens one action. Moderate maintenance/consistency risk rather than a present bug.
- **Verification**: Read all five action bodies (lines 40-180). Confirmed the four applicant/transition tails are byte-identical in shape and the three attorney guards are identical. The owner-only gate (`resolveCase({ userId, email: null })`) in submitForReview/addReviewNote is the subtle one and is pinned by owner-only-gate.test.ts.
- **Fix sketch**: Extract two small helpers in this file: `requireAttorney()` returning the user or null (collapses the 3× attorney guard) and `applyTransition(caseId, input)` that calls `transitionCase` then `if (applied) revalidateCase(caseId)` (collapses the 4× tail). Do NOT collapse the owner-only `resolveCase({ email: null })` calls into the attorney helper — the `email: null` argument is the exact thing the contract test guards (owner-only vs cross-tenant fallback); keep those two call sites explicit. Pure structural extraction, gate semantics unchanged.

## 3. Duplicated form-field sanitize idiom (`String(get).trim().slice(0,4000)`)
- **Severity**: medium
- **Category**: duplication
- **File**: src/features/review/actions.ts:72, 100-102
- **Scenario**: `addReviewNote` and `attorneyRequestChanges` both read a free-text field with the same idiom `String(formData.get("...") ?? "").trim().slice(0, 4000)`. The 4000-char cap and trim are the input-safety contract for what gets written into the append-only review log.
- **Root cause**: The bounded-text read was inlined at each call site.
- **Impact**: Low-moderate. The 4000 cap is duplicated, so the two free-text fields could drift out of sync (one capped, one not) on a future edit — a subtle correctness/storage concern for an append-only audit log. Not currently buggy.
- **Verification**: Read both call sites; the only difference is the field name (`body` vs `feedback`) and the `||` default fallback in attorneyRequestChanges (line 102).
- **Fix sketch**: Add `function boundedField(fd: FormData, name: string, max = 4000): string { return String(fd.get(name) ?? "").trim().slice(0, max); }` and call it at both sites; keep the empty-string fallback for feedback at the call site. Single source for the audit-log length cap.

## 4. Local `formatWhen` could move beside its sibling event-view mapping
- **Severity**: low
- **Category**: structure
- **File**: src/app/dashboard/cases/[id]/page.tsx:24-29
- **Scenario**: `formatWhen` (a date->short-label formatter) is defined inline in the case-detail page solely to map `getReviewEvents` results into `ReviewEventView.when` before handing them to `ReviewPanel`. The review queue page (`dashboard/review/page.tsx`) does its own row mapping too, but only the detail page needs `when`.
- **Root cause**: Small presentational mapper colocated with the page rather than the review feature.
- **Impact**: Cosmetic. The detail page is technically just outside this scan's file list, and the formatter is genuinely page-local today, so this is a low-priority tidy, not a real debt item. Flagged only for completeness.
- **Verification**: `grep "formatWhen"` shows a single definition and use, both in cases/[id]/page.tsx — no duplication exists yet. The `ReviewEventView` type lives in ReviewPanel.tsx (the in-scope component).
- **Fix sketch**: Optional — if a second consumer ever needs the same short-date label for review events, lift `formatWhen` next to `ReviewEventView` in the review feature. Until then, leave it; no action recommended.
