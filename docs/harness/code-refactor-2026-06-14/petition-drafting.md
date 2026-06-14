# Code Refactor Scan — Petition Letter Drafting Studio

> Total: 5 (C0 / H3 / M1 / L1)

## 1. `toSection` JSON-section coercer is copy-pasted in three files
- **Severity**: high
- **Category**: duplication
- **File**: src/features/drafting/drafting.ts:194; src/features/rfe/rfe.ts:152; src/features/drafting/saveRecovery.ts:61
- **Scenario**: The same `toSection(value: unknown): DraftSection | null` — trim heading/body, reject either-empty — is the load-bearing guard that decides whether a model payload (or a rescue-save body) yields a usable section. It is duplicated verbatim (byte-for-byte modulo whitespace) in three modules across two features.
- **Root cause**: When `rfe.ts` was cloned from `drafting.ts` and `saveRecovery.ts` was added for the rescue endpoint, each got its own private copy instead of importing one helper. All three already depend on the same `DraftSection` type from `drafting.ts`.
- **Impact**: This is the citation/validity gate for paid work product. A future hardening (e.g. cap body length, strip control chars, reject prompt-injection markers) must be applied in three places or the three drafting surfaces silently diverge — the exact "permanently mislabeling the case history" failure the code comments warn about, but split across files.
- **Verification**: Read all three definitions; they are identical. `DraftSection` is exported from `drafting.ts` and already imported by `rfe.ts` (line 19) and `saveRecovery.ts` (line 15). Grepped `toSection` repo-wide — only these three private copies, no shared util exists yet.
- **Fix sketch**: Export `toSection` (or a `parseSectionShape`) from `drafting.ts` once; import it in `rfe.ts` and `saveRecovery.ts`. Pure, no behavior change; covered by all three existing test suites.

## 2. `parseDraftResponse` / `parseSectionResponse` / `parseRfeResponse` are exported-but-test-only (mock-fallback variants superseded by `tryParse*`)
- **Severity**: high
- **Category**: dead-code
- **File**: src/features/drafting/drafting.ts:231-242; src/features/rfe/rfe.ts:180
- **Scenario**: `parseDraftResponse`, `parseSectionResponse`, and `parseRfeResponse` each wrap the strict `tryParse*` parser with a `?? mockDraft/mockSection/mockRfe` fallback. Both routes were reworked to call the strict `tryParse*` variants directly so they can reclaim the token and label the result `"mock"` honestly; the auto-fallback wrappers no longer fit that flow and are called only from their own `.test.ts` files.
- **Root cause**: The "reclaim the charge on unusable output" design (see drafting route lines 191-195, 264-269; rfe route lines 157-162) moved the fallback decision into the route. The old combined parse-or-mock helpers were left exported through the barrels (`drafting/index.ts` lines 10,12; `rfe/index.ts` line 7) and kept alive only by tests asserting the dead behavior.
- **Impact**: ~30 lines of exported public API plus their tests describe a fallback path production no longer takes — a maintenance trap: a reader (or a future caller) may wire `parseDraftResponse` and reintroduce the "boilerplate billed and persisted as a model draft" bug the route comments explicitly call out.
- **Verification**: Grepped `parseDraftResponse|parseSectionResponse|parseRfeResponse` repo-wide. Production hits are only the definitions + barrel re-exports; every call site is in `drafting.test.ts` / `rfe.test.ts`. Routes confirmed to call `tryParseDraftResponse`/`tryParseSectionResponse`/`tryParseRfeResponse` (draft route lines 186, 261; rfe route line 153).
- **Fix sketch**: Delete the three wrappers, drop them from both barrels, and either remove or fold their tests into the `tryParse*` cases (the meaningful assertions — fence tolerance, malformed-section dropping — already exist for `tryParse*`).

## 3. `/api/rfe` bypasses the PetitionAdapter that `/api/draft` was migrated to (incomplete ADR-0010 migration)
- **Severity**: high
- **Category**: structure
- **File**: src/app/api/rfe/route.ts:16,96,175
- **Scenario**: `/api/draft` reads criteria and persists via the `petitions` adapter (`petitions.getCriteria`, `petitions.saveDraft`, `petitions.getLatestDraft`) — typed `AdapterResult`, gate-then-act, store faults mapped through `toErrorResponse`. `/api/rfe` still calls the raw module functions `getCriteriaForCase` / `saveRfeResponse` from `@/lib/data/petitions` wrapped in hand-rolled try/catch.
- **Root cause**: ADR-0010 introduced `PetitionAdapter` as "the single seam between routes and the petition domain" and migrated the draft route, but the twin rfe route was not converted. The adapter even exposes the exact methods rfe needs (`getCriteria`, `saveRfeResponse`, `getLatestRfeResponse`) at petition.ts lines 139-223.
- **Impact**: Two divergent data-access conventions for sibling endpoints. The rfe route re-implements store-fault handling (route lines 94-106) and re-derives the owner-only `CaseAccess` decision implicitly via `authorizeRoute`, instead of going through `resolveCase` like the adapter does — so the documented "single gate" invariant has a hole, and store-error → HTTP-status mapping is maintained twice and can drift.
- **Verification**: Read both routes and `petition.ts`. `/api/rfe` imports `getCriteriaForCase, saveRfeResponse` directly (line 16); `/api/draft` imports `petitions` adapter (line 22). Adapter exposes `getCriteria`/`saveRfeResponse`/`getLatestRfeResponse`. Note: behavior is currently equivalent for the happy path, so this is a structural/consistency fix, not a live bug — flagging migration completion, not a correctness break.
- **Fix sketch**: Switch `/api/rfe` to `petitions.getCriteria(access, caseId)` and `petitions.saveRfeResponse(...)`, returning `toErrorResponse` on `!ok`, mirroring `/api/draft`. Removes the bespoke try/catch and the second copy of store-fault mapping.

## 4. Request-handling preamble duplicated across the two/three drafting routes
- **Severity**: medium
- **Category**: duplication
- **File**: src/app/api/draft/route.ts:52-112; src/app/api/draft/save/route.ts:31-83; src/app/api/rfe/route.ts:36-82
- **Scenario**: All three routes open with the same skeleton: `authorizeRoute(request, { requiresCase: true, ... })` → identical `unauthenticated` 401 / `forbidden` 403 JSON blocks → `request.json()` with the same `Invalid JSON body.` 400 → `isRateLimitEnabled()` + `checkRateLimit(rateLimitKey(request, <bucket>, user?.id), RATE_LIMITS.<x>)` → identical `rate_limited` 429 with `Retry-After`. The draft + rfe routes additionally share the charge → reclaim-on-unusable-output → persist-with-`saveFailed` tail.
- **Root cause**: The save route and the rfe route were each authored by copying the draft route's top-of-handler boilerplate; only the error copy strings and bucket names differ.
- **Impact**: The 401/403 shapes, the rate-limit response shape, and the `Retry-After` header are maintained in triplicate. A change to the auth-failure contract or the rate-limit envelope must touch three handlers, and the `draft` vs `draft-save` vs `rfe` 429 bodies have already drifted slightly (draft/rfe include `disclaimer`, save does not).
- **Verification**: Read all three route files; preamble blocks are structurally identical save for literals. The drift (save-route 429 omits `disclaimer`) is visible at draft route line 108 vs save route line 75.
- **Fix sketch**: Extract a small helper (e.g. `guardDraftRoute(request, { bucket, limit, requiresAttorney? })`) returning either an early `NextResponse` or `{ auth, body, user }`. Keep the charge/persist logic in the routes (it differs enough). Lower priority than #1-#3 because the bodies genuinely differ in spots; consolidate the auth/ratelimit/json-parse triad first.

## 5. `str()` validator and `criteriaLines()` prompt builder duplicated between drafting and rfe
- **Severity**: low
- **Category**: duplication
- **File**: src/features/drafting/drafting.ts:71,120; src/features/rfe/rfe.ts:56,101
- **Scenario**: `str(value, max)` (typeof-string → trim → slice) is identical in both modules, and `criteriaLines(req)` produces the same `- name [status]: evidence — rationale` line format (rfe adds a `length === 0 → ["- (no criteria provided)"]` guard, otherwise the body is the same). Both also share the `MAX_PETITIONER`/`MAX_TEXT`/`MAX_CRITERIA` constants.
- **Root cause**: rfe.ts is a clone of drafting.ts; these low-level helpers were copied rather than shared, since both modules deliberately avoid coupling to the qualification module's richer types.
- **Impact**: Minor — input-sanitization and the criterion-rendering format (which the prompts depend on for citation discipline) live in two places. If the line format changes for one feature it can silently diverge from the other, weakening the "argue only from provided facts" contract asymmetrically.
- **Verification**: Read both modules. `str` is byte-identical. `criteriaLines` differs only by rfe's empty-array guard. Constants overlap (`MAX_PETITIONER`/`MAX_TEXT`/`MAX_CRITERIA` = 200/4000/32 in both).
- **Fix sketch**: Move `str`, the shared `MAX_*` constants, and a `criteriaLine(c)` formatter into a small shared module (e.g. `src/features/drafting/shared.ts` or under `@/lib/llm`). Each feature keeps its own `criteriaLines` wrapper for the empty-array nuance but calls the shared per-line formatter.
