// Shared SSR-safe localStorage external-store factory.
//
// Three modules used to hand-roll the same idiom — "persist a typed value to
// localStorage, expose it through useSyncExternalStore, notify peers via a
// window event" — each re-deriving the same subtle correctness details: the
// SSR-safe snapshot, the cached `{ raw, value }` snapshot-stability shim (so
// React's useSyncExternalStore doesn't loop on a fresh reference), the custom
// event + cross-tab `storage` subscription, and the best-effort write-through
// setter. This factory carries that logic once.
//
// Framework-agnostic on purpose (no React import, no "use client"): the
// returned functions are exactly the shape useSyncExternalStore consumes, and
// the module stays importable from node-tested code — it touches `window`
// only inside function bodies, never at import time.

export interface LocalStorageStore<T> {
  /** useSyncExternalStore subscribe — the custom event plus, optionally, the
   *  native cross-tab `storage` event. SSR-safe (no-op without `window`). */
  subscribe: (callback: () => void) => () => void;
  /** Client snapshot — reads + parses localStorage, cached by the raw string
   *  so the returned reference is stable between writes (or React loops). */
  getSnapshot: () => T;
  /** SSR snapshot — the configured default (no hydration mismatch). */
  getServerSnapshot: () => T;
  /** Imperative read — identical to {@link getSnapshot}. */
  read: () => T;
  /** Write-through: serialize → setItem (best-effort) → notify subscribers. */
  write: (value: T) => void;
}

export interface CreateLocalStorageStoreOptions<T> {
  /** localStorage key. */
  key: string;
  /** Custom window event dispatched on write so same-tab consumers re-read. */
  eventName: string;
  /** Value returned on the server and before the first successful read. */
  defaultValue: T;
  /** Turn the stored raw string (or null when absent) into a value. */
  parse: (raw: string | null) => T;
  /** Turn a value into the string persisted to localStorage. */
  serialize: (value: T) => string;
  /** Also re-read on the native cross-tab `storage` event. Default true. */
  crossTab?: boolean;
  /** Notify subscribers even when the localStorage write itself threw.
   *  Default false: when localStorage IS the source of truth a failed write
   *  means nothing changed, so notifying would only re-render the OLD value.
   *  Set true when the live value lives elsewhere (e.g. a DOM attribute the
   *  caller already mutated) and the event is what drives the re-render. */
  notifyOnFailedWrite?: boolean;
}

export function createLocalStorageStore<T>(
  options: CreateLocalStorageStoreOptions<T>,
): LocalStorageStore<T> {
  const {
    key,
    eventName,
    defaultValue,
    parse,
    serialize,
    crossTab = true,
    notifyOnFailedWrite = false,
  } = options;

  // Cache the parsed value keyed by the raw string so getSnapshot returns a
  // stable reference between writes — useSyncExternalStore requires snapshot
  // identity to be stable or it re-renders in a loop.
  let cache: { raw: string | null; value: T } = {
    raw: null,
    value: defaultValue,
  };

  function readRaw(): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function getSnapshot(): T {
    const raw = readRaw();
    if (raw !== cache.raw) {
      cache = { raw, value: parse(raw) };
    }
    return cache.value;
  }

  function getServerSnapshot(): T {
    return defaultValue;
  }

  function subscribe(callback: () => void): () => void {
    if (typeof window === "undefined") return () => {};
    window.addEventListener(eventName, callback);
    if (crossTab) window.addEventListener("storage", callback);
    return () => {
      window.removeEventListener(eventName, callback);
      if (crossTab) window.removeEventListener("storage", callback);
    };
  }

  function notify(): void {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(eventName));
    }
  }

  function write(value: T): void {
    try {
      window.localStorage.setItem(key, serialize(value));
    } catch {
      // Persistence failed (private mode / quota).
      if (notifyOnFailedWrite) notify();
      return;
    }
    notify();
  }

  return { subscribe, getSnapshot, getServerSnapshot, read: getSnapshot, write };
}
