# Code Refactor — Fix Wave 10 — event-bus + data-adapter + evidence-vault tail

> 5 commits, 5 findings closed (1 high-ish removal + mix of M/L). Baseline preserved:
> tsc 0→0; tests 284→283 pass / 0 fail (−1 = removed isOk test); `next build` PASSES;
> lint clean.

## Commits

| # | Commit | Finding | Severity | Kind |
|---|---|---|---|---|
| 1 | `(isOk)` | data-adapter #4 | M | dead-code removal |
| 2 | `(ErrorEnvelope)` | data-adapter #5 | L | doc fix |
| 3 | `(StoredDocument)` | evidence-vault #4 | L | shared type |
| 4 | `(events honesty)` | event-bus #2, #3 | M/M | honesty/doc |

## What was fixed

1. **Removed `isOk`** — the `AdapterResult` type guard had zero production callers (every consumer narrows on `.ok` directly); removed it + its 2 test assertions. `ok()`/`err()` stay.
2. **Corrected the `ErrorEnvelope` doc comment** — it claimed client fetch wrappers type a failed adapter response, but none import it (it's consumed only by `adapterErrorBody`/`toErrorResponse` + the test). Reworded to "exported for testability"; export kept.
3. **Single-sourced `StoredDocument`** — the vault-document shape was declared twice (server-only `lib/data/evidence` `StoredDocument` + client `EvidenceVault` `DocumentView`). Moved to a server-free `@/features/evidence/types.ts`; the data layer imports + re-exports it (adapter import unchanged) and `EvidenceVault` aliases `DocumentView = StoredDocument` (CaseDetailView import unchanged). The `server-only` boundary stays on the accessors.
4. **Event-bus honesty (no structural change — the seams are intentional):**
   - **#2** — `getDomainBus()` registers audit + attorney-notify with LOG-ONLY default sinks (`console.info`); the "immutable audit trail" + attorney notifications are stdout lines today, not durable/delivered. Commented so a reviewer doesn't assume durability on a compliance path, with the wire-a-real-sink pointer. Also dropped the stale "analytics" subscriber from the module docstring (analytics was removed in Wave 7).
   - **#3** — the `bus` singleton has no reset export and needs none (tests construct their own `EventBus` + use `clear()`); commented as process-lifetime.

## Intentionally left

- **event-bus #4 (L, injectable `Clock`)** — the report explicitly recommends **no action**: it's a legitimate, low-cost test seam (parallel to rate-limit's `now`/`store`). Left.

## Verification

| Gate | After Wave 9 | After Wave 10 |
|---|---|---|
| `tsc --noEmit` errors | 0 | 0 |
| tests pass / fail | 284 / 0 | 283 / 0 |
| `next build` | PASS | PASS |
| lint (touched files) | clean | clean |

## Cumulative status

~62 of 88 findings closed across 10 waves + 3 follow-ups; CRITICAL closed; 1 FP rejected. Branch `refactor/code-refactor-2026-06-14`, off `main`, not pushed.

## Remaining tail (M/L; none blocking)

- **FAQ answer content** — flagged for the user (service-scope/legal claims).
- Per-context items not yet taken: criteria-table merge (case-file #2, god-component risk), `createPersistentValue` (case-file #3, contract mismatch), SiteHeader/Footer dedup (marketing #2, drifted nav), RfeStudio paywall JSX (rfe #5), llm-engine #3/#4, token-economy #2/#3/#4, validation #5, attorney-review #2/#4, consent profile-overlap (#2 done) leftovers.
- Intentionally kept: addReviewNote double-resolve (L), ai-orchestrator #3 type-mirroring, validation #4 `provisional`, consent #3 `email` prop, rate-limiting #4 `windowMs`, event-bus #4 `Clock`.
