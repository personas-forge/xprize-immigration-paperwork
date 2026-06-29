# Code Refactor — Domain Event Bus
> Total: 5
> Critical: 0 | High: 1 | Medium: 2 | Low: 2

Scope note: the bus IS live — `store.ts:399` wraps the resolved driver via `(await import("../events")).withDomainEvents(resolved)`, and `withEvents` (store-events.ts) publishes after each of the 3 mutations. That core seam is clean and well-tested; the findings below are on the read/subscriber periphery. Context list was stale: there is **no** `subscribers/analytics.ts`; the real extra file is `provenance.ts` (+ `provenance.test.ts`).

## 1. Provenance ledger is write-only — `getProvenanceChain`/`verifyChain` have no production caller
- **Severity**: High
- **Category**: dead-code
- **File**: src/lib/events/index.ts:50 (`getProvenanceChain`); src/lib/events/provenance.ts:141 (`verifyChain`), :127-128 (`head`/`records`)
- **Scenario**: `getDomainBus()` calls `registerProvenanceLedger(bus).chain` (index.ts:38), so on EVERY domain event the ledger runs `toAuditRecord` → `canonical()` (recursive key-sort) → SHA-256 and accumulates up to `DEFAULT_MAX_RECORDS = 10_000` `ChainedAuditRecord`s in process memory. But the read side is never invoked by the app: a whole-repo grep (excluding docs) for `getProvenanceChain|verifyChain|\.records\(\)` finds only `index.ts` itself plus `provenance.test.ts`. `src/app/**` has zero references to provenance/audit, and the only external import of `lib/events` anywhere is `withDomainEvents` (store.ts:399).
- **Root cause**: Moonshot #2 shipped the producer (hash-chain + bus wiring) but never the consumer (no `/api/audit` verify/export route, no CLI). `getProvenanceChain` is documented "for verification/export" (index.ts:48-49) — but nothing verifies or exports.
- **Impact**: Per-event hashing + a growing in-memory buffer with no reader = unobservable work; the "tamper-evident audit trail" cannot actually be inspected by the running system, so the honesty comments (index.ts:27-31) describe a capability that has no surface. It's the read-side analogue of "bus built but not connected."
- **Fix sketch**: Either (a) ship the consumer the export claims — a small `GET /api/audit/pack` (auth-gated) that returns `getProvenanceChain()?.records()` + a `verifyChain` result — turning this into live infrastructure; or (b) if export isn't on the near roadmap, stop registering the ledger in `getDomainBus()` and drop `getProvenanceChain`/`provenance` singleton, keeping `provenance.ts` as a tested-but-dormant module. Don't leave it half-wired.

## 2. `registerAuditLog` (+ `AuditSink`, `defaultSink`) is dead outside tests — audit-log.ts presents as a live subscriber
- **Severity**: Medium
- **Category**: dead-code
- **File**: src/lib/events/subscribers/audit-log.ts:70 (`registerAuditLog`), :20-23 (`AuditSink`/`defaultSink`)
- **Scenario**: The file header calls itself "the audit-log subscriber" and `registerAuditLog` is the advertised attach point, but `getDomainBus()` deliberately does NOT attach it (index.ts:33-37) to avoid double-logging against provenance. Grep confirms `registerAuditLog` is imported only by `subscribers/subscribers.test.ts`; `AuditSink`/`defaultSink` are referenced nowhere but their own module. The only LIVE export of this file is `toAuditRecord` (+ the `AuditRecord` type), consumed by `provenance.ts:21`.
- **Root cause**: The module was authored as a standalone subscriber, then superseded by the provenance ledger (which reuses `toAuditRecord`). The subscriber half was kept as a "wire it when a durable sink lands" seam (documented), but that leaves ~3 dead exports framed as the file's primary purpose.
- **Impact**: A reader sees an "audit subscriber" and reasonably assumes it runs in production; it doesn't. The file's real, live contribution (`toAuditRecord`) is a projection helper, not a subscriber.
- **Fix sketch**: Demote the framing — rename/relocate `toAuditRecord` as the audit *projection* (it's already what provenance imports), and either delete `registerAuditLog`/`AuditSink`/`defaultSink` or move them behind a clearly-labeled "dormant: wire on durable sink" comment block so the live vs latent split is unambiguous. Tie its life to finding #1's decision.

## 3. `caseStatusChanged` is a single-use factory rationalized by a non-existent "future second publisher"
- **Severity**: Medium
- **Category**: consolidation
- **File**: src/lib/events/store-events.ts:47-57 (factory), :74 (its only call site)
- **Scenario**: `caseStatusChanged(...)` is a 5-arg builder for a 6-field object literal, called exactly once. Its justifying comment — "the `guarded` arg stays a parameter for any future second publisher" (line 48) — describes a publisher that does not exist: `withEvents` is the sole emitter and always passes `true` (line 74). Meanwhile the sibling events `DraftGenerated` (line 87) and `EvidenceUploaded` (line 101) are built inline. So one of three events is factored, two are not, on a speculative rationale.
- **Root cause**: Speculative generality left over from an earlier shape; the "guarded" branch (`guarded ? "guarded transition" : "status update"`, attorney-notify.ts:98) implies a non-guarded path that no live caller produces.
- **Impact**: Inconsistent construction style across three parallel events + a comment that misleads about an extension point that was never built; mild cognitive cost, no correctness risk.
- **Fix sketch**: Inline `caseStatusChanged` at line 74 to match its siblings (always `guarded: true`) and drop the speculative comment; OR, if a factory is wanted, apply the same factory pattern to all three events for consistency. Pick one direction.

## 4. Stale "analytics" subscriber references — no analytics module exists
- **Severity**: Low
- **Category**: cleanup
- **File**: src/lib/events/bus.ts:40 and :92 ("audit, analytics" / "audit / analytics"); src/lib/events/types.ts:5 ("attorney notification, audit logging, analytics")
- **Scenario**: Three comments cite "analytics" as a cross-cutting `onAny` subscriber, and the campaign brief itself lists analytics as a "built-in subscriber." Grep for `analytics|registerAnalytics` across `src/lib/events` returns only these comments — there is no `subscribers/analytics.ts` and no analytics handler is registered. (`lib/cost-telemetry.ts` / `lib/lighttrack.ts` are unrelated funnel analytics, not bus subscribers.)
- **Root cause**: Doc comments written for a planned-but-unbuilt subscriber, never reconciled when only audit + attorney-notify shipped.
- **Impact**: Misleads readers (and scanners) into believing an analytics sink exists/runs.
- **Fix sketch**: Change the examples to reference real subscribers (audit/provenance, attorney-notify), or qualify as "e.g. a future analytics sink."

## 5. Subscriber `unsubscribe` returns are dead in production — teardown API is test-only
- **Severity**: Low
- **Category**: dead-code
- **File**: src/lib/events/index.ts:38 (`registerProvenanceLedger(bus).chain` discards `unsubscribe`), :43 (`registerAttorneyNotify(...)` return discarded); src/lib/events/bus.ts:128 (`clear`)
- **Scenario**: Both registrars return unsubscribe handles (`registerProvenanceLedger` → `{ unsubscribe, chain }` at provenance.ts:174; `registerAttorneyNotify` → `bus.on(...)` at attorney-notify.ts:107), but `getDomainBus()` keeps only `.chain` and discards both. The bus is a process-lifetime singleton with "no reset/teardown export and none is needed" (index.ts:17-19); tests that want isolation `new EventBus()` instead, and `clear()` is exercised only by `bus.test.ts`. So the entire unsubscribe/`clear` teardown surface is unused in production.
- **Root cause**: Subscribers return unsubscribe fns for test ergonomics; the singleton wiring never tears down, so the returns are inherently dead at the one production call site.
- **Impact**: Negligible — minor API surface that implies a lifecycle the app never uses. Not worth deleting (the handles are legitimately useful in tests), but worth a one-line note at the singleton so nobody assumes runtime unsubscription is supported.
- **Fix sketch**: Leave the returns (test value) but drop a comment at index.ts:38/43 noting the handles are intentionally discarded for the process-lifetime singleton; no `clear()` is wired at runtime.
