> Total: 5 | Critical: 0 | High: 2 | Medium: 2 | Low: 1
> Context: Domain Event Bus
> Lens mix: bug-hunter 5, ui-perfectionist 0 (pure-backend context — no .tsx; per brief, skew fully to bug-hunter)

## 1. Provenance ledger grows without bound in the process-lifetime singleton

- **Severity**: High
- **Lens**: bug-hunter
- **Category**: unbounded-growth / memory-leak
- **File**: src/lib/events/provenance.ts:81-96 (`createProvenanceChain`), wired at src/lib/events/index.ts:32 (singleton)
- **Scenario**: `getDomainBus()` lazily builds ONE bus per process and attaches `registerProvenanceLedger(bus)`, whose `createProvenanceChain` holds `const records: ChainedAuditRecord[] = []`. Every `CaseStatusChanged` / `DraftGenerated` / `EvidenceUploaded` for EVERY case across the whole process lifetime is `push`-ed and never evicted. A long-running Node host (the non-serverless deployment the code explicitly contemplates) accumulates one immutable record per mutation forever.
- **Root cause**: The chain is an append-only in-memory array with no cap, no windowing, no flush-to-durable-sink-then-drop. `index.ts` even documents "it lives in process memory and vanishes in serverless" but never bounds it for the long-lived case; the default `ChainedAuditSink` only `console.info`s — it does not let the in-memory array shed records.
- **Impact**: Steady heap growth proportional to total lifetime mutations → eventual OOM / GC pressure on a busy long-running instance. Because the chain is also returned by `getProvenanceChain()` for export, callers that `JSON.stringify(chain.records())` pay an O(n) copy over an ever-growing array.
- **Fix sketch**: Bound the in-memory chain (ring buffer keeping the last N plus the running head hash, so verification of recent records still works), OR require a durable `ChainedAuditSink` and have `createProvenanceChain` retain only `head` + the tail window once a sink is wired. At minimum, cap `records` length and document that full-history verification requires the durable store.

## 2. Concurrent `publish()` calls give the tamper-evident ledger a non-deterministic order and non-monotonic `at`

- **Severity**: High
- **Lens**: bug-hunter
- **Category**: race-condition / event-ordering / audit-integrity
- **File**: src/lib/events/bus.ts:69-90 (`publish`), src/lib/events/provenance.ts:142-144 (`onAny` append), src/lib/events/store-events.ts:31-55 (clock captured per publish)
- **Scenario**: Two requests mutate cases concurrently — e.g. `setCaseStatus(A,…)` and `saveDraft(B,…)` overlap. Each calls `withEvents` → `await bus.publish(...)`. `publish` is async and dispatches handlers via `Promise.all`; the provenance handler `chain.append(...)` is synchronous, so each append is atomic, BUT WHICH publish's append runs first is decided by event-loop/microtask scheduling, not by emit order. The hash chain therefore links records in scheduling order, while each record's `at` was captured (`now()` in store-events) at its own publish call site.
- **Root cause**: The bus offers no per-publish serialization or ordering guarantee; the provenance ledger assumes the order it observes events equals the order they happened. For independent in-flight mutations these diverge.
- **Impact**: The "moonshot #2" tamper-evident legal audit trail can record events whose chain order disagrees with their `at` timestamps (non-monotonic `at`), and replays in an order that didn't happen — undermining the exact provenance/non-repudiation guarantee the ledger exists to provide for an immigration filing. The hash chain stays internally valid (so `verifyChain` reports `ok`), which masks the semantic misordering.
- **Fix sketch**: Serialize provenance appends against a monotonic source: either funnel publishes through a single-flight queue, or have `append` reject/flag when an incoming `at` precedes the head record's `at` (detect clock/order inversion), or stamp a strictly-increasing sequence number at append time and expose it so export can sort/audit by it. Document the ordering contract on `publish`.

## 3. The standalone audit-log subscriber is never wired into the production bus

- **Severity**: Medium
- **Lens**: bug-hunter
- **Category**: dead-path / wiring-gap / success-theater
- **File**: src/lib/events/index.ts:24-36 (`getDomainBus`), src/lib/events/subscribers/audit-log.ts:61-63 (`registerAuditLog` never called from index)
- **Scenario**: `getDomainBus()` attaches exactly two things: `registerProvenanceLedger` and `registerAttorneyNotify`. `registerAuditLog` (the documented "immutable, structured audit line… compliance trail" with an injectable `AuditSink` for "production can route to a real log/store") is exported and unit-tested but is NOT attached to the singleton.
- **Root cause**: Provenance reuses `toAuditRecord` and arguably subsumes the projection, but the audit-log subscriber's injectable durable `AuditSink` is the documented production seam — and it is never registered, so its `defaultSink` (and any future durable sink) never fires in the running app.
- **Impact**: Anyone reading audit-log.ts believes the compliance trail is emitted; in production only the provenance `console.info` runs. If the team later swaps `AuditSink` for a durable store expecting it to be live, no records flow until someone discovers the gap. Documentation/behavior drift on a compliance feature.
- **Fix sketch**: Either call `registerAuditLog(bus, <durableSink>)` in `getDomainBus()`, or delete the standalone subscriber and update the ADR/comments to state provenance is the sole audit projection so no one assumes a second, dormant trail exists.

## 4. Store mutation latency is coupled to every subscriber settling, with no timeout

- **Severity**: Medium
- **Lens**: bug-hunter
- **Category**: timing / back-pressure / no-timeout
- **File**: src/lib/events/store-events.ts:47-56,82-92,95-108 (`await bus.publish` after each write), src/lib/events/bus.ts:74-89 (`Promise.all` over handlers)
- **Scenario**: Every wrapped mutation does `await target.<write>()` THEN `await bus.publish(...)`. `publish` resolves only after `Promise.all` over all handlers settles. If any subscriber (today sync; tomorrow a durable `AuditSink`/`NotifyFn` doing network I/O) is slow or hangs, the user-facing mutation call hangs with it — the write already committed, but the caller can't return.
- **Root cause**: The bus deliberately awaits handlers for back-pressure (documented), but there is no per-handler timeout and the publish is on the critical path of the persistence write. A blocking sink turns a committed DB write into a stuck request.
- **Impact**: A misbehaving/slow subscriber degrades or stalls core flows (status change, draft save, evidence upload) even though persistence already succeeded — failure mode that looks like a DB hang but is actually a subscriber. Hard to diagnose; no upper bound on added latency.
- **Fix sketch**: Wrap each handler in a timeout (settle-or-report via `onError` after N ms) so one slow subscriber can't block publish indefinitely; and/or let the Store mutation fire-and-forget the publish (return after the write, run subscribers detached) since the comment says callers MAY await — make the side-effect path non-blocking by default for the user-facing mutations.

## 5. A dropped attorney notification is silently swallowed into `onError` (no retry, no durable signal)

- **Severity**: Low
- **Lens**: bug-hunter
- **Category**: silent-failure / success-theater
- **File**: src/lib/events/subscribers/attorney-notify.ts:56-64 (`registerAttorneyNotify`), isolated at src/lib/events/bus.ts:74-88
- **Scenario**: For a notify-worthy transition (Filed, RFE, Decision…), the subscriber calls the injected `notify(notification)`. If `notify` throws/rejects (real sink: email/queue down), the bus catches it, routes to `onError` (default `console.error`), and `publish` still resolves successfully. The mutation reports success; the attorney is never told and nothing records that the nudge was lost.
- **Root cause**: Subscriber error isolation (correct for not breaking the write) combined with a fire-and-forget notify that has no persistence, retry, or dead-letter. A failed legally-meaningful notification leaves no durable trace beyond a console line.
- **Impact**: On a product where an attorney must act on RFE/Decision milestones, a transient sink failure means a missed deadline-relevant nudge with only an ephemeral log to show for it — looks like it worked.
- **Fix sketch**: Have the notify sink enqueue to a durable store (or emit a `NotificationFailed` audit record) so a lost nudge is recoverable/visible; at minimum log at error level with the caseId+status and a "notification NOT delivered" marker distinct from the bus's generic handler-failed message, and consider an outbox so attorney notifications survive sink outages.
