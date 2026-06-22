"use client";

import { useSyncExternalStore } from "react";
import { PALETTE, INK_PALETTE, type Palette } from "./palette";

// Re-skins the Recharts set when the document theme changes. The charts hold
// concrete colors (SVG presentation attributes can't take CSS vars), so instead
// of reading computed styles we mirror the two token sets in palette.ts and pick
// between them by the active theme. We subscribe to the SAME `atelier-theme`
// event the ThemeToggle dispatches, so a toggle anywhere updates every chart.

function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("atelier-theme", cb);
  return () => window.removeEventListener("atelier-theme", cb);
}

// getSnapshot must return a STABLE primitive (the theme name), not a fresh
// object — returning a new palette object each call would loop the store.
function getSnapshot(): "parchment" | "ink" {
  if (typeof document === "undefined") return "parchment";
  return document.documentElement.dataset.theme === "ink" ? "ink" : "parchment";
}

export function useThemePalette(): Palette {
  const mode = useSyncExternalStore(subscribe, getSnapshot, () => "parchment");
  return mode === "ink" ? INK_PALETTE : PALETTE;
}
