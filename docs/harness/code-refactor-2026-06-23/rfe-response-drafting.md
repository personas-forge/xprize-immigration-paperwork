# Code Refactor — RFE Response Drafting
> Total: 5 (C0/H2/M2/L1)

## 1. `attachRfeExhibits` is a byte-for-byte clone of drafting's `attachExhibits`
- **Severity**: High
- **Category**: duplication
- **File**: src/features/rfe/rfe.ts:125-145 (clone of src/features/drafting/drafting.ts:564-586)
- **Scenario**: `attachRfeExhibits` and `attachExhibits` have identical bodies — same `Map<string, DraftExhibit[]>` grouped by `d.criterion`, same `exhibitNumber(...) === null` skip, same `byCriterion.size === 0` early-return, same per-criterion `[...ex].sort((a,b) => a.number - b.number)`. The ONLY difference is the parameter/return type annotation (`RfeRequest` vs `DraftRequest`). Grep `attachRfeExhibits|attachExhibits` across src/ shows the RFE feature ALREADY reuses the shared `attachExhibits` in its own UI — `RfeStudio.tsx:89` calls `attachExhibits` directly — so the function is demonstrably generic enough for the RFE shape; only `route.ts:102` and rfe.ts re-route through the clone.
- **Root cause**: When moonshot #21 added exhibit binding to RFE, the existing `attachExhibits` (already exported from drafting and structurally generic — it touches only `.criteria[].name` and the doc list) was copied and re-typed instead of reused. The grounding note confirms the *shared* helpers (auditCitations/buildExhibitIndex/attachExhibits + ExhibitIndex) are imported BY DESIGN; this finding is the opposite — a hand-rolled reimplementation that diverges from that pattern.
- **Impact**: Two copies of the citation-grouping logic must be hardened in lockstep. A future fix to one (e.g. case-insensitive criterion matching, dedup of repeated exhibit numbers, a cap) silently diverges the RFE and draft citation trails — exactly the "divergence bug" the helper-sharing was meant to prevent. ~21 LOC + a duplicate test block (rfe.test.ts:195-215 mirrors drafting.test.ts:294-315).
- **Fix sketch**: Make `attachExhibits` generic over the request shape — `attachExhibits<T extends { criteria: C[] }, C extends { name: string; exhibits?: ... }>(req, docs): T` — or simply call it from the RFE route/rfe.ts via a thin re-export (`export const attachRfeExhibits = attachExhibits` typed to RfeRequest). Delete the rfe.ts body; keep the RFE test as a thin smoke check.

## 2. `isAddressable` and `isRelied` are two names for the same predicate
- **Severity**: High
- **Category**: duplication
- **File**: src/features/rfe/rfe.ts:71-73 (`isAddressable`) and rfe.ts:330-332 (`isRelied`)
- **Scenario**: Both functions are `return status === "Met" || status === "Strong" || status === "Partial";` — character-for-character identical. Grep `isRelied|isAddressable` confirms `isAddressable` is private (used only by `mockRfe` at rfe.ts:254) while `isRelied` is exported and used by `mockRfeForecast` (rfe.ts:419), `hasReliedCriteria` (rfe.ts:338), `RfeStudio.tsx:115`, and `index.ts`. Their own doc comments even describe the SAME intent ("Partial is included; only None is excluded" vs "RFE targets these; None is not argued").
- **Root cause**: The responder path (`isAddressable`) and the later-added forecast path (`isRelied`, moonshot #20) each grew their own status predicate independently rather than sharing one.
- **Impact**: The "which statuses does an RFE argue?" rule lives in two places. If the business rule changes (e.g. exclude Partial, or add a new status), one copy gets missed and the responder's `mockRfe` sections diverge from the forecast's radar — the responder would address a criterion the forecast no longer flags, or vice versa. Misleading: a reader sees two distinct names and assumes two distinct rules.
- **Fix sketch**: Delete `isAddressable`; point `mockRfe` at the already-exported `isRelied`. (Both predicates are semantically "criteria the petition relies on," so `isRelied` is the keeper name.) One predicate, one source of truth.

## 3. Criteria-normalization block triplicated across the RFE/draft parsers
- **Severity**: Medium
- **Category**: duplication
- **File**: src/features/rfe/rfe.ts:99-105, src/features/rfe/forecastOperation.ts:48-57, src/features/drafting/drafting.ts:125-134
- **Scenario**: The same untrusted-criteria normalizer — `.slice(0, MAX_CRITERIA).filter(object-guard).map({ name: str(c.name,120), status: str(c.status,20), evidence: str(c.evidence,MAX_TEXT), rationale: str(c.rationale,MAX_TEXT) }).filter(c => c.name !== "")` — appears verbatim in three files (grep of the 4-line `str(...)` projection returns all three). All three already import `str/MAX_PETITIONER/MAX_TEXT/MAX_CRITERIA` from the shared `@/features/drafting/criteria-text`, which is the obvious home for this too.
- **Root cause**: `parseRfeRequest`, the forecast's `parseCriteria`, and `parseDraftRequest` each inlined the same field-by-field coercion instead of factoring it into `criteria-text.ts` alongside the constants they already share.
- **Impact**: The trust-boundary caps for paid LLM input are defined in three places. A hardening change (new field, different cap, control-char strip) must be made three times or the paths drift — and these feed the prompt that gets billed, so drift is not cosmetic.
- **Fix sketch**: Add `export function parseCriteriaArray(value: unknown): {name;status;evidence;rationale}[]` to `criteria-text.ts`; call it from all three parsers. (Note: this is a cross-feature shared module, so it stays in the cleanliness lane — no behavior change.)

## 4. `{ name, status, evidence, rationale }` projection repeated 3× inside the RFE feature
- **Severity**: Medium
- **Category**: duplication
- **File**: src/features/rfe/components/RfeStudio.tsx:93-98 and :148-153, src/features/rfe/forecastOperation.ts:116-121
- **Scenario**: The plain criterion projection `criteria.map(c => ({ name: c.name, status: c.status, evidence: c.evidence, rationale: c.rationale }))` is written out three times (grep of the 4-line `c.name`/`c.status`/… literal). In RfeStudio it appears twice in the SAME component — once building the exhibit-index memo (lines 93-98) and again in the POST body (lines 148-153) — copying the identical RadarCriterion→RfeCriterion mapping.
- **Root cause**: No `pickCriterion`/`toRfeCriterion` helper; each call site re-spreads the four fields. RadarCriterion, RfeStudioCriterion, and RfeCriterion are structurally the same four fields, so the projection is pure boilerplate.
- **Impact**: Adding/renaming a criterion field (e.g. an `exhibit`/`id`) means hunting down every literal projection; a missed one silently drops the field from either the citation audit or the request body. Low-risk but noisy and easy to get out of sync within one file.
- **Fix sketch**: Extract `const toRfeCriterion = (c: RfeStudioCriterion): RfeCriterion => ({ name: c.name, status: c.status, evidence: c.evidence, rationale: c.rationale })` (or just pass the criteria through unchanged where the shapes already match) and reuse at all three sites.

## 5. RFE min-length threshold `20` hardcoded in the client, duplicating `MIN_RFE`
- **Severity**: Low
- **Category**: cleanup
- **File**: src/features/rfe/components/RfeStudio.tsx:129 vs src/features/rfe/rfe.ts:67
- **Scenario**: `rfe.ts` defines `const MIN_RFE = 20` and enforces it in `parseRfeRequest` (rfe.ts:88). `RfeStudio.tsx:129` independently hardcodes the same value: `if (rfeText.trim().length < 20)`. The two are an unlinked magic number — the client pre-flight check and the server's authoritative gate must agree by hand.
- **Root cause**: The client guard was written with a literal instead of importing the pure constant from the (intentionally pure, importable) rfe module.
- **Impact**: If the server's `MIN_RFE` changes, the client check goes stale — either rejecting text the server would accept (false negative, blocks a valid draft) or letting through text the server rejects (a wasted round-trip showing a generic 400). Cosmetic today, but a latent contract drift between two files.
- **Fix sketch**: Export `MIN_RFE` from rfe.ts (it is already a pure module, safe to import client-side) and reference it in RfeStudio's guard: `rfeText.trim().length < MIN_RFE`. Single source for the threshold.
