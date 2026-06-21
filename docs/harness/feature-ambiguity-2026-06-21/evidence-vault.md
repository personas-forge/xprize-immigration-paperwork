# Evidence Vault & Categorization — Feature Scout + Ambiguity Guardian

> Context #9 · Group: Evidence & Case Management
> Total: 5 findings

## 1. Categorization trusts the client-supplied `classification` instead of the case's real visa pack
- **Lens**: ambiguity-guardian
- **Priority**: High
- **Category**: edge_case
- **File**: `src/app/api/evidence/categorize/route.ts:57-60`
- **Observation**: The route reads `classification` straight off the untrusted request body (`typeof record.classification === "string" ? record.classification : "O-1A"`) and uses it both to pick the criteria pack for the prompt AND to persist `criterion` onto a real case. But the case already has an authoritative `stored.classification` — the case page passes it to `EvidenceVault` (`page.tsx:76`), which then echoes it back in the POST body (`EvidenceVault.tsx:89`). The server never re-derives it from the resolved case. A client (or a stale tab after the case's classification changed) can submit `classification: "O-1B"` against an O-1A case; the document is then bucketed into arts criteria the case doesn't use, persisted, and counted in `summarizeVault` coverage against the wrong criteria set.
- **Proposal**: After `resolveCase`/`getDocuments` resolves the case in `parse`, take `classification` from the resolved `StoredCase`, not the body. Only fall back to the body value (or `"O-1A"`) on the keyless/no-case path where no case is available.
- **Value / Risk-if-ignored**: Persisted buckets and gap/coverage analysis silently diverge from the case's actual visa type — a wrong-criterion exhibit (e.g. an O-1A award filed under an O-1B bucket) misleads the applicant and the attorney of record about what is covered. Server-authoritative classification closes a client-controlled correctness hole.
- **Effort**: S

## 2. No PDF/image upload — the vault is paste-text-only while the UI keeps promising OCR "coming"
- **Lens**: feature-scout
- **Priority**: High
- **Category**: feature
- **File**: `src/features/evidence/components/EvidenceVault.tsx:238`
- **Observation**: The entire flow is paste-or-describe-text: the body validates `content` as a string (`evidence.ts:67`, `MIN_CONTENT`/`MAX_CONTENT`), and the UI says "PDF/image OCR via Document AI is coming" (`EvidenceVault.tsx:238`) and "Binary upload + Document AI OCR are an env-gated production extension" (`evidence.ts:13`). But there is no upload control, no `/api/evidence/categorize` multipart path, and `requiresImages` is explicitly NOT set (route comment at `route.ts:77-78`). A real applicant's evidence is PDFs and image scans (award certificates, press clippings, recommendation letters) — they must manually transcribe each one to file it.
- **Proposal**: Add a file-upload affordance that runs Document AI OCR (or a client-side text extraction for digital PDFs) to populate `content`, then feeds the same categorize pipeline. Gate it behind the existing env flag and set `requiresImages` so multimodal ops never land on the image-less Claude CLI engine.
- **Value / Risk-if-ignored**: This is the single biggest friction in the product's core loop — "upload your evidence" is what an applicant expects from an immigration-petition SaaS, and transcribe-by-hand makes the vault feel like a demo. The seams (env gate, `requiresImages` note, OCR mention) are already laid; the feature is unbuilt.
- **Effort**: L

## 3. Document text is never stored — exhibits can't be re-read, re-categorized, or proofed after filing
- **Lens**: feature-scout
- **Priority**: Medium
- **Category**: user_benefit
- **File**: `src/features/evidence/types.ts:10-18`
- **Observation**: `StoredDocument` persists only `name`, `criterion`, `exhibit`, `status`, `facts`, `source` — never the `content` the user pasted. The stores confirm it (`pglite-store.ts:691` and `firestore-store.ts:553` insert no content column/field). Once a document is filed, the original text is gone; the vault shows only the AI-extracted `facts`. There's also no "re-categorize" action — refile is a manual bucket move that explicitly does NOT re-check fit (`EvidenceVault.tsx:283-287`), and the only way to re-run the model is to delete (burning the exhibit number) and re-paste the text from scratch.
- **Proposal**: Persist the original `content` (or a bounded excerpt) on the document, and add a "Re-categorize" action that re-runs `/api/evidence/categorize` against the stored content for that exhibit (charging the light op) without losing the exhibit number. At minimum, show the stored content in the vault so the attorney of record can read the actual evidence, not just the facts.
- **Value / Risk-if-ignored**: An attorney reviewing the vault can't see what an exhibit actually says, only a 2–6 item fact list; a mis-categorized doc can only be re-judged by destroying and re-creating it (new, higher exhibit number — a permanent gap in the sequence). Storing content unlocks re-categorize, proofing, and export.
- **Effort**: M

## 4. `status` defaults to "Received" with no transition path — the attorney-review state of an exhibit is undefined
- **Lens**: ambiguity-guardian
- **Priority**: Medium
- **Category**: functionality
- **File**: `src/lib/data/evidence.ts:35` (and `pglite-store.ts:689`, `firestore-store.ts:551`)
- **Observation**: Every document is written with `status: input.status ?? "Received"`, but nothing in this context ever supplies a non-default status or transitions it: `addDocument` callers (`route.ts:99-108`) omit `status`, and there are no actions to advance it. The product story is "your attorney of record reviews each" (`EvidenceVault.tsx:284-286`), yet the `status` field that would record that review is a frozen literal. A future dev or auditor can't recover what the values mean, what transitions are legal, or who is allowed to set them — the field reads as a planned-but-unwired workflow.
- **Proposal**: Either (a) build the intended workflow — a documented `status` enum (e.g. `Received → Reviewed → Verified / Flagged`) with an attorney-gated action to advance it, surfaced as a per-exhibit badge — or (b) if review-state isn't being tracked yet, drop the field and the implied contract until it is. Record the decision and the legal allowlist for who may change status.
- **Value / Risk-if-ignored**: A dormant `status` field invites a half-built feature where exhibits silently carry a meaningless "Received" forever, or a later contributor wires transitions without a recorded rule for who may verify evidence — exactly the kind of unrecorded eligibility/review decision that bites in an audit.
- **Effort**: M

## 5. Refile/remove server actions silently revert on a denied or failed mutation
- **Lens**: ambiguity-guardian
- **Priority**: Medium
- **Category**: edge_case
- **File**: `src/features/evidence/actions.ts:45-61` + `src/features/evidence/components/EvidenceVault.tsx:160-165`
- **Observation**: `onRefile`/`onRemove` optimistically update local state and fire the server action inside `startTransition` with `void` (`EvidenceVault.tsx:156,163`) — the result is discarded. The actions treat EVERY non-`ok` adapter outcome as a no-op return (`actions.ts:41,59`): `forbidden`, `not_found`, `store_error`, `unconfigured` all return silently without revalidating. So if an attorney-of-record refiles an exhibit and the store rejects or faults, the UI shows the move as applied while the persisted record is unchanged; on the next reload the change vanishes with no error. The `add` path was deliberately hardened against exactly this (the `saveFailed` warning at `EvidenceVault.tsx:127-131`), but refile/remove have no equivalent.
- **Observation continued**: Comments at `actions.ts:18-22` document this as intentional "graceful degradation," but the trade-off (silent loss of an attorney's re-categorization) is not surfaced to the user.
- **Proposal**: Have the actions return their `AdapterResult` status (or a boolean), and have `EvidenceVault` revert the optimistic update + show the existing warning banner when the mutation didn't persist — mirroring the `saveFailed` treatment already built for `add`.
- **Value / Risk-if-ignored**: A re-filing the attorney believes they made (moving an exhibit to the criterion it actually proves) can silently fail to save, so the vault's coverage/gap picture is wrong on reload and the attorney is unaware. Silent data loss on a mutation that affects which criteria look "covered" is a higher-stakes version of the bug `add` already guards against.
- **Effort**: S
