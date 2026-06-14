# Code Refactor Scan — Domain Event Bus

> Total: 4 (C0 / H1 / M2 / L1)

## 0. Wiring verification (headline context — NOT a finding)
The critical "is the whole bus dead?" hypothesis was **disproven**. `getStore()` wraps the
resolved driver with `withDomainEvents(store)` at `src/lib/db/store.ts:290`, which calls
`withEvents(store, getDomainBus())` (`src/lib/events/index.ts:38-40`). `getDomainBus()` lazily
constructs the singleton and registers all three subscribers (`index.ts:22-30`). So the
**publish side is fully adopted**: every `setCaseStatus` / `transitionCase` / `saveDraft` /
`addCaseDocument` through the real Store fires a typed event. The feature is live, not dead.
(Tooling note: an initial `Glob src/lib/events/**` returned a stale cross-project index listing
`eventBus.ts` / `domainEmitters.ts` — those files do NOT exist in this repo. `git ls-files` and
`ls` confirm the on-disk + tracked reality is the ADR-0007 set: bus.ts, store-events.ts,
subscribers/. The "two event systems" concern was a harness artifact, not a real duplication.)

## 1. getAnalytics() is dead exported surface — collector is written but never read
- **Severity**: high
- **Category**: dead-code
- **File**: src/lib/events/index.ts:33 (and the `analytics` module var at :19,:27)
- **Scenario**: `registerAnalytics(bus)` is attached and its `AnalyticsCollector` is stashed in
  the module-level `analytics` var, then exposed via `getAnalytics()`. No route, page, hook,
  or API handler ever calls `getAnalytics()` — `git grep getAnalytics -- src/*` returns only
  the definition line itself. The live `counts` tally is incremented on every event and read
  by nobody.
- **Root cause**: The product-signal consumer (an admin metrics endpoint / dashboard tile) was
  never built; the collector + accessor were shipped speculatively as a seam.
- **Impact**: The entire `AnalyticsCollector` interface, `Counter`/`TrackFn` types, the
  `emptyCounter()` allocation, the `onAny` wildcard subscription that runs on every single
  mutation, and the `getAnalytics()` accessor are all dead weight. Every domain event pays for
  an unused increment + closure. Misleads readers into thinking analytics are consumed.
- **Verification**: `git grep -n "getAnalytics" -- 'src/*'` → 1 hit (the definition). The
  `analytics` var is assigned at index.ts:27 and read only at index.ts:34 (inside the unused
  accessor). `registerAnalytics` is otherwise referenced only in subscribers.test.ts.
- **Fix sketch**: Either (a) wire `getAnalytics()` into a real read path (e.g. an admin
  `/api/metrics` route or an observability `after()` flush) to adopt it, or (b) delete
  `getAnalytics()`, the `analytics` module var, the `registerAnalytics(bus)` call, and
  `subscribers/analytics.ts` outright. Keep the bus's `onAny` for audit. Choose adopt-or-remove;
  do not leave it half-wired.

## 2. Audit + attorney-notify subscribers ship with console-only default sinks (not-yet-adopted delivery)
- **Severity**: medium
- **Category**: dead-code
- **File**: src/lib/events/index.ts:25-26; src/lib/events/subscribers/audit-log.ts:22; src/lib/events/subscribers/attorney-notify.ts:35
- **Scenario**: `getDomainBus()` calls `registerAuditLog(bus)` and `registerAttorneyNotify(bus)`
  with NO sink argument, so both fall back to their `defaultSink` / `defaultNotify`, which only
  `console.info(...)`. The modules are designed for an injected production sink (`AuditSink`,
  `NotifyFn`), but no caller anywhere injects one (`git grep` for `AuditSink`/`NotifyFn`/
  `registerAuditLog`/`registerAttorneyNotify` outside the events module and tests = 0 hits).
- **Root cause**: The persistence/delivery half of the side-effect features (append-only audit
  store; email/queue attorney delivery) was deferred. The pure projection logic is adopted, the
  egress is not. (Confirmed: no competing attorney-delivery exists — the `ATTORNEY_EMAILS` hits
  in routes are authorization gating in `src/lib/auth/roles.ts`, a different concern, not a
  notification channel; `lighttrack.ts` is an LLM-telemetry vendor client, not a domain-audit
  sink, so there is no real duplication to consolidate.)
- **Impact**: The advertised "immutable compliance audit trail" and "attorney notification" are
  in practice stdout log lines that vanish in serverless. Reads as a delivered feature but is a
  no-op in production — a correctness/expectation gap more than dead code.
- **Verification**: `getDomainBus()` (index.ts:25-26) passes no second arg → defaults used.
  `git grep -n "AuditSink\|NotifyFn\|registerAuditLog\|registerAttorneyNotify" -- 'src/*'` →
  only definitions + subscribers.test.ts. No email/queue/notify delivery in `src/app` or
  `src/lib` outside auth gating.
- **Fix sketch**: Decide per subscriber: inject a real sink in `getDomainBus()` (audit →
  `Store.appendAuditRecord` or LightTrack `after()`; notify → existing email/queue) to adopt, OR
  add an explicit ADR/code comment marking these as "log-only until delivery lands" so reviewers
  don't assume durability. No structural deletion — the seam is intentional; the gap is honesty.

## 3. EventBus.clear() is test-only surface with no singleton reset path
- **Severity**: medium
- **Category**: cleanup
- **File**: src/lib/events/bus.ts:93; src/lib/events/index.ts:18 (`bus` singleton)
- **Scenario**: `EventBus.clear()` is a public method used only by `bus.test.ts:123`. Meanwhile
  the process singleton in `index.ts` (`let bus`/`let analytics`) has NO reset/teardown export.
  Tests that need a clean bus must construct `new EventBus()` directly; the real `getDomainBus()`
  singleton can never be cleared, so a test importing through `index.ts` would leak subscribers
  across cases. `clear()` exists on the class but is unreachable for the singleton it's meant to
  reset.
- **Root cause**: Teardown hygiene was added at the class level but the singleton wrapper never
  exposed a `resetDomainBus()` to use it, leaving `clear()` half-orphaned.
- **Impact**: Minor — `clear()` is justified for test hygiene, but the missing singleton-reset
  means it can't protect the live wiring path, and a reader can't tell whether the singleton is
  resettable. Low blast radius (no prod misbehavior), but it's a confusing surface.
- **Verification**: `git grep -n "\.clear()\|reset" -- 'src/lib/events/*'` → `clear()` only in
  bus.test.ts:123 + the bus.ts definition; no `bus = null`/`reset` in index.ts.
- **Fix sketch**: Either add `export function resetDomainBus()` to index.ts (null the `bus`/
  `analytics` vars) and use it from any singleton-based test, or, if all tests construct buses
  directly, leave `clear()` and add a one-line comment that the singleton is process-lifetime
  only. Keep `clear()` (it's used).

## 4. Injectable Clock in store-events is exported but never overridden outside tests
- **Severity**: low
- **Category**: cleanup
- **File**: src/lib/events/store-events.ts:29-31 (`Clock` type, `wallClock`, `now` param)
- **Scenario**: `withEvents(store, bus, now)` takes a third `Clock` param defaulting to
  `wallClock`. The production caller `withDomainEvents` (index.ts:39) never passes it; only tests
  pin the clock. `git grep "Clock" -- src/*` (excluding events/) = 0 hits.
- **Root cause**: Standard testability seam — fine to keep, but the exported `Clock` type +
  `wallClock` const widen the public surface for a purely test-only injection.
- **Impact**: Cosmetic. No dead execution; just slightly more exported API than the one external
  caller needs. Documented here for completeness so it isn't mistaken for an adoption gap.
- **Verification**: `withDomainEvents` calls `withEvents(store, getDomainBus())` (2 args). The
  `now` override appears only in store-events.test.ts.
- **Fix sketch**: No action recommended — this is a legitimate, low-cost test seam. If trimming
  surface is desired, the `Clock` type could be un-exported (kept internal) since no external
  module references it. Verify the test imports it before un-exporting.
