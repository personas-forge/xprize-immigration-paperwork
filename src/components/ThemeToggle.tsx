"use client";

import { useCallback, useSyncExternalStore } from "react";

// — Header theme toggle ─────────────────────────────────────────────────────
// Swaps `data-theme="ink"` on <html>, persists to localStorage, and
// subscribes via useSyncExternalStore so any toggle on the page stays in
// sync. The pre-paint script in app/layout.tsx applies the saved choice
// before first paint, so this component never causes a FOUC.

const STORAGE_KEY = "atelier-theme";
type ThemeMode = "parchment" | "ink";

function readMode(): ThemeMode {
  if (typeof document === "undefined") return "parchment";
  return document.documentElement.dataset.theme === "ink" ? "ink" : "parchment";
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("atelier-theme", callback);
  return () => window.removeEventListener("atelier-theme", callback);
}

export function ThemeToggle() {
  // Default to "parchment" during SSR; the pre-paint script and the post-
  // mount subscription correct it on the client without a layout shift.
  const mode = useSyncExternalStore(subscribe, readMode, () => "parchment");
  const isInk = mode === "ink";

  const toggle = useCallback(() => {
    const next: ThemeMode = isInk ? "parchment" : "ink";
    // Remove the attribute entirely for parchment (rather than leaving
    // data-theme=""), matching the pre-paint script which only ever SETS it for
    // ink — so hasAttribute("data-theme") reflects the real state.
    if (next === "ink") document.documentElement.dataset.theme = "ink";
    else delete document.documentElement.dataset.theme;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage can throw in private modes; the toggle still works for
      // the session — we just lose persistence, which is acceptable.
    }
    window.dispatchEvent(new Event("atelier-theme"));
  }, [isInk]);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isInk ? "Switch to parchment theme" : "Switch to ink theme"}
      aria-pressed={isInk}
      className="inline-grid h-8 w-8 place-items-center rounded-pill border border-border-strong bg-surface text-foreground transition-[background-color,border-color,color] hover:border-foreground hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
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
