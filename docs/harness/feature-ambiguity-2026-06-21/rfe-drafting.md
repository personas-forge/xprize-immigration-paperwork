# RFE Response Drafting — Feature Scout + Ambiguity Guardian

> Context #4 · Group: Petition Drafting & Document Generation
> Total: 5 findings

## 1. RFE responses are versioned in storage but the prior versions are unreachable
- **Lens**: feature-scout
- **Priority**: High
- **Category**: feature
- **File**: `src/lib/db/pglite-store.ts:594` (and `src/app/api/rfe/route.ts:147`, `src/features/rfe/components/RfeStudio.tsx`)
- **Observation**: Every RFE draft is persisted as a NEW monotonic version — `saveRfeResponse` does `coalesce(max(version),0)+1` (pglite-store.ts:596-607; Firestore mirror at firestore-store.ts:461) and the route comment proudly calls this "non-destructive versioning". But the ONLY read path is `getLatestRfeResponse` (returns `order by version desc limit 1`), the page passes only `rfe?.sections` into `RfeStudio` (`cases/[id]/page.tsx:67,98`), and there is no route or UI to list/view/restore an earlier version. So a "Regenerate response" silently buries the prior (paid-for) draft forever — the user cannot diff or roll back, and the stored history is dead weight nobody can see.
- **Proposal**: Add `getRfeVersions(caseId)` to the store + adapter and a `GET /api/rfe/versions?caseId=` (owner-or-attorney gated, mirroring the responder), then a compact "Previous responses (v1…vN)" picker in `RfeStudio` that loads a chosen version read-only with a "Restore as new version" action. Same pattern is needed for petition drafts, so build the seam once.
- **Value / Risk-if-ignored**: A regenerate on a money button that destroys the visible previous draft, with no recovery, is a trust and data-loss footgun for a legal filing — and it wastes storage the product already pays to write. Version history is table-stakes for "draft → review → revise" attorney workflows.
- **Effort**: M

## 2. The RFE responder ignores any earlier RFE on the same case — each notice overwrites the last
- **Lens**: feature-scout
- **Priority**: Medium
- **Category**: functionality
- **File**: `src/app/api/rfe/route.ts:147` · `src/lib/data/petitions.ts:182`
- **Observation**: A real case can receive more than one RFE (an initial RFE, then a NOID or a second RFE on different criteria). The model treats `rfe_responses` as a single linear version chain keyed only by `case_id` (pglite-store.ts:596) and `rfeInitialText` is just "the latest one" (`cases/[id]/page.tsx:99`). There is no notion of WHICH RFE notice a version answers — `rfe_text` is stored per-version but never used to group or distinguish distinct notices. A second, unrelated RFE just appends to the same chain and the UI shows only the most recent paste.
- **Proposal**: Either (a) document explicitly that the studio intentionally handles one active RFE at a time, or (b) introduce an `rfe_notice` grouping (a stable notice id / received-date) so multiple concurrent RFEs each get their own response thread. Even a minimal "this responds to the RFE received on <date>" label per version would disambiguate.
- **Value / Risk-if-ignored**: Multi-RFE is common in O-1A/EB-1A practice; an attorney who pastes the second notice and sees the first response's text (or silently overwrites the first response) could file the wrong brief. Worth at least a recorded decision now.
- **Effort**: M

## 3. The "5 tokens" cost shown on the buttons is hardcoded, not derived from the pricing registry
- **Lens**: ambiguity-guardian
- **Priority**: High
- **Category**: trade-off
- **File**: `src/features/rfe/components/RfeStudio.tsx:225` · `src/features/rfe/components/RfeRiskRadar.tsx:101,162`
- **Observation**: `registry.ts` is declared the "SINGLE SOURCE OF TRUTH" for per-operation cost — `rfe` is `tier: "heavy"` → `TIER_COST.heavy = 5` (registry.ts:19,40), and `costOf("rfe")` returns it. Yet three UI labels hardcode the literal string `5 tokens` ("Uses 5 tokens…" in RfeStudio; two "5 tokens" pills in RfeRiskRadar). Nothing ties these literals to `costOf`/`TIER_COST`. The registry comment claims repricing is "a one-file edit here" — but re-tiering `rfe` to `xl` (12) would leave the buttons lying "5 tokens" while the ledger debits 12.
- **Proposal**: Replace the literals with a value derived from the registry — e.g. pass `costOf("rfe")` (or a small `<TokenCost op="rfe" />` helper) into both components so the displayed price and the charged price share one source. Add a test asserting the rendered cost equals `costOf("rfe")`.
- **Value / Risk-if-ignored**: A money button that promises one price and charges another is a billing-trust and arguably a consumer-disclosure problem on a paid legal tool. The "single source of truth" invariant is silently broken at the exact surface users read before paying.
- **Effort**: S

## 4. `isAddressable`/`isRelied` magic status set is duplicated and its "why these three" rationale is undocumented
- **Lens**: ambiguity-guardian
- **Priority**: Medium
- **Category**: code_quality
- **File**: `src/features/rfe/rfe.ts:71` and `src/features/rfe/rfe.ts:330`
- **Observation**: Two functions, `isAddressable` (line 71-73) and `isRelied` (line 330-332), contain the IDENTICAL literal predicate `status === "Met" || status === "Strong" || status === "Partial"`. They drive money-relevant gates: which criteria the mock argues, and the pre-charge `hasReliedCriteria` guard that blocks billing for an empty radar. The status vocabulary ("Met"/"Strong"/"Partial"/"None") is a stringly-typed contract validated only "in app code" (petitions.ts:21), with no shared enum/constant. A future dev who adds a status (e.g. "Weak") or fixes a casing mismatch in one copy and not the other would silently change what gets billed/argued in only one path.
- **Proposal**: Collapse the two into one exported `RELIED_STATUSES` set (or a single `isRelied` reused by `isAddressable`), reference it from both `rfe.ts` and `RfeStudio.tsx:113` (which already imports `isRelied`), and add a one-line comment recording WHY "Partial" is included (an RFE targets the weak/Partial ones) and "None" excluded.
- **Value / Risk-if-ignored**: Two copies of a money/eligibility predicate WILL drift; the cost is a wrong charge or a hollow draft, not a cosmetic typo. Centralizing also makes the status enum auditable.
- **Effort**: S

## 5. `FILED_SECTION_CHARS = 800` silently truncates the as-filed petition fed to the model, with no recorded rationale
- **Lens**: ambiguity-guardian
- **Priority**: Medium
- **Category**: edge_case
- **File**: `src/features/rfe/rfe.ts:148` (used at `rfe.ts:209-213`)
- **Observation**: When the as-filed petition letter is fused for grounding (G1.2), each section's body is hard-cut at 800 chars with an ellipsis: `s.body.slice(0, FILED_SECTION_CHARS)`. 800 chars is roughly 120-150 words — a real O-1A petition section (e.g. the "Critical role" or "Original contributions" argument) is routinely much longer, so the model responding to an RFE about that section sees only its opening and the substantive evidence the RFE is challenging may fall AFTER the cut. There is no comment explaining where 800 came from (token budget? a guess?), no per-criterion prioritization, and no signal to the user/model that the context was truncated.
- **Proposal**: Document the constant's intent (prompt-budget cap) next to the number; if it's a token-budget concern, prefer trimming least-relevant sections rather than truncating each uniformly, or prioritize the section(s) the RFE actually names. At minimum keep the existing ellipsis but add a brief note in the prompt that long sections were trimmed, so a fabricated-specifics adjudication isn't confused by half-sentences.
- **Value / Risk-if-ignored**: A truncation tuned by an unexplained magic number can drop the very evidence the RFE response must cite, weakening a legal filing in a way no one can later reconstruct or justify. Cheap to document; a real correctness risk if left opaque.
- **Effort**: S
