"use client";

import { motion, useReducedMotion } from "framer-motion";
import { easeArrival, fadeUp } from "@/lib/motion";

// SLOW-HYDRATION FALLBACK (visual sweep ship-blocker #1): framer's
// `initial="hidden"` inlines `opacity:0` into the SSR markup, so before JS
// hydrates every reveal-wrapped block is invisible — on a slow network the
// marketing pages were blank parchment for seconds. The fix is NOT to swap
// element types at hydration (a div→motion.div remount resets all child state
// and races real clicks — it lost form state in testing); instead every
// reveal element carries `data-reveal`, and globals.css force-reveals them by
// CSS animation when `html[data-hydrated]` (set by HydrationMarker) hasn't
// appeared within ~1.2s. Fast hydration never triggers it; no-JS/slow-JS
// readers get the content; element identity never changes.

// Thin, opinionated wrappers around framer-motion that (1) always honor
// `prefers-reduced-motion` by returning a plain element, and (2) use
// `whileInView` with the project-wide viewport margin so reveals fire just
// before the element enters the user's reading focus. The wrappers are kept
// purely structural — no styling — so they slot under any layout primitive.

type DivProps = React.HTMLAttributes<HTMLDivElement>;

// The element these wrappers render as. Defaults to `div`; pass a list tag so a
// staggered group can carry REAL list semantics (`<ol><li>…`) instead of
// `role="list"` on a `<div>`, which screen readers honor more reliably.
type AsTag = "div" | "ol" | "ul" | "li" | "section";

const inView = { once: true, margin: "-80px" } as const;

/**
 * Scroll-reveal: fade + 14px rise the first time the element scrolls into
 * view. Drop-in for any block element. Respects reduced-motion. Render as a
 * different tag (e.g. `as="li"`) via the `as` prop to keep semantics correct.
 */
export function Rise({
  children,
  className,
  as = "div",
  delay = 0,
  ...rest
}: DivProps & { as?: AsTag; delay?: number }) {
  const reduce = useReducedMotion();
  if (reduce) {
    const Tag = as;
    return (
      <Tag className={className} {...(rest as React.HTMLAttributes<HTMLElement>)}>
        {children}
      </Tag>
    );
  }
  const MotionTag = motion[as] as typeof motion.div;
  return (
    <MotionTag
      className={className}
      data-reveal
      initial="hidden"
      whileInView="show"
      viewport={inView}
      variants={fadeUp}
      transition={{ duration: 0.7, ease: easeArrival, delay }}
      {...(rest as React.ComponentProps<typeof motion.div>)}
    >
      {children}
    </MotionTag>
  );
}
