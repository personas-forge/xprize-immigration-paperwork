// Persistence layer for the one-time token-economy explainer banner.
// The React-facing store (subscribe / getSnapshot / getServerSnapshot) comes
// from the shared createLocalStorageStore factory; the injectable
// readDismissed / writeDismissed helpers stay local so they remain unit-testable
// under the node runner with an in-memory storage stub (no DOM / window).

import { createLocalStorageStore } from "@/lib/createLocalStorageStore";

export const DISMISS_KEY = "atelier-token-banner-dismissed";
const EVENT = "atelier-token-banner-change";

// Server snapshot is false (banner shown on SSR); only an explicit "1" counts
// as dismissed, matching the writer below. localStorage is the source of truth,
// so a failed write (private mode) intentionally does NOT notify.
const store = createLocalStorageStore<boolean>({
  key: DISMISS_KEY,
  eventName: EVENT,
  defaultValue: false,
  parse: (raw) => raw === "1",
  serialize: (dismissed) => (dismissed ? "1" : "0"),
});

export const subscribe = store.subscribe;
export const getSnapshot = store.getSnapshot;
export const getServerSnapshot = store.getServerSnapshot;

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
