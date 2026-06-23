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
  /** Per-handler timeout (ms). `publish` is on the critical path of a committed
   *  Store write, so a slow/hung subscriber (a durable sink doing network I/O)
   *  must not block the mutation's caller indefinitely. After this, the handler
   *  is reported via `onError` and `publish` stops waiting (the handler keeps
   *  running detached). 0 disables the timeout. */
  handlerTimeoutMs?: number;
}

/** Default per-handler timeout — generous enough for any in-process sink, short
 *  enough that a hung network sink can't wedge a user-facing mutation. */
export const DEFAULT_HANDLER_TIMEOUT_MS = 5_000;

export class EventBus {
  // Per-type handler sets + a wildcard set for cross-cutting subscribers
  // (audit, analytics) that want every event.
  readonly #byType = new Map<DomainEventType, Set<EventHandler>>();
  readonly #wildcard = new Set<EventHandler>();
  readonly #onError: (error: unknown, event: DomainEvent) => void;
  readonly #timeoutMs: number;

  constructor(options: EventBusOptions = {}) {
    this.#onError =
      options.onError ??
      ((error, event) =>
        console.error(`[events] handler failed for ${event.type}`, error));
    this.#timeoutMs = options.handlerTimeoutMs ?? DEFAULT_HANDLER_TIMEOUT_MS;
  }

  /** Run a handler, rejecting if it doesn't settle within the configured
   *  timeout (so one slow subscriber can't block the publish forever). */
  #runHandler(handler: EventHandler, event: DomainEvent): Promise<void> {
    const run = Promise.resolve().then(() => handler(event));
    if (this.#timeoutMs <= 0) return run;
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`subscriber timed out after ${this.#timeoutMs}ms`)),
        this.#timeoutMs,
      );
      run.then(
        () => {
          clearTimeout(timer);
          resolve();
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        },
      );
    });
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
          await this.#runHandler(handler, event);
        } catch (error) {
          // The error reporter itself must never break the publish (and thus
          // the Store mutation): a throwing onError would otherwise reject the
          // Promise.all and defeat the isolation guarantee.
          try {
            this.#onError(error, event);
          } catch (reporterError) {
            console.error("[events] onError reporter threw", reporterError);
          }
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
