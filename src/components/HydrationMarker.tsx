"use client";

import { useEffect } from "react";

/**
 * Stamps `data-hydrated` on <html> once React has hydrated. Since the reveal
 * wrappers ship VISIBLE server HTML (see useHydrated in Motion.tsx), a page is
 * readable before it is interactive — a click in that window lands on inert
 * markup. This attribute is the deterministic "interactive now" signal the
 * e2e/UAT harnesses wait for before their first interaction; it costs one
 * no-op effect in production and renders nothing.
 */
export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "1";
  }, []);
  return null;
}
