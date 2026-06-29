import type { Variants } from "framer-motion";

// — Motion language for the Atelier of Arrival ──────────────────────────────
// One easing curve is used everywhere (the slow, paper-settling ease-out we
// used on CSS keyframes in v2). Variants are kept small and composable so a
// page can scroll-reveal a header without importing a dozen primitives.

/** Slow, paper-settling ease-out. The single curve every animation uses. */
export const easeArrival: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Fade + 14px rise — the document-ink reveal. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: easeArrival },
  },
};
