# Fix Wave 10 — Backend reliability & observability (deferred-backlog)

> 4 commits, 9 findings closed (6 Medium, 3 Low).
> Baseline preserved: tsc 0 → 0, tests 402 → 405 pass (+3 new), lint clean, `next build` PASS.
> Mental model: *the backend stays honest under stress — no hung subscriber wedges
> a write, no failure goes uncounted, no silent free-pass, no metric mis-fires.*

## Commits

| # | Commit | Findings closed | Files |
|---|---|---|---|
| 1 | `923afcc` | event-bus #3 (M), #4 (M), #5 (L) | events/bus.ts (+test), index.ts, subscribers/audit-log.ts, attorney-notify.ts |
| 2 | `05c1fdd` | llm-engine #2 (M), #5 (M) | llm/client.ts |
| 3 | `2327860` | ai-operation #4 (M), token #5 (L), data-adapter #5 (L) | ai/operation.ts, tokens/ledger.ts, adapters/evidence.ts |
| 4 | `91e8689` | eval #5 (M) | llm/adjudication-gates.ts (+test) |

## What was fixed

1. **Hung subscriber stalled a committed write (event-bus #4, M).** `publish`
   awaited every subscriber with no timeout. Added a per-handler timeout
   (`handlerTimeoutMs`, default 5s): a handler that doesn't settle is reported via
   `onError` and `publish` stops waiting. Test proves publish resolves despite a
   never-settling handler.
2. **Lost attorney nudge was invisible (event-bus #5, L).** A failed notify on a
   deadline-relevant milestone is now logged DISTINCTLY ("NOT DELIVERED — case …")
   instead of the bus's generic handler-failed line.
3. **Dormant audit subscriber read as live (event-bus #3, M).** Documented that
   provenance is the sole LIVE audit projection; `registerAuditLog` is the seam to
   wire only with a durable sink (its default would double-log).
4. **Gemini errors uncounted (llm-engine #2, M).** The Gemini wrapper had no
   try/catch (the Claude path does), so a safety-block / empty-candidates throw
   emitted NO telemetry → under-counted errors. Now emits error telemetry on
   throw.
5. **Empty output counted as success (llm-engine #5, M).** Both engine wrappers
   mark blank output `status:"error"` so a non-result isn't a successful
   generation (control flow unchanged — the route guard still mocks).
6. **Billing wrapper masked the model (ai-operation #4, M).** A throw from the
   telemetry wrapper was caught as a model failure → mock. The billing call now
   fails OPEN: retries the model UNGAUGED on a wrapper throw; a real model failure
   still rethrows → reclaim + mock.
7. **Silent metering free-pass (token #5, L).** `charge` now logs "metering
   unavailable… UNMETERED" when `isStoreConfigured()` is true but the store is
   absent (an init flap opening the paywall for everyone).
8. **Weak gate type (data-adapter #5, L).** `EvidenceAdapter.gate()` →
   `AdapterResult<StoredCase>` (was `<unknown>`).
9. **Sentence gate mis-fired on abbreviations (eval #5, M).** `sentenceCount`
   masks the periods inside abbreviations / citations / list markers before
   splitting, so "U.S.", "C.F.R.", "e.g." don't inflate the count. (Redo of the
   campaign-reverted fix — uses simpler regexes, verified NUL-free.)

## Verification

| Gate | Before | After |
|---|---|---|
| tsc --noEmit | 0 | 0 |
| npm test | 402 pass | 405 pass (+3) |
| eslint (changed) | — | clean |
| next build | PASS | PASS (46/46 pages) |

## Patterns established (catalogue items 27-28)

27. **A side-effect on the write's critical path needs a timeout and must fail
    open.** Awaiting a subscriber / telemetry wrapper with no bound turns an
    observability hiccup into a stuck user-facing mutation.
28. **A non-result must not be telemetry "success."** An error throw, empty
    output, or no-op should be counted distinctly, or failure-rate / margin
    dashboards silently lie.

## Remaining backlog

W11 (money/rate-limit tail), W13 (a11y polish), W14 (content/component drift).
Wave 12 descoped. No criticals; no Highs.
