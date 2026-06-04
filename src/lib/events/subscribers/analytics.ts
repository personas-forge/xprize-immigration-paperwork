/**
 * Analytics subscriber (ADR-0007).
 *
 * Counts domain events by type — the cheapest useful product signal (how many
 * drafts generated, evidence uploaded, statuses advanced). Holds an in-memory
 * tally with an injectable `track` sink so a real metrics pipeline can be wired
 * later without changing the Store or the bus.
 */

import type { EventBus } from "../bus";
import type { DomainEvent, DomainEventType } from "../types";

export type Counter = Record<DomainEventType, number>;

export type TrackFn = (type: DomainEventType, event: DomainEvent) => void;

export interface AnalyticsCollector {
  readonly counts: Readonly<Counter>;
  /** Unsubscribe from the bus. */
  detach: () => void;
}

function emptyCounter(): Counter {
  return { CaseStatusChanged: 0, DraftGenerated: 0, EvidenceUploaded: 0 };
}

/**
 * Attach an analytics collector to a bus. Returns a handle exposing the live
 * tally plus a `detach()` to unsubscribe. An optional `track` sink forwards
 * each event to an external pipeline.
 */
export function registerAnalytics(
  bus: EventBus,
  track?: TrackFn,
): AnalyticsCollector {
  const counts = emptyCounter();
  const off = bus.onAny((event) => {
    counts[event.type] += 1;
    track?.(event.type, event);
  });
  return {
    counts,
    detach: off,
  };
}
