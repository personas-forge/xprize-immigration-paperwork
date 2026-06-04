/**
 * In-process domain event bus (ADR-0007).
 *
 * A tiny synchronous-publish / async-handler pub-sub. The publisher (the Store
 * decorator in `store-events.ts`) calls `publish()` and is NEVER blocked or
 * broken by a subscriber: handlers run in isolation and a throwing or rejecting
 * handler is swallowed (routed to `onError`) so one bad subscriber can't take
 * down a mutation or its siblings. This is deliberately in-memory and
 * single-process — durability/fan-out across instances is a future concern, not
 * this increment's (see ADR-0007 "Consequences").
 */

import type { DomainEvent, DomainEventType, EventOf } from "./types";

/** A subscriber. May be sync or async; its result/rejection is isolated. */
export type EventHandler<E extends DomainEvent = DomainEvent> = (
  event: E,
) => void | Promise<void>;

/** Remove a previously-registered handler. Idempotent. */
export type Unsubscribe = () => void;

export interface EventBusOptions {
  /** Invoked when a handler throws/rejects. Defaults to console.error. */
  onError?: (error: unknown, event: DomainEvent) => void;
}

export class EventBus {
  // Per-type handler sets + a wildcard set for cross-cutting subscribers
  // (audit, analytics) that want every event.
  readonly #byType = new Map<DomainEventType, Set<EventHandler>>();
  readonly #wildcard = new Set<EventHandler>();
  readonly #onError: (error: unknown, event: DomainEvent) => void;

  constructor(options: EventBusOptions = {}) {
    this.#onError =
      options.onError ??
      ((error, event) =>
        console.error(`[events] handler failed for ${event.type}`, error));
  }

  /** Subscribe to a single event type. Returns an unsubscribe fn. */
  on<T extends DomainEventType>(
    type: T,
    handler: EventHandler<EventOf<T>>,
  ): Unsubscribe {
    let set = this.#byType.get(type);
    if (!set) {
      set = new Set();
      this.#byType.set(type, set);
    }
    const h = handler as EventHandler;
    set.add(h);
    return () => set!.delete(h);
  }

  /** Subscribe to EVERY event (audit / analytics). Returns an unsubscribe fn. */
  onAny(handler: EventHandler): Unsubscribe {
    this.#wildcard.add(handler);
    return () => this.#wildcard.delete(handler);
  }

  /**
   * Publish an event to all matching handlers. Resolves once every handler has
   * settled; a handler that throws/rejects is reported via `onError` and does
   * NOT abort the others. Callers may `await` for back-pressure or fire-and-
   * forget — either way the bus never propagates a subscriber failure.
   */
  async publish(event: DomainEvent): Promise<void> {
    const targets: EventHandler[] = [
      ...(this.#byType.get(event.type) ?? []),
      ...this.#wildcard,
    ];
    await Promise.all(
      targets.map(async (handler) => {
        try {
          await handler(event);
        } catch (error) {
          this.#onError(error, event);
        }
      }),
    );
  }

  /** Drop every subscriber. Test hygiene + teardown. */
  clear(): void {
    this.#byType.clear();
    this.#wildcard.clear();
  }
}
