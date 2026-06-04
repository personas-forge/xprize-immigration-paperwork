# ADR 0007 — In-process domain event bus

- Status: Accepted
- Date: 2026-06-04
- Scope: `src/lib/events`, `src/lib/db/store.ts`

## Context

The petition pipeline has three milestones that increasingly need side-effects
beyond persistence — an attorney should be notified, a compliance audit trail
should be written, and product analytics should be counted:

- a case advances status (`Store.setCaseStatus` / `Store.transitionCase`),
- a draft version is saved (`Store.saveDraft`),
- a document lands in the evidence vault (`Store.addCaseDocument`).

Bolting those side-effects onto the call sites (or into the Store drivers)
couples unrelated concerns: every route that moves a case would have to remember
to also notify, audit, and track — and the Firestore/PGlite drivers would grow
notification/analytics code that has nothing to do with persistence. That
duplication is exactly the kind of drift the `Store` boundary exists to prevent.

## Decision

Introduce a lightweight **in-process event bus** (`src/lib/events/`) and emit
typed domain events at the persistence boundary, so side-effects subscribe
instead of being wired into mutations.

- **Typed events** (`types.ts`): a discriminated union — `CaseStatusChanged`,
  `DraftGenerated`, `EvidenceUploaded` — each carrying `type`, `at` (ISO time),
  `caseId`, and the fields a subscriber needs to act without re-reading the
  store.
- **Bus** (`bus.ts`): `EventBus` with `on(type, …)`, `onAny(…)`, and an
  isolating `publish(…)`. A throwing/rejecting subscriber is routed to
  `onError` and never breaks the publisher or sibling subscribers — a side-
  effect failure must not fail a database write.
- **Store decorator** (`store-events.ts`): `withEvents(store, bus)` returns a
  transparent Proxy over `Store`. Reads pass through untouched; the three
  mutations publish their event **after** the write succeeds — and only when it
  actually changed state (a failed compare-and-set `transitionCase` is silent).
  The clock is injected for deterministic tests.
- **Subscribers** (`subscribers/`): `audit-log` (every event → structured
  record), `attorney-notify` (`CaseStatusChanged` for notify-worthy statuses →
  notification intent), `analytics` (per-type tally). Each takes an injectable
  sink so the default behaviour is logging while production can route to real
  channels — and tests capture in memory.
- **Wiring** (`index.ts` + `getStore`): a process-wide bus singleton attaches
  the default subscribers once; `getStore()` wraps the resolved driver via
  `withDomainEvents()`, lazily imported to keep the events subsystem out of the
  bundle until a store is used. No call-site changes.

## Consequences

- Adding a side-effect is adding a subscriber — the Store and the routes never
  change. The persistence boundary stays about persistence.
- Events are **in-memory and single-process**: there is no durability or cross-
  instance fan-out. A subscriber that needs delivery guarantees (e.g. a durable
  outbox) is a future increment; this bus is the seam it would plug into.
- `publish()` awaits its subscribers, so a slow synchronous subscriber adds
  latency to the mutation. The default subscribers are cheap; anything heavy
  should hand off to its own queue inside the handler.
- The decorator keys off method names; renaming a mutation on `Store` requires
  updating `store-events.ts` (guarded by `store-events.test.ts`).
