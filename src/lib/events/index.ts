/**
 * Event subsystem entry point (ADR-0007).
 *
 * Owns the process-wide `EventBus` singleton and attaches the default
 * subscribers (audit, attorney-notify) exactly once. `getStore()` calls
 * `withDomainEvents(store)` to wrap the resolved driver so every mutation
 * publishes its event — the single wiring seam between persistence and
 * side-effects.
 */

import type { Store } from "../db/store";
import { EventBus } from "./bus";
import { withEvents } from "./store-events";
import { registerAuditLog } from "./subscribers/audit-log";
import { registerAttorneyNotify } from "./subscribers/attorney-notify";

// Process-lifetime singleton: there is no reset/teardown export and none is
// needed — tests that want a clean bus construct `new EventBus()` directly (and
// use EventBus.clear()); nothing exercises this singleton across test cases.
let bus: EventBus | null = null;

/** The process-wide domain bus, lazily created with default subscribers. */
export function getDomainBus(): EventBus {
  if (!bus) {
    bus = new EventBus();
    // HONESTY: both subscribers run with their LOG-ONLY default sinks (console.info)
    // — no production delivery is wired. The "append-only audit trail" and the
    // attorney notifications are stdout lines today (and vanish in serverless),
    // NOT durable/delivered. Inject a real AuditSink / NotifyFn here (e.g. a Store
    // audit table, an email/queue) before relying on either for compliance.
    registerAuditLog(bus);
    registerAttorneyNotify(bus);
  }
  return bus;
}

/** Wrap a resolved Store so its mutations publish domain events. */
export function withDomainEvents(store: Store): Store {
  return withEvents(store, getDomainBus());
}

export { EventBus } from "./bus";
export { withEvents } from "./store-events";
export type {
  DomainEvent,
  DomainEventType,
  CaseStatusChanged,
  DraftGenerated,
  EvidenceUploaded,
} from "./types";
