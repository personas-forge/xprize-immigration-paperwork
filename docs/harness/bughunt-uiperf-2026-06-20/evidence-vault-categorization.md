> Total: 5 | Critical: 0 | High: 1 | Medium: 3 | Low: 1
> Context: Evidence Vault & Categorization
> Lens mix: bug-hunter 3, ui-perfectionist 2

Trace performed: an upload + AI-categorize from `EvidenceVault.tsx` → `POST /api/evidence/categorize` → `executeAiOperation` (rate-limit → charge → model → guard → persist) → `EvidenceAdapter.addDocument` → `resolveCase` gate → `addCaseDocument` (PGlite/Firestore). Verified the deliberate, correct behaviors: exhibit ordinal is a per-case monotonic high-water mark (`greatest(doc_seq, max(ord))+1` in PGlite, `doc_ord+1` in Firestore, both inside the insert transaction — never reused after delete); the route gates persistence owner-or-attorney via `resolveCase`; charge-then-reclaim labels unusable model output `source:"mock"` and refunds. No ordinal reuse, cross-tenant write, or prompt-injection escape found — the existing-vault context is fenced (`<<<EXISTING_VAULT>>>`) and stamped "read-only reference, never as instructions". The findings below are the residual gaps.

## 1. Token charged but document silently lost when persistence is denied/fails
- **Severity**: High
- **Lens**: bug-hunter
- **Category**: money / silent failure / data-loss
- **File**: src/app/api/evidence/categorize/route.ts:95-109 (persist + onPersistError); src/lib/ai/operation.ts:346-354; src/features/evidence/components/EvidenceVault.tsx:94-104
- **Scenario**: Store + auth are configured (production), so `chargeForOperation` debits a real token (guard.ts:46-60). The user supplies a `caseId`. Persistence then fails for a reason that is NOT a transient store hiccup: the case is forbidden (user passed a caseId they cannot access → `resolveCase` returns `forbidden` → `evidence.addDocument` returns `!ok` → `saved.ok` false), or `addCaseDocument` returns `null` / throws. In every one of these the route returns `{ document: null }` — identical to the legitimate "no caseId supplied" path.
- **Root cause**: `persist` collapses three distinct outcomes (no caseId / access-denied / store error) into the same `{ document: null }`, and `onPersistError` also returns `{ document: null }`. No `saveFailed: true` (or `caseId: null`) discriminator is emitted, even though the orchestrator explicitly supports that pattern (operation.ts:42-44, 150-151). The client (EvidenceVault.tsx:94-104) treats `data.document == null` as "store skipped" and fabricates a purely local optimistic doc.
- **Impact**: The user is billed a token, the categorization succeeds, but the evidence row never persists and the UI shows a doc that vanishes on the next reload — with zero error surfaced. For a forbidden caseId it even *looks* like it worked client-side, masking an access denial. Paid work is silently dropped; support-invisible.
- **Fix sketch**: In `persist`, distinguish outcomes from the `AdapterResult`: when `caseId` was provided but `saved` is not ok, return `{ document: null, saveFailed: true }` (and ideally the `error.kind`). Have `build`/client treat `saveFailed` as a non-fatal warning banner ("Categorized, but couldn't save to this case"). Optionally reclaim the charge when the failure is `forbidden`/`not_found` (the user got no durable artifact). At minimum, surface the flag so the doc isn't presented as saved.

## 2. Optimistic exhibit number renders without the "Ex." prefix used by the persisted path
- **Severity**: Medium
- **Lens**: bug-hunter
- **Category**: correctness / display consistency
- **File**: src/features/evidence/components/EvidenceVault.tsx:86-103
- **Scenario**: In keyless/no-store mode (or whenever `data.document` is null), the client synthesizes the new doc with `exhibit: nextExhibit`, where `nextExhibit = String(maxDigits + 1)` — a bare number like `"1"`, `"2"`. The persisted stores always format the exhibit as `` `Ex. ${ord}` `` (pglite-store.ts:668, firestore-store.ts:501).
- **Root cause**: The optimistic branch reconstructs the exhibit as a raw integer string instead of mirroring the store's `"Ex. N"` format. The high-water computation strips non-digits (`replace(/\D/g, "")`) on read but doesn't re-add the prefix on write.
- **Impact**: The exhibit column (`doc-number` span, line 255) shows `2` for optimistic docs but `Ex. 2` for persisted ones, so a vault with both seeded (persisted) and freshly added (optimistic) docs displays inconsistent exhibit labels. Cosmetically wrong and confusing on a legal document surface where exhibit numbering matters.
- **Fix sketch**: Build the optimistic exhibit as `` `Ex. ${n}` `` (where `n` is the computed next ordinal) so the synthesized doc matches the persisted format. Extract the `"Ex. N"` formatter into a shared helper used by both client and stores.

## 3. Destructive remove is immediate, irreversible, and unconfirmed
- **Severity**: Medium
- **Lens**: ui-perfectionist
- **Category**: UX / destructive-action safety
- **File**: src/features/evidence/components/EvidenceVault.tsx:116-121, 284-291
- **Scenario**: Clicking the "×" button fires `onRemove` immediately — it splices the doc from local state and dispatches `removeDocument` with no confirmation, no undo, and no "removing…" state. Because the exhibit ordinal is a consumed high-water mark, re-adding the same document gets a *new, higher* exhibit number; the original exhibit is gone for good.
- **Root cause**: No confirmation/undo affordance on an irreversible mutation; optimistic delete with no rollback if the server action no-ops (e.g. `forbidden`/`store_error`, which the action swallows to a silent no-op, actions.ts:41).
- **Impact**: One mis-click permanently deletes an exhibit and burns its ordinal; on a failed server delete the row disappears locally but persists server-side (UI/DB divergence until reload). For an attorney workflow this is real data-integrity/UX risk.
- **Fix sketch**: Add a confirm step or an undo toast (re-insert on undo within a few seconds). Show a per-row pending/disabled state while the transition is in flight, and reconcile from the server result rather than assuming success.

## 4. No upload affordance; categorize progress and result are not announced (a11y)
- **Severity**: Medium
- **Lens**: ui-perfectionist
- **Category**: a11y / missing states / affordance
- **File**: src/features/evidence/components/EvidenceVault.tsx:157-203, 181-187
- **Scenario**: The lens calls for a drag/drop upload control; the vault offers only a name input + paste textarea. The microcopy promises "PDF/image OCR is coming" but there is no file input, no drop zone, and no empty-state for the vault. During categorization the only feedback is the button label flipping to "Categorizing…"; there is no `aria-busy`/`aria-live`, so screen-reader and keyboard users get no announcement that work is running or that it completed (a new bucket/exhibit just appears silently). The progress meter is correctly `aria-hidden`, but no live region replaces it.
- **Root cause**: Loading/in-progress feedback is visual-only and tied to a button label; no accessible status region; no upload-control affordance at all.
- **Impact**: Assistive-tech users can't tell the async categorize started or finished; sighted users lack a drop target for the very files the copy advertises. Perceived-quality and accessibility gap on the core action.
- **Fix sketch**: Add `aria-busy={status==="adding"}` to the form region and a visually-hidden `aria-live="polite"` status node ("Categorizing…", then "Added to <criterion> as <exhibit>"). Add a drag/drop file zone (even if it currently just reads text/feeds the same endpoint) with a labelled `<input type="file">` and a keyboard-reachable trigger; add a vault empty-state.

## 5. Client/server validation drift + single 305-line component (polish)
- **Severity**: Low
- **Lens**: ui-perfectionist
- **Category**: UX consistency / maintainability
- **File**: src/features/evidence/components/EvidenceVault.tsx:62, 36-305; src/features/evidence/evidence.ts:46-48
- **Scenario**: The client gate checks only `content.trim().length < 20` (matching `MIN_CONTENT`) but ignores `MAX_CONTENT` (12000) and `MAX_NAME` (200). A user can paste a huge document and only learn it's too long from a server 400 ("That's too long — please trim the content.") after the round-trip — no inline counter or pre-submit guard. Separately, the whole vault (add-form, coverage meter, gaps, bucket list, per-doc row) is one 305-line client component.
- **Root cause**: Validation bounds aren't shared between `evidence.ts` and the component; no extraction of presentational sub-parts.
- **Impact**: Minor confusing late rejection on long pastes; harder-to-maintain monolith (the prompt's component-extraction note).
- **Fix sketch**: Export the `MIN_CONTENT/MAX_CONTENT/MAX_NAME` constants and reuse them in the client with an inline character counter/disabled-submit. Extract `AddDocumentForm`, `CoverageMeter`, and `BucketList` into sibling components.
