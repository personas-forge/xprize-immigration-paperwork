"use client";

import { useCallback, useSyncExternalStore } from "react";
import { createLocalStorageStore } from "@/lib/createLocalStorageStore";

// — Header theme toggle ─────────────────────────────────────────────────────
// Swaps `data-theme="ink"` on <html>, persists to localStorage, and
// subscribes via useSyncExternalStore so any toggle on the page stays in
// sync. The pre-paint script in app/layout.tsx applies the saved choice
// before first paint, so this component never causes a FOUC.

const STORAGE_KEY = "atelier-theme";
type ThemeMode = "parchment" | "ink";

// Shares the factory's subscribe / server-snapshot / persist + notify core, but
// the live theme is the `data-theme` attribute on <html> (the pre-paint script
// stamps it before first paint), so the client snapshot reads the DOM via
// `readMode` rather than localStorage. Single-tab (no cross-tab `storage`
// listener) and notify-on-failed-write: the toggle has already mutated the DOM,
// so the dispatched event must fire to re-render us even if persistence throws.
const store = createLocalStorageStore<ThemeMode>({
  key: STORAGE_KEY,
  eventName: "atelier-theme",
  defaultValue: "parchment",
  parse: (raw) => (raw === "ink" ? "ink" : "parchment"),
  serialize: (mode) => mode,
  crossTab: false,
  notifyOnFailedWrite: true,
});

function readMode(): ThemeMode {
  if (typeof document === "undefined") return "parchment";
  return document.documentElement.dataset.theme === "ink" ? "ink" : "parchment";
}

export function ThemeToggle() {
  // Default to "parchment" during SSR; the pre-paint script and the post-
  // mount subscription correct it on the client without a layout shift.
  const mode = useSyncExternalStore(store.subscribe, readMode, store.getServerSnapshot);
  const isInk = mode === "ink";

  const toggle = useCallback(() => {
    const next: ThemeMode = isInk ? "parchment" : "ink";
    // Remove the attribute entirely for parchment (rather than leaving
    // data-theme=""), matching the pre-paint script which only ever SETS it for
    // ink — so hasAttribute("data-theme") reflects the real state.
    if (next === "ink") document.documentElement.dataset.theme = "ink";
    else delete document.documentElement.dataset.theme;
    // Persist (best-effort) + dispatch "atelier-theme" so the store re-reads.
    store.write(next);
  }, [isInk]);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isInk ? "Switch to parchment theme" : "Switch to ink theme"}
      aria-pressed={isInk}
      className="inline-grid h-8 w-8 place-items-center rounded-pill border border-border-strong bg-surface text-foreground transition-[background-color,border-color,color] hover:border-foreground hover:bg-surface-muted focus-ring"
    >
      {/* Inline SVGs — no extra dep, scale with currentColor */}
      {isInk ? (
        // Sun (for switching back to parchment)
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
        </svg>
      ) : (
        // Moon (for switching to ink)
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M20.5 14.5A8 8 0 0 1 9.5 3.5a8 8 0 1 0 11 11z" />
        </svg>
      )}
    </button>
  );
}

/**
 * Pre-paint script — inlined in <head>. Reads localStorage *before* the first
 * paint and stamps `data-theme="ink"` on <html> so the page never flashes the
 * wrong theme. Kept dependency-free; runs synchronously.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");if(t==="ink"){document.documentElement.setAttribute("data-theme","ink");}}catch(e){}})();`;
