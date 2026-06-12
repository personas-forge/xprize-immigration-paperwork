// Persistence layer for the one-time token-economy explainer banner.
// Pure + dependency-free so it unit-tests cleanly under the node test runner.
// Follows the same useSyncExternalStore + localStorage pattern as
// usePersistentQuery.ts — server snapshot returns false (banner hidden on SSR),
// client snapshot reads localStorage.

export const DISMISS_KEY = "atelier-token-banner-dismissed";
const EVENT = "atelier-token-banner-change";

let cache: { raw: string | null; value: boolean } = { raw: null, value: false };

export function readDismissed(storage: Pick<Storage, "getItem"> = window.localStorage): boolean {
  try {
    return storage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeDismissed(storage: Pick<Storage, "setItem"> = window.localStorage): void {
  try {
    storage.setItem(DISMISS_KEY, "1");
  } catch {
    // best-effort; worst case the banner re-appears on next load
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT));
  }
}

export function getSnapshot(): boolean {
  const raw = (() => {
    try {
      return window.localStorage.getItem(DISMISS_KEY);
    } catch {
      return null;
    }
  })();
  if (raw !== cache.raw) {
    cache = { raw, value: raw === "1" };
  }
  return cache.value;
}

// Server snapshot: always show banner (false = not dismissed).
// null balance = demo mode, so the banner won't mount anyway.
export function getServerSnapshot(): boolean {
  return false;
}

export function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
