"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Track which full-screen snap section is currently in view inside a custom
 * scroll container (the landing prototypes scroll an inner element, not the
 * window). Returns the active section id and its index, so a side-panel nav can
 * highlight the right tab and fill a progress rail.
 *
 * Observes each section against the scroll `root` and picks whichever is most
 * visible. Cheap (one IntersectionObserver, a handful of targets) and SSR-safe
 * (effect-only). Re-runs if the id list identity changes.
 */
export function useActiveSection(
  ids: readonly string[],
  rootRef: RefObject<HTMLElement | null>,
) {
  const [active, setActive] = useState<string>(ids[0] ?? "");

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const targets = ids
      .map((id) => root.querySelector<HTMLElement>(`#${CSS.escape(id)}`))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    const ratios = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        let best = "";
        let bestRatio = -1;
        for (const [id, ratio] of ratios) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            best = id;
          }
        }
        if (best && bestRatio > 0) setActive(best);
      },
      { root, threshold: [0.25, 0.5, 0.75, 1] },
    );

    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [ids, rootRef]);

  const index = Math.max(0, ids.indexOf(active));
  return { active, index };
}
