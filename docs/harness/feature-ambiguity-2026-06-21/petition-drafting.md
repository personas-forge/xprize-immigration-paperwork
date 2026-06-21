# Petition Letter Drafting Studio — Feature Scout + Ambiguity Guardian

> Context #5 · Group: Petition Drafting & Document Generation
> Total: 5 findings

## 1. The finished letter can only be exported when a save FAILS — no Copy/Download on the happy path

- **Lens**: feature-scout
- **Priority**: High
- **Category**: feature
- **File**: `src/features/drafting/components/DraftStudio.tsx:344` (and `:537-545`)
- **Observation**: A fully serialized, exhibit-indexed plain-text rendering of the letter already exists and is unit-tested (`draftClipboardText` / `copyDraftToClipboard` in `saveRecovery.ts:33,53`). But `copyDraft()` is wired ONLY into `SaveFailedAlert`, which renders solely when `saveFailed === true` (`DraftStudio.tsx:537`). On the normal `status === "done"` path — draft generated and saved — there is no Copy, Download, Print, or Export control anywhere in the studio or in `CaseDetailView.tsx:169`. The only way a paying applicant gets their letter out of the app is to trigger a persistence failure.
- **Proposal**: Add an always-visible "Copy letter" (and ideally "Download .txt/.docx" + a print-friendly `/case/[id]/draft/print` route) action on the `done` toolbar (next to "Save edits"), reusing the existing `draftClipboardText(sections, exhibitIndex)`. Near-zero new logic — it's wiring an already-built, already-tested serializer to a button.
- **Value / Risk-if-ignored**: This is the product's core deliverable — the petition letter the attorney files. With no export, the studio is effectively read-only inside the app; users will screenshot or hand-retype, and the attorney-of-record can't easily pull the work product into their filing workflow. Hard to sell a drafting tool whose output you can't take with you.
- **Effort**: S

## 2. Hallucinated `(Exhibit N)` citations are flagged but never block save or filing — the "can't ship evidence you don't have" guarantee is unenforced

- **Lens**: ambiguity-guardian
- **Priority**: High
- **Category**: edge_case
- **File**: `src/features/drafting/drafting.ts:623-641` (CitationAudit doc) vs. `src/features/drafting/components/ExhibitIndex.tsx:28-43`
- **Observation**: The `CitationAudit` doc comment calls `unresolved` "the load-bearing safety signal… the 'you can never ship a letter that cites evidence you don't have' guarantee." In practice `audit.unresolved` is consumed in exactly one place — a red `Badge` and an advisory `<p>` in `ExhibitIndex` (`ExhibitIndex.tsx:28,33-43`). Nothing acts on it: `saveEdits`/`applyRedline`/`retrySave` persist regardless, the server-side `adjudicate` step (`draftOperation.ts:244`) doesn't read it, and the attorney-review/file transition is unaffected. A draft that cites `(Exhibit 9)` with no Exhibit 9 on file saves, versions, and can proceed to filing exactly like a clean one.
- **Proposal**: Decide and record the intended contract. Either (a) make `unresolved.length > 0` a hard gate on the attorney "ready to file" / submit-for-review transition (server-side, not just a client badge), or (b) downgrade the doc comment from "guarantee" to "advisory flag" so a future auditor isn't misled about a protection that doesn't exist. Given the legal blast radius, (a) is preferred — at minimum surface unresolved citations into the `adjudication` report the route already returns.
- **Value / Risk-if-ignored**: A petition filed with a citation to evidence that isn't in the record is a credibility hit and an RFE/denial risk. The code's own comment promises this can't happen; the behavior allows it. That gap between stated intent and enforcement is exactly the kind a future dev "fixes" by trusting the comment.
- **Effort**: M

## 3. Client-supplied `source` label is persisted unverified across the no-charge save paths

- **Lens**: ambiguity-guardian
- **Priority**: High
- **Category**: trade-off
- **File**: `src/features/drafting/saveRecovery.ts:77-92` and `src/app/api/draft/save/route.ts:86-91`
- **Observation**: `/api/draft/save` is reached by `saveEdits`, `applyRedline`, and `retrySave`, each of which posts `{ caseId, sections, source }` where `source` is whatever is in component state (`DraftStudio.tsx:330,357,380`). `parseSaveDraftRequest` is deliberately lenient — an unknown source silently becomes `"mock"` (`saveRecovery.ts:90`, `asModelSource`) — and the route persists that label as-is. So a genuine `gemini`/`claude` draft, once edited and re-saved, can be relabeled (e.g. a client bug or a stale state setting it to `mock`), and conversely a client could assert `source:"gemini"` on template text. The provenance label that the UI shows as a trust signal (`sourceLabel`, the "Placeholder output" banner at `DraftStudio.tsx:526`) is thus client-asserted on the save path, with no recorded reasoning for why that's acceptable.
- **Proposal**: Document the trust model explicitly, or harden it: have the save route refuse to UPGRADE a stored draft's source (mock→gemini) — only the charged `/api/draft` path, which actually invoked an engine, may set a model source; a no-charge save should preserve/downgrade the prior version's source rather than trust the client. Record the decision either way in `saveRecovery.ts`.
- **Value / Risk-if-ignored**: Provenance ("AI-assisted by gemini" vs "deterministic template") is a correctness-and-trust claim shown to the attorney and applicant. A label that can drift on a free re-save means a future auditor can't trust the stored `source`, and "honest labeling" — a property the codebase clearly cares about (`tryParseDraftResponse` doc at `drafting.ts:369`) — silently breaks on the save seam.
- **Effort**: M

## 4. Non-destructive draft versions are persisted but invisible — no history / diff / restore

- **Lens**: feature-scout
- **Priority**: Medium
- **Category**: user_benefit
- **File**: `src/lib/data/petitions.ts:156-171` (`saveDraft` always new version; `getLatestDraft` only)
- **Observation**: Every generate, section-regenerate, applied redline, and "Save edits" writes a NEW version (`saveDraft` doc: "never overwrites prior text"), and the UI surfaces the current number as a `Saved · vN` pill (`DraftStudio.tsx:647`). But the only reader is `getLatestDraft` — there is no `getDraftVersions` / `getDraftVersion(n)`, and no UI to view, compare, or restore an earlier version. The full non-destructive history accrues in storage and is unreachable.
- **Proposal**: Add a "Version history" affordance: list prior versions (number + source + timestamp), preview/diff against current, and a one-click restore (which itself saves as a new version, staying non-destructive). Requires a `getDraftVersions(caseId)` read in `petitions.ts` + a small panel.
- **Value / Risk-if-ignored**: A regenerate or applied redline that makes a section worse is currently unrecoverable in-app — the user must have copied the old text first (and per finding #1, they often can't). The non-destructive versioning was clearly built to enable exactly this; leaving it write-only forfeits the payoff and erodes trust in regeneration ("what if it gets worse?").
- **Effort**: M

## 5. Tuning constants (`WEAK_SECTION_SCORE`, token costs, context trim) are unexplained magic numbers split across UI and server

- **Lens**: ambiguity-guardian
- **Priority**: Medium
- **Category**: code_quality
- **File**: `src/features/drafting/components/DraftStudio.tsx:82` and `:46,438,633`; `src/features/drafting/drafting.ts:267`
- **Observation**: `WEAK_SECTION_SCORE = 80` (`DraftStudio.tsx:82`) does triple duty with no recorded rationale: it gates whether the adjudicator redline card is offered (`:608`), it's the success/warning boundary in `scoreTone` (`:693`), AND it controls overall draft-quality coloring — so "80" silently encodes a legal-quality threshold. Separately, token costs are hardcoded as display strings in the UI ("Uses 12 tokens" `:46/:438`, "5" `:589/:633`) with no link to the server's authoritative `operation` charge (`draftOperation.ts:110`), so a price change in one place quietly desyncs the other. `SECTION_CONTEXT_CHARS = 600` (`drafting.ts:267`) trims continuity context with no note on why 600.
- **Proposal**: Name and document these as a small set of constants with a one-line "why this value" each (e.g. why a section <80 is considered weak enough to redline). Derive the displayed token costs from the single server-side cost source instead of literals, so the paywall copy can't lie about the price.
- **Value / Risk-if-ignored**: A future dev can't tell whether 80 is a product decision or an arbitrary placeholder, so they'll change it blindly (re-pricing legal quality, or shifting which sections get auto-critiqued). Desynced token-cost copy is a money-honesty bug: the UI promises "12 tokens" while the server charges whatever `draftSpec.operation` resolves to.
- **Effort**: S
