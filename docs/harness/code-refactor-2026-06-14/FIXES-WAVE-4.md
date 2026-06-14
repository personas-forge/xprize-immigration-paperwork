# Code Refactor — Fix Wave 4 — Adapter migration completion (ADR-0010)

> 5 commits, 7 findings closed (incl. 3 cross-report pairs). Auth-sensitive wave.
> Baseline preserved: tsc 0→0; tests 283→281 pass / 0 fail (−2 = the dropped
> getOwnedCases tests); lint clean; **`next build` PASSES** (all 24 routes compile,
> route/SSR boundaries validated — the gate for auth-route changes).

## Commits

| # | Commit | Finding closed | Severity | Risk |
|---|---|---|---|---|
| 1 | `0a703c8` | rfe #1 ≡ petition #3 | H | 🟠 money/auth route |
| 2 | `f0a2fdb` | data-adapter #2 ≡ auth-session #1 | H | 🔴 cross-tenant PII gate |
| 3 | `a44d166` | evidence-vault #2 | H | 🟠 vault write gate |
| 4 | `44fd9fc` | data-adapter #1 (createCase) | H | 🟡 charged route persist |
| 5 | `07f7258` | data-adapter #3 | M | 🟢 drop unused method |

`data-adapter.md #1` (the five unwired adapter methods) is **fully resolved** across fixes 1/3/4: the three write methods (`saveRfeResponse`, `addDocument`, `createCase`) now have production callers. The two read getters (`getDocuments`, `getLatestRfeResponse`) remain as the adapter's symmetric read API — read raw at the already-gated case-detail page by design (see Fix 2).

## What was fixed

1. **`/api/rfe` → PetitionAdapter.** The last charged route on the pre-adapter pattern: it read criteria UNGATED at the data layer and hand-rolled try/catch + 503 for read and write. Now mirrors `/api/draft`: `petitions.getCriteria(access, id)` + `petitions.saveRfeResponse(access, …)` with `toErrorResponse`. `access` carries `email` (RFE honors the attorney-of-record leg), so `resolveCase` re-validates owner-or-attorney before each call — defense-in-depth closing the ungated read.
2. **`cases/[id]/page.tsx` gate → `resolveCase`.** The last inline copy of the owner-or-attorney gate — and the highest-risk one (cross-tenant PII read). Now `petitions.resolveCase`; forbidden/not_found → `notFound()` (no existence leak), store faults → the dashboard error boundary (not masked as 404). `isOwner` from a second owner-only resolve, mirroring `review/actions.ts`. The four post-gate reads stay raw by design (the case is already authorized — re-gating each would be redundant).
3. **categorize persist → `EvidenceAdapter.addDocument`.** The vault's WRITE path gated via raw `addCaseDocument` + the route-level `authorizeRoute` while remove/refile gated via the adapter — two gate paths for one vault. Now the add path gates through the same `resolveCase` seam. Persistence stays best-effort (any adapter error → no document, never a hard error); `requiresAttorney` unchanged.
4. **qualify persist → `petitions.createCase`.** The orchestrated qualify route's `persist` hook called `createCaseWithCriteria` raw; now uses `createCase` (owns userId/store checks, wraps in `store_error`). Best-effort preserved. `email: null` — createCase creates a new owned case and gates on userId only.
5. **Dropped unused `getOwnedCases`.** Zero callers, won't gain one (both list-cases sites list the caller's own cases — no gate — and `saved-cases.ts` is the data layer the adapter wraps). Removed the method, its orphaned `getCasesForUser` dep, and 2 tests.

## Security posture (the point of this wave)

Every case-scoped read/write now routes through the single fail-closed `resolveCase` gate — there is **no remaining inline copy** of the `getCaseForUser(...) ?? (attorney ? getCaseAnyOwner(...) : null)` expression outside `access.ts`. A future edit to the access rule changes one file. **No gate was weakened**: every migration re-validates owner-or-configured-attorney (never the permissive `isAttorney`), and `requiresAttorney` policy per route is unchanged. Behavior is preserved for all happy paths; error mapping is now uniform (typed `AdapterError` → HTTP).

## Verification

| Gate | After Wave 3 | After Wave 4 |
|---|---|---|
| `tsc --noEmit` errors | 0 | 0 |
| tests pass / fail | 283 / 0 | 281 / 0 |
| `next build` | — | PASS (24 routes) |
| lint (touched files) | clean | clean |

## Cumulative status (waves 1–4)

| Wave | Theme | Findings closed | Commits |
|---|---|---:|---:|
| 1 | Dead-code deletion | 7 | 7 |
| 2 | Disclaimer / UPL single source of truth | 6 | 5 |
| 3 | LLM parse/coercion consolidation | 6 | 3 |
| 4 | Adapter migration (ADR-0010) | 7 | 5 |

**26 of 88 findings closed; 1 false positive rejected; 1 Low intentionally kept** (`addReviewNote` double-resolve — its owner-only resolve genuinely serves the `authorRole` label; refactoring it risks the role attribution for no security gain, and the scan flagged it optional). Pattern catalogue: 9 items.

## Pattern established (catalogue item 9)

9. **Gate once at the page, re-gate per-op at the route.** A server component that loads many fields for one case should gate ONCE (an explicit `resolveCase`) then read raw — re-routing each read through the adapter would re-run the same owner-or-attorney check N times. A route doing a SINGLE case operation routes that op through the adapter (which gates). Match the gating granularity to the access pattern; "everything through the adapter" is not free when a page reads 4+ things.

## What remains

26 → ~55 distinct issues open. Next per the INDEX: **Wave 5 — orchestrator adoption (ADR-0004, 🔴 money-path)** — migrate `draft`/`rfe`/`categorize` onto `executeAiOperation` (the lone critical; only 2/6 routes adopted) and fix the `draft/save` 429 that drops the DISCLAIMER. Then Wave 6 (UI chrome dedup) and Wave 7 (money-path + engine-mirror + misc, incl. the deferred guidance #3 `GuidanceResponse`→`Result<T>`).

Note: Wave 4 wired `/api/rfe` onto the PetitionAdapter but NOT yet onto `executeAiOperation` — the orchestrator migration (Wave 5) is the complementary half (rfe still hand-rolls the rate-limit/charge/reclaim preamble). The two ADRs are orthogonal layers.
