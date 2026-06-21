# Bug Hunter + UI Perfectionist — Fix Wave 7: Reliability / resource / observability

> 4 commits, 7 findings closed (3 High, 4 Medium).
> Baseline preserved: tsc 0 → 0, tests 395 → 399 pass (+4 new), lint clean, `next build` PASS.
> Mental model: *long-running correctness — bounded memory, ordered audit, robust
> parsing, no orphaned processes, honest error codes, no permanently-stale cache.*

## Commits

| # | Commit | Findings closed | Files |
|---|---|---|---|
| 1 | `baf4f0f` | domain-event-bus #1 (H), #2 (H) | events/provenance.ts (+test) |
| 2 | `d334283` | llm-engine #3 (M), #4 (M) | llm/json.ts (+test), llm/engines.ts |
| 3 | `7dd36f2` | data-adapter #2 (H) | adapters/evidence.ts |
| 4 | `abfd50e` | case-file #2 (M), ai-operation #3 (M) | case-file/caseFileData.ts, ai/operation.ts |

## What was fixed

1. **Provenance ledger grew unbounded (#1, H).** The hash-chained audit array was
   append-only with no cap — a long-running host OOMs on lifetime mutations.
   Bounded the in-memory window at `maxRecords` (10k); the running `head` hash is
   kept so the chain stays correct (full history → durable sink).
2. **Concurrent publishes misordered the tamper-evident ledger (#2, H).** Appends
   ran in event-loop order, so timestamps could interleave non-monotonically.
   Each record now carries a `seq` stamped at append (the true observed order) +
   an `atRegression` flag; both are metadata (not hashed) so verification is
   unchanged.
3. **extractJson locked onto the wrong fence (#3, M).** A non-JSON reasoning
   block before the real ```json``` fence made it return null → silent mock
   fallback. Now tries each fence containing `{` (then raw text) and each `{`
   start, returning the first parseable object.
4. **claude timeout orphaned the model process (#4, M).** Under `shell:true` the
   timeout killed the shell but left the `claude` grandchild running. Replaced
   with a managed timer that kills the whole TREE (`process.kill(-pid)` on the
   detached POSIX group; `taskkill /T` on Windows) + a single-settle guard.
5. **Inconsistent no-store error code (#2 adapter, H).** evidence mapped no-store
   to `store_error` (500) while petition used `unconfigured` (503). Unified to
   `unconfigured` for the no-store case (checks `storeConfigured()`); reserves
   `store_error` for a real throw.
6. **Permanently-stale case-file cache (#2 case-file, M).** A successful snapshot
   was pinned for the SPA session. Added a 30s TTL + `clearCaseFileDataCache(caseId?)`
   for explicit busting from mutations (documented as required post-DB-swap).
7. **Orchestrator deps contract undocumented (#3 ai, M).** Clarified that the
   cached deps bundle holds STABLE function references that re-read config per
   call (key rotation / telemetry toggle take effect without restart) — and never
   to cache an env-derived value there.

## Verification

| Gate | Before | After |
|---|---|---|
| tsc --noEmit | 0 | 0 |
| npm test | 395 pass | 399 pass (+4) |
| eslint (changed) | — | clean |
| next build | PASS | PASS (46/46 pages) |

## Patterns established (catalogue items 19-21)

19. **A process-lifetime singleton that only grows is a slow OOM.** Any
    append-only in-memory structure on a long-running host needs a cap / ring
    buffer / flush-then-drop — "it vanishes in serverless" is not a bound for the
    non-serverless case.
20. **Observed order ≠ happened order under concurrency.** If an audit/ledger
    assumes the order it sees events equals the order they occurred, stamp a
    monotonic sequence at record time and sort/audit by it, not by a per-call
    timestamp.
21. **`timeout` on a `shell:true` spawn kills the wrapper, not the work.** To
    actually stop the model process, detach into a group and kill the group
    (`-pid` / `taskkill /T`) — or drop the shell and track the real PID.

## What remains

Wave 8 (UI consistency): stale "$2,500 flat" manifest, drifted header/footer
copies, landing-claude duplicate content, dead Card hover, unconfirmed
destructive remove, success-toast race. Deferred from W7: event-bus #3 (audit-log
subscriber unwired), #4 (no subscriber timeout), #5 (notify dead-letter);
llm-engine #2 (Gemini error telemetry), #5 (whitespace-output mock); data-adapter
#1/#3/#4/#5; ai-operation #4/#5. No remaining criticals.
