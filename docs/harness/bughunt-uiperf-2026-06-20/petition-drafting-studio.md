> Total: 5 | Critical: 1 | High: 2 | Medium: 1 | Low: 1
> Context: Petition Letter Drafting Studio
> Lens mix: bug-hunter 4, ui-perfectionist 1

## 1. Keyless/no-store build reports "Saved ✓" while persisting nothing — false success on the rescue + save paths
- **Severity**: Critical
- **Lens**: bug-hunter
- **Category**: data-loss / false-positive persistence
- **File**: src/app/api/draft/save/route.ts:86-94 ; src/lib/data/petitions.ts:156-164 ; src/features/drafting/saveRecovery.ts:103-126 ; src/features/drafting/components/DraftStudio.tsx:337-354 (saveEdits), 313-335 (retrySave), 282-306 (applyRedline)
- **Scenario**: A user edits a section, clicks "Save edits" (or hits the SaveFailedAlert "Retry saving", or "Apply fix"). `retrySaveDraft` → POST `/api/draft/save`. When no Store is configured (the documented graceful-degradation contract used by the keyless build), `petitions.saveDraft` no-ops and returns `null`. The save route still responds `200 { caseId, version: null }`. `retrySaveDraft` reads `res.ok === true` and returns `{ ok: true, version: null }`. The client sets `editSaveState="saved"` ("Saved ✓"), clears `saveFailed`, and the retry alert disappears.
- **Root cause**: The persistence contract overloads `null` to mean BOTH "saved, version unknown" (legit on the inline path) and "no store, nothing was written." `retrySaveDraft` treats any 2xx as success and `version: null` as benign, so a true no-op is indistinguishable from a real save. Unlike `/api/draft` (which surfaces `saveFailed` when persistence yields no version), the rescue/save route has no "did this actually persist?" signal.
- **Impact**: The single highest-stakes promise of this studio — "your paid work product is safely stored" — is shown as kept when it was not. The attorney/petitioner closes the tab trusting the green checkmark; the draft is gone. Worse, this is exactly the path the user reaches *after* a save already failed (SaveFailedAlert → Retry), so the rescue UI can convert a recoverable "Not saved" into a believed-saved data loss.
- **Fix sketch**: Make "saved" provable. Have the save route distinguish no-store (return e.g. `{ version: null, persisted: false }` or a 503/409) from a real write (`{ version: n, persisted: true }`). In `retrySaveDraft`/`saveEdits`, only show "Saved ✓"/clear `saveFailed` when `persisted === true` (or `version` is a number); otherwise keep the unsaved state and tell the user persistence is unavailable. Mirror the `saveFailed` discipline `/api/draft` already uses.

## 2. Merge-by-heading clobbers any duplicate or reserved-name section on regenerate
- **Severity**: High
- **Lens**: bug-hunter
- **Category**: merge correctness / wrong-section overwrite
- **File**: src/features/drafting/draftOperation.ts:87-93 (mergeRegeneratedSection), 75-84 (pickMergeBase) ; src/features/drafting/components/DraftStudio.tsx:230-232 (setSections map)
- **Scenario**: A petition has two criteria with the same display name (e.g. two "Critical role" entries, or a vault-derived criterion that collides with "Introduction"/"Conclusion"). The user regenerates one. Both the server merge (`base.map(s => s.heading === focus ? {heading, body} : s)`) and the client update (`prev.map(s => s.heading === heading ? data.section : s)`) match by heading, so EVERY section sharing that heading is overwritten with the single regenerated body.
- **Root cause**: Heading is treated as a unique key for merge, but nothing guarantees heading uniqueness — `criteria` names are free-form user/model text, and the mock/model can emit duplicate or reserved headings. There is no positional/id-based identity for a section.
- **Impact**: Silent corruption of a paid draft: a distinct argument section is replaced by an unrelated one's text, and the persisted version (and the displayed letter) now contains duplicated/wrong content the attorney may file. No error surfaces.
- **Fix sketch**: Merge by index/identity, not by heading string. Regenerate by the section's array index (or a stable section id assigned at generate time); when matching by heading, replace only the FIRST occurrence and assert uniqueness (or de-dupe headings at draft build). Apply the same fix to the client `setSections` map and `pickMergeBase`.

## 3. Section regenerate can charge `draft_section`, succeed, yet save nothing — and the studio never tells the user
- **Severity**: High
- **Lens**: bug-hunter
- **Category**: charge-without-persisted-output / dropped edits
- **File**: src/features/drafting/draftOperation.ts:249-277 (persist, section branch) ; src/features/drafting/components/DraftStudio.tsx:207-244 (regenerate)
- **Scenario**: On the DB path the client sends its current `sections` with the regenerate. If that set does not contain the focused heading (legacy client, or heading drifted after an exhibit/criteria rename), `pickMergeBase` returns null and `persist` falls back to `getLatestDraft`. If no stored draft exists yet (the *first* generate's full save had failed, or the case was never full-drafted before a single-section regenerate), persist returns `{ version: null, saveFailed: true }` — correct server-side. BUT in `regenerate()` the client updates `sections` locally and shows the fresh body; the `saveFailed` flag IS read, yet the new section's body now lives only in component state while the user already paid 5 tokens.
- **Root cause**: Regenerate is gated on a stored base draft existing, but the studio offers per-section "Regenerate" buttons unconditionally whenever `status === "done"` — including a `done` state hydrated from `initialSections` whose version may not actually be on file, or after a failed initial save. The recovery UI (`SaveFailedAlert`) exists, so this is partly mitigated, but the regenerate path's `saveFailed` only triggers the alert; there is no guard that prevents charging when there is provably nothing to merge into.
- **Impact**: User pays for a regenerate that cannot be persisted; the work survives only until the tab is open. Overlaps the known "first-generate seeding" follow-up but is sharper because a *charge* happens. (Not Critical because SaveFailedAlert + copy can rescue it when `saveFailed` surfaces.)
- **Fix sketch**: Before charging a `draft_section` op, require a resolvable merge base (client sections containing the focus OR a stored latest draft); otherwise 409/"generate the full letter first" with no charge. On the client, disable per-section Regenerate until a confirmed-persisted version exists (track `version` from the response, which the studio currently ignores).

## 4. First-generate seeding: section regenerate on an un-stored draft updates client only (version stays null)
- **Severity**: Medium
- **Lens**: bug-hunter
- **Category**: known-followup / persistence seam
- **File**: src/features/drafting/draftOperation.ts:255-269 ; src/lib/data/petitions.ts:167-171 (getLatestDraft)
- **Scenario**: A case has criteria but no saved draft version. The user immediately uses a per-section action (e.g. RFE radar "Reinforce" → `regenerate`). With no `clientSections` carrying the focus and no `getLatestDraft`, persist logs "no stored draft to merge into" and returns `saveFailed: true`; the merged whole-letter version is never seeded.
- **Root cause**: The merge model assumes a prior full-letter save to anchor the version chain; a single-section path has no "create the base if absent" branch. This is the acknowledged follow-up in the known-structure notes.
- **Impact**: Per-section work on a fresh case can't be persisted until a full draft is saved once; relies on the SaveFailedAlert/copy rescue. No money lost beyond finding #3's charge concern.
- **Fix sketch**: When persist has no merge base on a section regenerate, seed a new draft from the client sections (or from `mockDraft`/the qualifying criteria) with the regenerated body merged in, then save as version 1 — so the first per-section action establishes the chain instead of failing.

## 5. Studio "done" view lacks a top-level save/version status — "Saved ✓" reverts and unsaved-edit risk is invisible
- **Severity**: Low
- **Lens**: ui-perfectionist
- **Category**: missing state / status clarity
- **File**: src/features/drafting/components/DraftStudio.tsx:600-623 (Save edits button + microprint), 356-360 (editBody resets editSaveState), 207-244 (regenerate does not reset editSaveState)
- **Scenario**: After "Save edits" shows "Saved ✓", regenerating a section (or applying a redline) changes `sections` but does NOT reset `editSaveState`, so the button keeps reading "Saved ✓" while the displayed letter has changed since the last explicit Save. There is also no persistent "Unsaved changes" indicator — only the transient button label and a static microprint — and the response `version` is never displayed, so the user can't tell which version is on file.
- **Root cause**: `editSaveState` is only reset in `editBody` (textarea typing), not in the other mutators (`regenerate`, `applyRedline`). No single source of truth for "are the visible sections the persisted ones?"
- **Impact**: Polish-level trust gap: a stale "Saved ✓" suggests the current view is persisted when a later regenerate made it dirty. Confusing on high-stakes legal work product, but no data loss by itself.
- **Fix sketch**: Reset `editSaveState` to "idle" in every path that mutates `sections` (regenerate, applyRedline, retrySave success), or derive a `dirty` boolean by comparing current sections to the last-persisted snapshot. Surface a small "Saved · v3" / "Unsaved changes" pill near the action row, fed by the response `version`.
