/**
 * Event subsystem entry point (ADR-0007).
 *
 * Owns the process-wide `EventBus` singleton and attaches the default
 * subscribers (audit, attorney-notify, analytics) exactly once. `getStore()`
 * calls `withDomainEvents(store)` to wrap the resolved driver so every mutation
 * publishes its event — the single wiring seam between persistence and
 * side-effects.
 */

import type { Store } from "../db/store";
import { EventBus } from "./bus";
import { withEvents } from "./store-events";
import { registerAuditLog } from "./subscribers/audit-log";
import { registerAttorneyNotify } from "./subscribers/attorney-notify";
import { registerAnalytics, type AnalyticsCollector } from "./subscribers/analytics";

let bus: EventBus | null = null;
let analytics: AnalyticsCollector | null = null;

/** The process-wide domain bus, lazily created with default subscribers. */
export function getDomainBus(): EventBus {
  if (!bus) {
    bus = new EventBus();
    registerAuditLog(bus);
    registerAttorneyNotify(bus);
    analytics = registerAnalytics(bus);
  }
  return bus;
}

/** Live analytics tally (events counted since the bus was created). */
export function getAnalytics(): AnalyticsCollector | null {
  return analytics;
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
