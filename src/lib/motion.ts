import type { Variants } from "framer-motion";

// — Motion language for the Atelier of Arrival ──────────────────────────────
// One easing curve is used everywhere (the slow, paper-settling ease-out we
// used on CSS keyframes in v2). Variants are kept small and composable so a
// page can scroll-reveal a header, a stagger of cards, and a stamp without
// importing a dozen primitives.

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

/**
 * Parent variant that staggers its children's reveal by 90ms with a small
 * head-start delay. Pair with `fadeUp` (or any child variant) on direct
 * children inside <Stagger>.
 */
export const staggerParent: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.09,
      delayChildren: 0.05,
    },
  },
};

/**
 * Rubber-stamp press — scale + rotate + opacity. The slight overshoot at
 * the end mimics ink settling after the stamp lifts off the paper.
 */
export const stampIn: Variants = {
  hidden: { opacity: 0, scale: 0.7, rotate: -3 },
  show: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: { duration: 0.55, ease: [0.34, 1.3, 0.64, 1] },
  },
};
