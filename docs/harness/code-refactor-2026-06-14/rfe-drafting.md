# Code Refactor Scan — RFE Response Drafting

> Total: 5 (C0 / H2 / M2 / L1)

## 1. RFE route bypasses the PetitionAdapter the draft route was migrated to (ADR-0010)
- **Severity**: high
- **Category**: duplication
- **File**: src/app/api/rfe/route.ts:16,89-124,169-180
- **Scenario**: `/api/draft` was migrated to the `petitions` PetitionAdapter (`@/lib/data/adapters/petition`), which returns typed `AdapterResult`s, gates every case-scoped call through `resolveCase` first, and maps store faults via `toErrorResponse`. `/api/rfe` was left on the OLD pattern: it imports `getCriteriaForCase` + `saveRfeResponse` directly from `@/lib/data/petitions` and hand-rolls a try/catch + `console.error` + manual `503`/`saveFailed` mapping for each call.
- **Root cause**: The adapter migration (ADR-0010) covered drafting but never finished the twin RFE route, even though the adapter ALREADY exposes the exact methods RFE needs: `petitions.getCriteria(access, caseId)` (petition.ts:139) and `petitions.saveRfeResponse(access, caseId, rfeText, sections, source)` (petition.ts:187). Both are unused by any route today (grep: only `petition.test.ts` calls `saveRfeResponse`).
- **Impact**: Two divergent data-access conventions for sibling routes; the RFE route re-implements error-shaping the adapter already standardizes, and its `getCriteriaForCase(auth.case.id)` runs UNGATED at the data layer (it leans entirely on `authorizeRoute` for access) whereas the adapter gates `resolveCase` first — a defense-in-depth gap and a maintenance hazard if the two access paths ever drift.
- **Verification**: Read both routes; `petition.ts` confirms `getCriteria`/`saveRfeResponse` adapter methods exist and are wired in `defaultDeps` (lines 72,75). Grep `saveRfeResponse`/`getLatestRfeResponse` across `src/`: the adapter methods have zero non-test callers; the route uses the raw data-fns instead. The draft route (`route.ts:119,221,282`) is the reference adapter usage.
- **Fix sketch**: Switch `/api/rfe` to the adapter exactly like `/api/draft`: build `access: CaseAccess = { userId, email }` (RFE honors the configured-attorney path, so pass the email), replace `getCriteriaForCase` with `petitions.getCriteria(access, caseId)` + `toErrorResponse(result.error)`, and replace the `saveRfeResponse` try/catch with `petitions.saveRfeResponse(...)` mapping `!ok` → `saveFailed`. Drops ~25 lines of bespoke error handling.

## 2. `toSection` is duplicated byte-for-byte across three files
- **Severity**: high
- **Category**: duplication
- **File**: src/features/rfe/rfe.ts:152-159
- **Scenario**: The `toSection(value): DraftSection | null` validator (object guard + trimmed heading/body + drop-if-empty) is copied identically into `src/features/rfe/rfe.ts:152`, `src/features/drafting/drafting.ts:194`, and `src/features/drafting/saveRecovery.ts:61`. The surrounding `tryParse*Response` `sections`-array extraction loop (`extractJson` → check `.sections` is an array → `.map(toSection).filter(...)` → return only if non-empty) is also identical between rfe.ts:167-177 and drafting.ts:209-219.
- **Root cause**: When RFE was cloned from drafting, the section-shape parsing was copied rather than extracted, even though `extractJson` (`@/lib/llm/json`) was already factored out as the shared tolerant-parse primitive for exactly these features (its doc comment names "qualification, drafting, rfe, evidence").
- **Impact**: Three copies of the same validation; a fix to section normalization (e.g. trimming, max-length, a new field) must be made in three places or they silently diverge. This is the canonical shared-helper candidate the feature's "mirror of drafting" design invites.
- **Verification**: `grep -rln "function toSection"` → exactly those three files; `sed` diff of the rfe and drafting bodies shows them identical. `extractJson` confirmed as the existing shared seam in `src/lib/llm/json.ts`.
- **Fix sketch**: Add `toSection(value): DraftSection | null` and a `tryParseSections(text): DraftSection[] | null` helper next to `extractJson` in `@/lib/llm/json` (or a small `@/lib/llm/sections` module, since `DraftSection` lives in drafting). Have rfe.ts, drafting.ts, and saveRecovery.ts import it. Note `DraftSection`'s home is `@/features/drafting`; resolve the type-ownership before moving to avoid a feature→lib import cycle.

## 3. `parseRfeResponse` and the `RfeSection` re-export are test-only exported surface
- **Severity**: medium
- **Category**: dead-code
- **File**: src/features/rfe/rfe.ts:24,180-182
- **Scenario**: `parseRfeResponse(text, req)` is exported (and re-exported in `index.ts:7`) but the route never calls it — the route uses `tryParseRfeResponse` directly so it can `reclaim()` the token on a fallback. `parseRfeResponse` is referenced ONLY in `rfe.test.ts`. Likewise `export type { DraftSection as RfeSection }` (rfe.ts:24, re-exported index.ts:13) has no consumer anywhere.
- **Root cause**: Both were mirrored from drafting's public surface (`parseDraftResponse` IS used as drafting's documented combine-and-fallback helper). In RFE the combined helper is redundant with `tryParseRfeResponse(...) ?? mockRfe(req)`, which the route already inlines.
- **Impact**: Exported API that exists only to be tested — readers assume it's load-bearing. Minor surface bloat; low breaking-change risk since nothing external depends on it.
- **Verification**: `grep -rn "parseRfeResponse\b"` → only `rfe.ts`, `index.ts`, `rfe.test.ts`. `grep -rn "RfeSection"` → only the definition + the `index.ts` re-export; zero importers. (Contrast: `RfeStudio`, `tryParseRfeResponse`, `buildRfePrompt` are all genuinely used.)
- **Fix sketch**: Either delete `parseRfeResponse` and have its one test assert `tryParseRfeResponse(...) ?? mockRfe(req)`, or keep it but stop exporting (make module-private) and drop the `index.ts` line. Remove the unused `RfeSection` re-export from rfe.ts:24 and index.ts:13.

## 4. `str()` validation helper duplicated between rfe.ts and drafting.ts
- **Severity**: medium
- **Category**: duplication
- **File**: src/features/rfe/rfe.ts:56-58
- **Scenario**: `function str(value, max) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }` is identical in rfe.ts:56 and drafting.ts:71. The two `parse*Request` functions and `criteriaLines` (rfe.ts:101-108 vs drafting.ts:120-126 — the latter identical apart from the empty-criteria guard) are near-clones built on top of it, normalizing the same `{ name, status, evidence, rationale }` criterion shape with the same `MAX_*` caps.
- **Root cause**: RFE's request validation was cloned from drafting; the shared primitive (`str`) and the shared criterion-line formatter were copied rather than imported.
- **Impact**: Two copies of input-normalization for the same untrusted criterion shape; caps/trimming can drift between the two paid endpoints. Lower value than #1/#2 because the request *shapes* legitimately differ (RFE adds `rfeText`, different required-field rules), so only the leaf helpers are truly shareable.
- **Verification**: Direct read of both files; `str` bodies are byte-identical, `criteriaLines` differ only by drafting omitting the "(no criteria provided)" empty branch. `MAX_PETITIONER`/`MAX_TEXT`/`MAX_CRITERIA` constants match.
- **Fix sketch**: Extract `str(value, max)` and `criterionLine(c)` into a small shared module (e.g. `@/features/drafting/shared` or `@/lib/llm/sections`); keep the two `parse*Request` shells per-feature since their required-field rules differ. Do NOT over-merge the request parsers — the shapes genuinely diverge.

## 5. RfeStudio re-implements DraftStudio's paywall / "done" / placeholder JSX inline
- **Severity**: low
- **Category**: duplication
- **File**: src/features/rfe/components/RfeStudio.tsx:159-246
- **Scenario**: The loading skeletons, the `paywall` "Buy more → /billing" card, the `DisclaimerStamp` + `CitationNote` + "Placeholder output…" notice, the per-section editable `textarea` block, and the `busyRef` double-submit guard are all near-verbatim copies of `DraftStudio.tsx` (the paywall block, placeholder notice, and busyRef comment are effectively identical). DraftStudio has since extracted `SaveFailedAlert` + `saveRecovery` helpers; RfeStudio still inlines a simpler hand-rolled `saveFailed` banner and has no copy/retry recovery.
- **Root cause**: RfeStudio was cloned from an earlier DraftStudio and never re-synced after DraftStudio's save-recovery refactor.
- **Impact**: UI drift between the two studios (RFE lacks the copy/retry-on-save-failure affordance) and duplicated paywall/placeholder markup. Low severity: shared extraction of styled JSX is higher-risk/lower-reward than the logic dedup above, and the two studios have real layout differences (RFE textarea-first, no per-section regenerate).
- **Verification**: Side-by-side read of both components; paywall `<Link href="/billing">`, placeholder-notice block, and the `busyRef` guard + comment match. `SaveFailedAlert`/`saveRecovery` confirmed imported by DraftStudio only (grep).
- **Fix sketch**: Extract the shared leaf pieces both studios use — a `PaywallCard`, the `PlaceholderNotice`, and the disclaimer/citation header — into `@/features/guidance/components` (where `DisclaimerStamp`/`CitationNote` already live). Optionally adopt `SaveFailedAlert`/`saveRecovery` in RfeStudio for parity. Leave the surrounding layout per-studio.
