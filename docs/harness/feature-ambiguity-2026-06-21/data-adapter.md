# Data Adapter Layer — Feature Scout + Ambiguity Guardian

> Context #6 · Group: Evidence & Case Management
> Total: 5 findings

## 1. Case-LIST operations bypass the adapter seam — the review queue's cross-tenant read is gated only at the page
- **Lens**: feature-scout
- **Priority**: High
- **Category**: functionality
- **File**: `src/lib/data/adapters/petition.ts:81` (adapter surface) · `src/app/dashboard/review/page.tsx:23` · `src/app/dashboard/page.tsx:29` · `src/lib/data/saved-cases.ts:29`
- **Observation**: ADR-0010's whole promise is "any adapter method that touches a case routes through `resolveCase` first, so the IDOR check can never be omitted." But the three *list* reads — `getCasesForUser` (owner dashboard), `getCasesInReview` (the attorney/ops cross-tenant review queue), and `saved-cases.ts` — are NOT exposed on `PetitionAdapter` at all. Callers import the raw `@/lib/data/petitions` functions directly. The most sensitive one, `getCasesInReview()`, returns *every* applicant's case across tenants and is protected only by an inline `canView` check in `review/page.tsx:19` — exactly the copy-paste-the-gate pattern the adapter exists to eliminate.
- **Proposal**: Add `listOwnedCases(access)` and `listReviewQueue(access)` to `PetitionAdapter`. The owner list scopes to `access.userId`; the review-queue method fail-closes unless `isConfiguredAttorney || isConfiguredOps` (move that policy into the adapter, returning `forbidden` for everyone else). Migrate the three call sites onto the seam so list reads share the same `AdapterResult` + access contract as single-case reads.
- **Value / Risk-if-ignored**: The cross-tenant enumeration gate now lives in a page component; a second review surface (an API export, a mobile route, an ops dashboard) that forgets the `canView` line leaks every applicant's name/classification/likelihood. Centralizing it closes the exact IDOR class the layer was built to prevent. Effort to add list methods is low and the value (no ungated cross-tenant list path) is high.
- **Effort**: M

## 2. Evidence removal is a permanent hard-DELETE — no soft-delete, recovery, or audit trail for a legal vault
- **Lens**: feature-scout
- **Priority**: High
- **Category**: feature
- **File**: `src/lib/data/adapters/evidence.ts:126` → `src/lib/db/pglite-store.ts:740` (`delete from case_documents …`)
- **Observation**: `EvidenceAdapter.removeDocument` maps straight to a SQL `DELETE`. Once a petitioner (or the attorney of record) removes an exhibit, the document row, its extracted facts, and its monotonic exhibit ordinal are gone with no recovery and no record that it ever existed. For a USCIS evidence vault that an attorney signs off on, an accidental or disputed deletion is unrecoverable, and there is no "who removed exhibit C and when" trail.
- **Proposal**: Add soft-delete to the seam: a `deleted_at`/`deleted_by` column, have `removeDocument` set it (still returning `not_found` when no live row matches), filter it out of `getDocuments`, and expose `restoreDocument(access, caseId, documentId)` + an optional `listDeletedDocuments`. The exhibit ordinal is already non-reused (`pglite-store.ts:672`), so restore is safe. This is the same "user-scoped soft-delete table" seam the sibling projects already standardized on.
- **Value / Risk-if-ignored**: Irreversible loss of filed legal evidence is a trust-and-liability problem, not a polish item — an applicant who fat-fingers a delete on award.pdf the night before filing has no recourse. Soft-delete also unlocks an undo affordance in `EvidenceVault.tsx`, which today fires `void removeDocument(...)` (`EvidenceVault.tsx:156`) with no confirmation or undo.
- **Effort**: M

## 3. `resolveCase`'s mid-call "store dropped" re-probe is an undocumented heuristic that can mask a real `forbidden`
- **Lens**: ambiguity-guardian
- **Priority**: High
- **Category**: edge_case
- **File**: `src/lib/data/adapters/access.ts:69-76`
- **Observation**: After the owner and attorney legs both fail, the gate re-calls `storeConfigured()` and, if it now returns false, yields `unconfigured` (503) instead of `forbidden` (403). The stated reasoning is that "a `null` from `getCaseForUser` can also mean the store went unavailable mid-call (a driver that yields no rows on a dropped connection, not a throw)." That premise is an assumption about driver behavior that is neither asserted in the `Store` contract nor covered by a test — `access.test.ts` has no case for it. The branch silently converts a legitimate deny into a "try again" for any caller who is genuinely not the owner whenever `storeConfigured()` flickers (e.g. a transient `getStore()` failure), and conversely does nothing for the far more likely case where the driver *throws* (already caught) vs. *returns empty rows on a healthy connection* (a real non-owner).
- **Proposal**: Either (a) document the exact driver failure mode this defends against (cite which store returns rows-less-without-throw on a dropped connection) and add an `access.test.ts` case pinning the behavior, or (b) drop the re-probe and rely on the `try/catch → store_error` path, treating a clean `null` as an authoritative deny. Pick one and record the decision in the ADR; today the intent is unrecoverable from the code.
- **Value / Risk-if-ignored**: A security gate whose deny-vs-retry outcome depends on an unverified, untested assumption about connection-drop semantics is exactly the kind of subtle logic that bites during an incident — a legitimate owner could get a confusing 503, or a flicker could turn denies into retry-storms. The fail-closed reputation of the layer rests on this function being unambiguous.
- **Effort**: S

## 4. The "`addCaseDocument` returns null ONLY when no store" contract is load-bearing across 503-vs-500 mapping but unenforced
- **Lens**: ambiguity-guardian
- **Priority**: Medium
- **Category**: trade-off
- **File**: `src/lib/data/adapters/evidence.ts:99-104` · `src/lib/data/adapters/petition.ts:114-123`
- **Observation**: `addDocument` decides between `unconfigured` (503, reassuring) and `store_error` (500, alarming) by re-probing `storeConfigured()` after a `null` insert, on the documented assumption that "`addCaseDocument` returns null ONLY when no store is configured; a real store FAULT throws." Yet `petition.ts:createCase` makes the *opposite* default choice for the structurally identical situation — a `null` write against a configured store is mapped straight to `store_error` with a synthesized cause. The two sibling adapters encode contradictory beliefs about what a null write means, and nothing in `petitions.ts`/`evidence.ts` actually guarantees the "null ⇒ no store" invariant — a future Firestore/pg path that returns null on a partial failure would be silently mislabeled as a temporary 503, telling a charged user to "try again" on data that will never persist.
- **Proposal**: Make the invariant explicit in the data layer (have `addCaseDocument`/`createCaseWithCriteria` throw on any configured-store failure and reserve `null` strictly for the no-store no-op), then drop the re-probe heuristic in favor of the same `null ⇒ store_error` rule `createCase` already uses — making the two adapters consistent. Document the chosen contract once in `result.ts`.
- **Value / Risk-if-ignored**: A user is charged tokens for categorization; if their evidence silently fails to save and they're told "temporarily unavailable, try again," they retry, get re-charged, and still lose the document — a money-and-data-integrity outcome riding on an unenforced assumption that two adapters already disagree about.
- **Effort**: M

## 5. `getCasesInReview` silently truncates at a magic `limit 200`; adapter list reads expose no pagination
- **Lens**: ambiguity-guardian
- **Priority**: Medium
- **Category**: edge_case
- **File**: `src/lib/db/pglite-store.ts:463` (`limit 200`) · `src/lib/db/firestore-store.ts:336` · consumed at `src/app/dashboard/review/page.tsx:23`
- **Observation**: The attorney review queue is capped at the 201st case with a bare `limit 200` and no `order`-stable cursor, offset, or "more exist" signal surfaced to the caller. There is no comment explaining why 200 (vs. 50 or 1000), and the page renders the truncated list as if it were complete. Because the list path bypasses the adapter (finding #1), there is also no `AdapterResult`-level place to carry a `hasMore`/`nextCursor`. Once a busy firm crosses 200 active-review cases, the oldest-waiting petitions (it's `order by updated_at asc`) silently fall off the bottom of the queue — the worst possible cases to drop.
- **Proposal**: When list operations move onto the adapter (#1), make the page size an explicit named constant with a recorded rationale and return a paginated result (`{ items, nextCursor }` or at minimum a `truncated: boolean`). Until then, document the 200 cap at the call site and surface a "showing oldest 200 of N" affordance so a reviewer knows cases are hidden.
- **Value / Risk-if-ignored**: An attorney trusting the queue to be exhaustive can leave the longest-waiting applicants unreviewed indefinitely — an SLA/compliance failure with no error and no log. The magic 200 with no stated reasoning is unrecoverable intent for the next dev who has to tune it.
- **Effort**: S
