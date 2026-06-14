# Code Refactor — Fix Wave 5 — Orchestrator adoption (ADR-0004)

> 4 commits. Closes the lone CRITICAL's bulk + 3 high/med findings. Money-path wave.
> Baseline preserved: tsc 0→0; tests 281→281 pass / 0 fail; **`next build` PASSES**;
> lint clean. The risky money-path logic now lives in the unit-tested orchestrator,
> not in hand-rolled per-route copies.

## Commits

| # | Commit | Finding(s) | Severity | Risk |
|---|---|---|---|---|
| 1 | `1bbfb2f` | ai-orchestrator #3 (partial) | M | 🟢 additive type/arg |
| 2 | `(draft-save)` | ai-orchestrator #2 | H | 🟢 add disclaimer field |
| 3 | `(categorize)` | evidence-vault #1; ai-orchestrator #1; rate-limiting #1 | C/H | 🟡 charged route |
| 4 | `(rfe)` | rate-limiting #1; ai-orchestrator #1 | C/H | 🟠 charged + auth-gate |

## What was fixed

1. **Completed the orchestrator hooks** so the case-persisting charged routes could adopt it without losing behavior: `AuthUser` gains optional `email` (drives the configured-attorney access leg in a gated `persist`), and `persist` receives the resolved `source` ("mock" | engine name) as a 4th arg (so it records provenance). Both backward-compatible — existing 3-arg `persist` (qualify) is unaffected. Added a test asserting `persist` receives `source`.
2. **`draft/save` 429 now carries the `DISCLAIMER`** — it was the one rate-limit response that dropped it. The 429 envelope is now uniform across every rate-limited AI-adjacent route.
3. **categorize → `executeAiOperation`.** Removed the hand-rolled rate-limit/charge/reclaim preamble + the `authorizeRoute` body-clone; the orchestrator owns the money path. caseId comes from the parsed body; persistence gates owner-or-attorney through the EvidenceAdapter (best-effort, source recorded). Behavior-preserving (IP-keyed limit, same 401/402/429 shapes).
4. **rfe → `executeAiOperation`.** The owner-or-attorney gate moved into `spec.parse`, faithfully replicating `authorizeRoute`'s decisions (caseId+no-user → 401, caseId+no-access → 403, store fault → typed status, inline/demo path validates the payload). The Wave-4 adapter data calls (`getCriteria`/`saveRfeResponse`) are retained; the money path moves to the orchestrator. Behavior-preserving (user-keyed limit, same shapes, same `saveFailed` surfacing).

## Why this REDUCES money-path risk

The charge-then-reclaim, disclaimer-on-402/429, and best-effort-persist invariants were duplicated across draft/rfe/categorize (the scan's critical). Each migration **removes** a hand-rolled copy and delegates to the **unit-tested** `executeAiOperation` (13 tests covering reclaim-on-throw, reclaim-on-unusable-output, no-reclaim-on-keyless-mock, 402/429 disclaimer, persist best-effort). A per-route spec only describes parse/prompt/guard/mock/build/persist — it cannot get the money path wrong. So consolidating here is *safer* than leaving the drift-prone copies.

## Orchestrator adoption: 2/5 → 4/5 charged routes

| Route | Before | After |
|---|---|---|
| guidance | ✅ | ✅ |
| qualify | ✅ | ✅ |
| **categorize** | ❌ hand-rolled | ✅ migrated |
| **rfe** | ❌ hand-rolled | ✅ migrated |
| draft | ❌ hand-rolled | ⏸️ deferred (see below) |

## Deferred: the draft route (documented, not skipped)

`/api/draft` has a **two-path shape** the single declarative pipeline doesn't fit cleanly: a full-letter path (generate → save a new draft version) AND a single-section regenerate path (`focus`) that generates one section, **loads the latest stored draft, merges by heading, and saves a new version** — with its own `saveFailed` / "no base draft to merge into" cases. Modeling this needs a discriminated-union `TOutput` + branching guard/mock/build/persist, and it's the most intricate money + multi-version-persistence route. Migrating it **without route-level tests** is imprudent. Left hand-rolled with this rationale; it's the last orchestrator holdout. (`/api/draft/save` legitimately can't adopt — it never charges or calls a model.)

## Verification

| Gate | After Wave 4 | After Wave 5 |
|---|---|---|
| `tsc --noEmit` errors | 0 | 0 |
| tests pass / fail | 281 / 0 | 281 / 0 |
| `next build` | PASS | PASS |
| lint (touched files) | clean | clean |

## Cumulative status (waves 1–5)

| Wave | Theme | Findings closed | Commits |
|---|---|---:|---:|
| 1 | Dead-code deletion | 7 | 7 |
| 2 | Disclaimer / UPL single source of truth | 6 | 5 |
| 3 | LLM parse/coercion consolidation | 6 | 3 |
| 4 | Adapter migration (ADR-0010) | 7 | 5 |
| 5 | Orchestrator adoption (ADR-0004) | 3 + critical substantially addressed | 4 |

**29 of 88 findings closed; the lone CRITICAL substantially addressed (4/5 routes); 1 FP rejected; 2 Low intentionally kept.** Pattern catalogue: 10 items.

## Pattern established (catalogue item 10)

10. **Migrating money-path code onto a tested orchestrator REDUCES risk; the per-route spec only owns the safe parts.** When a charged route hand-rolls charge/reclaim/disclaimer, moving it onto a well-tested orchestrator is safer than leaving the copy — the high-risk invariants become un-get-wrong-able, and the route's remaining surface (parse/guard/persist) has access-control failure modes (testable by reasoning), not money failure modes. But know the orchestrator's shape limits: a two-path route (draft) with branching output + read-merge-save persistence doesn't fit a single declarative pipeline — defer it rather than force a fragile discriminated-union spec without route tests.

## What remains

29 → ~52 distinct issues open. Next per the INDEX: **Wave 6 — UI chrome de-duplication** (triplicated `ThemeToggle`/`BalancePill` across the 3 dashboard views; `SiteHeader`/`SiteFooter` across 5 marketing routes; the criteria-table dup). Then **Wave 7 — money-path + engine-mirror + misc** (checkout `tokens` metadata + refund symmetry, the drifted eval-harness engine mirror, the deferred guidance #3 `GuidanceResponse`→`Result<T>`, and the small leftovers: ai-orchestrator #4 docstring, rate-limiting #4 `windowMs`). The draft-route orchestrator migration is best done as its own change with route-test coverage.
