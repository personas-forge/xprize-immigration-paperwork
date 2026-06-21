> Total: 5 | Critical: 0 | High: 1 | Medium: 3 | Low: 1
> Context: Attorney Review & Filing Workflow
> Lens mix: bug-hunter 3, ui-perfectionist 2

The core security + integrity invariants hold: every privileged action gates on `isConfiguredAttorney` (fail-closed) via the shared `requireAttorney`, cross-tenant case access on the detail page and queue routes through the single `resolveCase` gate with the strict configured-attorney leg (never `isAttorney`), and `transitionCase` is a genuine compare-and-set + same-transaction event append on BOTH drivers (pglite `update ... where status in (...)` + Firestore `runTransaction` status precheck). Double-click "Sign & file" cannot mint a second receipt. The five findings below are the residual gaps: silent action failures, missing in-flight UI feedback, a focus-ring a11y hole on the most consequential button, an unvalidated attorney-note write, and a missing route loading skeleton.

## 1. Status-changing server actions fail silently — applicant/attorney sees no error on a swallowed filing action
- **Severity**: High
- **Lens**: bug-hunter
- **Category**: silent failure / error surfacing
- **File**: src/features/review/actions.ts:58-63, 66-88, 119-140, 144-171, 174-200
- **Scenario**: An attorney clicks "Confirm — sign & file" (or an applicant "Submit for review"). The store is momentarily unavailable, or the case status already moved out of `fromStatuses` in another tab, or `getUser()` returns null mid-session. `transitionCase` returns `false`; `applyTransition` then skips `revalidateCase`, so NOTHING re-renders and NO error is shown. The user is left staring at an unchanged page with no idea whether the petition was filed, will be filed, or silently dropped.
- **Root cause**: Every action returns `void` and bails with a bare `return` on the unauthenticated / empty-body / no-store / failed-compare-and-set paths. `applyTransition` deliberately suppresses revalidation on a no-op (correct for a true double-submit) but cannot distinguish "already filed, fine" from "store fault, nothing happened" — and neither propagates to the client. `reviews.ts` documents that a phantom "filed" is worse than a visible error, yet the UI has no channel to show that visible error.
- **Impact**: In a legal filing workflow, a silently-dropped sign-and-file (store hiccup) looks identical to success. The attorney believes the petition is with USCIS when it is not — a missed deadline / malpractice exposure. No telemetry either, so it's invisible in ops.
- **Fix sketch**: Have the actions return a discriminated result (`{ ok } | { ok:false, reason }`) and drive a `useActionState`/`useFormState` form so the panel renders "Filed ✓ / Not applied — refresh / Service unavailable, try again". At minimum distinguish a store-fault (`transitionCase` could not reach the store) from a legitimate no-op compare-and-set and surface the former.

## 2. No submit-pending / disabled state on any review action button (double-click, no in-flight feedback)
- **Severity**: Medium
- **Lens**: ui-perfectionist
- **Category**: missing state / double-submit UX
- **File**: src/features/review/components/ReviewPanel.tsx:106, 139, 162, 212, 261-264
- **Scenario**: Attorney clicks "Confirm — sign & file"; the server round-trip takes a second. The button stays fully enabled with no spinner, so the attorney clicks again (and again). DB idempotency means no second receipt is minted — but the UI gives zero acknowledgment that anything is happening, which on a ceremonial "file with USCIS" action reads as "did my click register?"
- **Root cause**: Every `<form action={...}>` submit `<Button type="submit">` is a plain button with no pending awareness. `useFormStatus` is used nowhere in the codebase, and `Button` (src/components/ui/Button.tsx) has no `disabled`/busy variant.
- **Impact**: Redundant no-op server round-trips, and a confidence gap on the single most consequential action in the product. Low data-integrity risk (DB is idempotent) but a real polish/trust gap for an attorney-of-record gesture.
- **Fix sketch**: Add a `<SubmitButton>` wrapper that reads `useFormStatus().pending` to set `disabled` + `aria-busy` + a spinner/label swap ("Filing…"). Add a `disabled:` style to `Button`. Apply to submit-for-review, return-with-changes, confirm sign-and-file, record-decision, add-note.

## 3. "Sign & file" and other primary/seal buttons have no visible keyboard focus ring
- **Severity**: Medium
- **Lens**: ui-perfectionist
- **Category**: a11y / focus visibility
- **File**: src/components/ui/Button.tsx:10-23 (variant `seal`/`primary`/`secondary`); used at ReviewPanel.tsx:233-234, 262, 139, 162
- **Scenario**: A keyboard or screen-reader user tabs through the attorney console. Focus lands on "Sign & file with USCIS" (`variant="seal"`) and the confirm button — but only the `ghost` variant defines `focus-visible:ring-*`. The `seal`, `primary`, and `secondary` variants have `focus-visible:outline-none` (in the base) with NO replacement ring, so there is no visible focus indicator at all.
- **Root cause**: The base class sets `focus-visible:outline-none` for every variant, but only `ghost`'s variant string re-adds a `focus-visible:ring`. `seal`/`primary`/`secondary` never do — so the outline is removed and nothing replaces it (WCAG 2.4.7 Focus Visible failure) on the workflow's most important control.
- **Impact**: Keyboard-only and low-vision attorneys cannot tell which control is focused before committing a legal filing. Direct accessibility failure on a high-stakes action.
- **Fix sketch**: Move the `focus-visible:ring-2 focus-visible:ring-accent-dark focus-visible:ring-offset-2 focus-visible:ring-offset-background` rule into the shared base class (it already clears contrast per the `ghost` comment) so every variant inherits a visible ring, rather than per-variant.

## 4. addReviewNote's attorney branch writes a note without resolving/validating the case
- **Severity**: Medium
- **Lens**: bug-hunter
- **Category**: input validation / write to unverified resource
- **File**: src/features/review/actions.ts:91-116
- **Scenario**: A configured attorney POSTs `addReviewNote(caseId, body)` with a `caseId` that does not exist (or is malformed). The `owned` resolve fails, `attorney` is `true`, so the `!owned && !attorney` guard passes, and `addReviewEvent` is called for a non-existent case. `addReviewEvent` does not check case existence, so it appends an orphan `case_reviews` row (or no-ops, depending on FK), then `revalidateCase` runs.
- **Root cause**: Unlike the status actions (which compare-and-set against the case row inside `transitionCase`) and unlike the detail page's read (which routes through `resolveCase` with the email leg), the attorney note branch authorizes on the *global* `isConfiguredAttorney(user.email)` flag alone and never resolves the specific case. The owner branch is correctly gated; the attorney branch is not.
- **Impact**: A configured attorney (trusted, but still) can write thread events against arbitrary/garbage case IDs, producing orphan audit rows that desync from real cases. Not cross-tenant escalation (configured attorneys are cross-tenant by design), but an integrity/audit-log-pollution gap on the append-only legal record.
- **Fix sketch**: For the attorney branch, resolve the case first: `const gate = await petitions.resolveCase({ userId: user.id, email: user.email ?? null }, caseId); if (!gate.ok) return;` — then append. This reuses the single gate and rejects non-existent cases, matching the detail page's posture.

## 5. Review queue route has no loading skeleton — blank screen during force-dynamic fetch
- **Severity**: Low
- **Lens**: ui-perfectionist
- **Category**: missing loading state
- **File**: src/app/dashboard/review/page.tsx:14-25 (no sibling loading.tsx)
- **Scenario**: An attorney navigates to `/dashboard/review`. The page is `force-dynamic` and awaits `getBalance` + `getCasesInReview` server-side. Until those resolve there is no `loading.tsx`, so the user sees the previous page / a blank frame with no queue chrome — no skeleton rows, no "loading queue" affordance. The empty-state (`cases.length === 0`) and thread empty-state are well handled, but the *fetch-in-flight* state is not.
- **Root cause**: No `loading.tsx` exists anywhere under `src/app` (verified), and the queue's `Skeleton` component (exported from `@/components/ui`) is unused on this route.
- **Impact**: Minor perceived-performance / polish gap on a DB-backed dynamic route; the queue can take a moment under Firestore. No correctness impact.
- **Fix sketch**: Add `src/app/dashboard/review/loading.tsx` rendering the `DashboardTopBar` + a few `Skeleton` queue rows, so the board structure appears instantly while data streams in. Same for `cases/[id]/loading.tsx`.
