# Attorney Review & Filing Workflow — Feature Scout + Ambiguity Guardian

> Context #7 · Group: Evidence & Case Management
> Total: 5 findings

## 1. Sign-and-file files the petition without confirming a draft or exhibits exist
- **Lens**: feature-scout
- **Priority**: High
- **Category**: feature
- **File**: `src/features/review/actions.ts:187`
- **Observation**: `attorneySignAndFile` only checks the attorney role, then transitions `Attorney Review → Filed` and mints a receipt. It never verifies that a petition draft (or any exhibits/criteria) actually exists for the case — `transitionCase` only compare-and-sets on status. The lone "do you have a draft?" signal is a cosmetic UI tip on the *applicant's* submit button (`ReviewPanel.tsx:112` `hasDraft`), which is not even passed to the attorney action. So an attorney of record can sign-and-file an empty case if a draft was never generated, or one whose draft was emptied after submission.
- **Proposal**: In `attorneySignAndFile`, before transitioning, load the latest draft (`getLatestDraft`/`getCriteriaForCase` via the adapter) and fail-closed with a clear message ("Cannot file: no petition draft exists for this case") when absent or empty. Optionally surface a pre-file checklist (draft present, N criteria scored, exhibits attached) in the confirm dialog so the attorney sees exactly what they are signing.
- **Value / Risk-if-ignored**: Filing a blank or stub petition with USCIS under an attorney's bar license is a malpractice-grade outcome. A pre-file integrity gate is exactly the safety a paying attorney-of-record expects and is cheap to add given the adapter already exposes the reads.
- **Effort**: M

## 2. Real e-signature + USCIS receipt capture are stubs — the two highest-value filing features are missing
- **Lens**: feature-scout
- **Priority**: High
- **Category**: feature
- **File**: `src/features/review/actions.ts:44`
- **Observation**: `newReceiptNumber()` fabricates a random `EAC##########` string and `attorneySignAndFile` records "signed" / "filed" events with that fake receipt (`actions.ts:194-216`); the module header explicitly calls DocuSign e-sign and USCIS e-filing "stubs." The case then displays this invented number as the authoritative "USCIS receipt" (`ReviewPanel.tsx:85-91`), indistinguishable from a real one. There is no path to capture a *real* receipt number or a real signature artifact.
- **Proposal**: (a) Add real e-signature: integrate a DocuSign-style envelope (send for signature, store the signed PDF + envelope id as event metadata) instead of a synchronous "signed" event. (b) Replace the minted receipt with operator-entered/real capture: have the attorney paste the actual USCIS receipt number (validated against the `EAC/WAC/LIN/SRC/IOE` + 10-digit format) when filing, or ingest it from a filing integration. Until real filing exists, label the current number "Demo receipt (not filed)" in the UI so it cannot be mistaken for a genuine USCIS receipt.
- **Value / Risk-if-ignored**: E-sign and receipt capture are the core deliverables of an attorney-of-record filing product; without them the workflow cannot actually file a petition, and a fake receipt shown as real is a trust/liability hazard.
- **Effort**: L

## 3. "RFE issued" / "Denied" decisions leave the case stuck in "Filed" with no deadline or next step
- **Lens**: feature-scout
- **Priority**: High
- **Category**: edge_case
- **File**: `src/features/review/actions.ts:237`
- **Observation**: `attorneyRecordDecision` maps only `"Approved"` to a terminal `Approved` status; both `"RFE issued"` and `"Denied"` keep the case in `"Filed"` (`toStatus: decision === "Approved" ? "Approved" : "Filed"`), recording the decision only as a thread note. A denied case therefore looks identical to a still-pending filed case in the queue and case list, and an RFE — which carries a hard USCIS response deadline (commonly ~87 days) — produces no deadline, no reminder, and no "respond to RFE" workflow.
- **Proposal**: Add explicit lifecycle states/affordances for RFE and Denied: an `RFE` status that captures a response-due date (stored in event metadata + on the case) with a queue badge/countdown, an attorney/applicant "draft RFE response" path (the app already has `saveRfeResponse`/`getLatestRfeResponse`), and a `Denied` terminal state distinct from `Filed`. At minimum, stop conflating denied/pending under one status.
- **Value / Risk-if-ignored**: A missed RFE deadline = automatic denial of the petition. Silently parking RFE and Denied under "Filed" is a real legal-outcome risk and a glaring gap for any applicant who gets an RFE.
- **Effort**: M

## 4. Queue "age" uses `updated_at` as the submit time, but any note/transition bumps it — the SLA clock silently resets
- **Lens**: ambiguity-guardian
- **Priority**: High
- **Category**: trade-off
- **File**: `src/app/dashboard/review/page.tsx:38`
- **Observation**: The review queue maps `submittedAt: c.updatedAt` (`page.tsx:38`) and the age badge treats that as "time in queue" (`queue-age.ts:26-38`, fresh/warning/overdue thresholds 12h/24h). But `updated_at` is bumped by `transitionCase` on *every* status change (`pglite-store.ts:525`, `firestore-store.ts:391`). There is no dedicated `submitted_at`/`entered_review_at` column, and the intended meaning of the queue clock is undocumented. (Note: plain `addReviewEvent` does NOT bump `updated_at` — `pglite-store.ts:631` — so notes don't reset it, but any transition does, and nothing records *why* `updatedAt` was chosen as the SLA anchor.)
- **Proposal**: Decide and document the queue-age contract explicitly: either (a) record a distinct `entered_review_at` timestamp when a case transitions into `Attorney Review` and drive the badge off that, or (b) write a comment at `page.tsx:38` stating that age is measured from last-modified-in-review and that a re-submit after changes-requested intentionally restarts the SLA clock. Pick one and make the field name match the meaning.
- **Value / Risk-if-ignored**: An "overdue" SLA badge that quietly resets to "fresh" whenever the case is touched gives attorneys/case-managers a false picture of how long an applicant has waited — a wrong operational signal on a time-sensitive legal queue, with no recorded rationale for a future dev to trust the number.
- **Effort**: S

## 5. No-op transition returns the same "verify" message whether nothing happened or a real precondition failure occurred
- **Lens**: ambiguity-guardian
- **Priority**: Medium
- **Category**: edge_case
- **File**: `src/features/review/actions.ts:70`
- **Observation**: `applyTransition` collapses three distinct outcomes of a `false` from `transitionCase` into one generic message: (1) the case legitimately already moved (benign double-submit), (2) there is **no store configured** so nothing was written (`reviews.ts:79` returns `false`), and (3) the case is in the wrong `fromStatus` (e.g. trying to record a decision on an unfiled case). The comment at `actions.ts:66-69` acknowledges "we can't distinguish benign from failed" — but a no-store environment will *always* fail every sign/file/decision while telling the user to "Refresh to check," which they cannot resolve.
- **Proposal**: Have `transitionCase` (or a thin wrapper) distinguish at least "no store" from "precondition not met" — e.g. return a small result union (`applied | precondition_failed | no_store`) so `applyTransition` can render an actionable message: a real "this case already moved / isn't in the right state" for precondition failures vs. an operator-facing "filing is not available in this environment" for no-store. Document which branch is expected in demo vs. prod.
- **Value / Risk-if-ignored**: An attorney repeatedly clicking "sign & file" and getting "refresh to check" with no underlying state change wastes time and erodes trust on the most consequential action; a future maintainer also can't tell from the message whether the system or the data was at fault.
- **Effort**: S
