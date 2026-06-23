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
import { registerAttorneyNotify, resolveNotifyFn } from "./subscribers/attorney-notify";
import { registerProvenanceLedger, type ProvenanceChain } from "./provenance";

// Process-lifetime singleton: there is no reset/teardown export and none is
// needed — tests that want a clean bus construct `new EventBus()` directly;
// nothing resets this singleton across test cases.
let bus: EventBus | null = null;
let provenance: ProvenanceChain | null = null;

/** The process-wide domain bus, lazily created with default subscribers. */
export function getDomainBus(): EventBus {
  if (!bus) {
    bus = new EventBus();
    // HONESTY: the sinks run with their LOG-ONLY default sinks (console.info) —
    // no DURABLE delivery is wired. The provenance ledger hash-chains every
    // record so the trail is tamper-EVIDENT (moonshot #2), but it lives in
    // process memory and vanishes in serverless. Inject a durable ChainedAuditSink
    // (a Store ledger table) here before relying on it across requests/instances.
    //
    // The standalone `registerAuditLog` subscriber is deliberately NOT attached:
    // provenance is the sole LIVE audit projection (it reuses the same
    // `toAuditRecord`), so adding audit-log with its default console sink would
    // only double-log. Wire `registerAuditLog(bus, durableSink)` here when a
    // durable AuditSink lands — until then there is no second, dormant trail.
    provenance = registerProvenanceLedger(bus).chain;
    // Real delivery when ATTORNEY_NOTIFY_WEBHOOK_URL is set (provider-agnostic
    // POST), else the console default — so a milestone (RFE/Decision/Filed) can
    // actually reach the attorney of record once an operator wires a channel,
    // instead of only a server log nobody watches.
    registerAttorneyNotify(bus, resolveNotifyFn());
  }
  return bus;
}

/** The process-wide provenance chain (tamper-evident audit ledger), for
 *  verification/export. Null until the bus is first created. */
export function getProvenanceChain(): ProvenanceChain | null {
  getDomainBus();
  return provenance;
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
