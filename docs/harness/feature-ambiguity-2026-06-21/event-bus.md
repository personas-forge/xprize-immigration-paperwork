# Domain Event Bus — Feature Scout + Ambiguity Guardian

> Context #15 · Group: AI Infrastructure & Evaluation
> Total: 5 findings

## 1. Attorney notification is a console stub — no real email/SMS delivery channel exists anywhere
- **Lens**: feature-scout
- **Priority**: Critical
- **Category**: feature
- **File**: `src/lib/events/subscribers/attorney-notify.ts:35`
- **Observation**: `registerAttorneyNotify` is wired into the production bus (`index.ts:39`) with its `defaultNotify` sink, which is `console.info("[attorney-notify] ...")`. A grep of `src/` for `sendEmail|nodemailer|resend|sendgrid|twilio|sms` returns ZERO hits — there is no delivery infrastructure in the entire codebase. The product promise is "your attorney of record reviews & signs," yet when a case enters `In Review`/`RFE`/`Filed`/`Decision` the attorney is "notified" only to a server log nobody watches.
- **Proposal**: Implement a real `NotifyFn` backed by an injectable email/queue provider (Resend or the existing Polar/host mailer), wired in `getDomainBus()` behind an env flag. Render the `AttorneyNotification` (caseId, status, reason, at) into a templated message and deliver to the case's attorney-of-record address. Keep the console sink as the local-dev default.
- **Value / Risk-if-ignored**: An RFE or Decision milestone silently going unnoticed is a missed legal deadline — the single worst failure mode for an immigration tool, and a guarantee/liability exposure. The whole "attorney reviews" value prop is non-functional without this.
- **Effort**: M

## 2. No durable event log, dead-letter, or replay — a lost notification/audit record is unrecoverable
- **Lens**: feature-scout
- **Priority**: High
- **Category**: functionality
- **File**: `src/lib/events/index.ts:38`
- **Observation**: The bus is in-process only; both live sinks default to console (`provenance.ts:162` `defaultChainSink`, attorney-notify's `defaultNotify`). `getDomainBus()` itself documents that provenance "lives in process memory and vanishes in serverless." There is no persisted event/outbox table, no dead-letter queue, and `bus.ts`'s `onError` is a console line — a handler that times out or throws produces only a log entry with no record to retry from.
- **Proposal**: Add a durable append-only `domain_events` (or outbox) table written transactionally near the Store mutation, plus a `ChainedAuditSink`/`AuditSink` backed by a Store ledger table (the seams `registerAuditLog(bus, durableSink)` and `registerProvenanceLedger(bus, durableSink)` already exist). Route `onError` failures to a dead-letter row keyed by event so they can be replayed by a worker.
- **Value / Risk-if-ignored**: Without durability there is no compliance trail across requests and no way to recover a dropped attorney nudge or audit line in serverless — the audit/provenance work is decorative until it survives a process restart.
- **Effort**: L

## 3. Fire-after-commit, no outbox: a crash between the write and `publish()` silently loses the event
- **Lens**: ambiguity-guardian
- **Priority**: High
- **Category**: edge_case
- **File**: `src/lib/events/store-events.ts:47`
- **Observation**: Each decorator does `await target.<mutation>(...)` then `await bus.publish(...)` (lines 47-48, 64, 82-83, 96-97). The write commits FIRST; the event is published in a separate, non-transactional step. If the process is killed (serverless freeze/OOM, deploy) in the window after commit but before/within `publish`, the CaseStatusChanged/EvidenceUploaded event is lost with no trace — the very "at-least-once vs at-most-once" semantics ADR-0007 leaves unstated. The header comment says events fire "AFTER the write succeeds (never on a failed/no-op write)" but never states the delivery guarantee or that loss is possible.
- **Proposal**: Decide and document the contract explicitly. For at-least-once, write the event to a durable outbox inside the same transaction/commit as the mutation and have a relay drain it to the bus; for the current in-memory increment, record in ADR-0007 that delivery is best-effort/at-most-once and events can be lost on crash, so no consumer may treat the bus as the source of truth.
- **Value / Risk-if-ignored**: Today the gap is invisible and untested — a lost CaseStatusChanged means a missing audit record and a missing attorney notification with zero signal. Even keeping best-effort delivery, the unstated guarantee will mislead the next person who wires a durable sink.
- **Effort**: M

## 4. Handler timeout leaves the handler running detached → ghost/duplicate delivery after a reported failure
- **Lens**: ambiguity-guardian
- **Priority**: Medium
- **Category**: trade-off
- **File**: `src/lib/events/bus.ts:54`
- **Observation**: `#runHandler` rejects after `handlerTimeoutMs` (default `5_000`, `bus.ts:36`) but the underlying handler promise keeps running detached — the comment at lines 28-31 says so explicitly. So an attorney-notify or durable audit sink that exceeds 5s is reported to `onError` as "timed out" (and, once durable retry exists, queued for replay) while the original call MAY still complete a moment later. That is an unresolved at-most-once-vs-at-least-once ambiguity: the same notification could be delivered twice, or counted as failed while it actually succeeded.
- **Proposal**: Document the at-least-once consequence on the timeout path and make downstream sinks idempotent (dedupe key = event content hash / `seq`), or pass an `AbortSignal` into the handler so a timed-out delivery can actually cancel rather than race to completion. At minimum, record in ADR-0007 that a timed-out handler may still have side effects.
- **Value / Risk-if-ignored**: With a real email sink this becomes a double-send (or a "failed" alert on a delivered message) under transient slowness — confusing for attorneys and corrupting any retry/replay logic built on the `onError` signal.
- **Effort**: S

## 5. No emit ordering or per-event sequence carried on the wire; ordering correctness rests only on the provenance ledger
- **Lens**: ambiguity-guardian
- **Priority**: Medium
- **Category**: edge_case
- **File**: `src/lib/events/store-events.ts:31`
- **Observation**: Events carry only `at` (ISO wall-clock from an injectable `Clock`, `store-events.ts:31`). `publish()` `await`s handlers via `Promise.all` with no ordering guarantee between concurrent publishes, and the `at` timestamp can tie or invert under concurrency — the provenance ledger compensates with an append-time `seq` and an `atRegression` flag (`provenance.ts:29-37`), explicitly warning "sort by `seq`, not `at`." But that `seq` lives ONLY inside the in-memory provenance chain; the raw `DomainEvent` handed to attorney-notify and any future durable/outbox consumer has no monotonic order field, so two CaseStatusChanged events for one case can be persisted/notified out of order with no way to detect it.
- **Proposal**: Stamp a monotonic per-emit sequence (or a `(caseId, seq)`) on the `DomainEvent` itself in `withEvents`, not just inside the provenance ledger, and document the intended ordering guarantee (none / per-case / global) in ADR-0007 so downstream sinks can order or reject stale updates.
- **Value / Risk-if-ignored**: A "Filed → RFE" pair landing as "RFE → Filed" in a notification or durable log would misstate a case's legal status; the safeguard exists but only for the projection that never leaves memory.
- **Effort**: M
