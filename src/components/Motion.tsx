"use client";

import { type ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { easeArrival, fadeUp, staggerParent } from "@/lib/motion";

// Thin, opinionated wrappers around framer-motion that (1) always honor
// `prefers-reduced-motion` by returning a plain element, and (2) use
// `whileInView` with the project-wide viewport margin so reveals fire just
// before the element enters the user's reading focus. The wrappers are kept
// purely structural — no styling — so they slot under any layout primitive.

type DivProps = React.HTMLAttributes<HTMLDivElement>;

const inView = { once: true, margin: "-80px" } as const;

/**
 * Scroll-reveal: fade + 14px rise the first time the element scrolls into
 * view. Drop-in for any block element. Respects reduced-motion.
 */
export function Rise({
  children,
  className,
  as: _as,
  delay = 0,
  ...rest
}: DivProps & { as?: "div"; delay?: number }) {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <div className={className} {...rest}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={inView}
      variants={fadeUp}
      transition={{ duration: 0.7, ease: easeArrival, delay }}
      {...(rest as React.ComponentProps<typeof motion.div>)}
    >
      {children}
    </motion.div>
  );
}

/**
 * Parent that staggers its direct children's reveal. Each child should be a
 * <motion.*> element (or a <Rise>) with a `hidden`/`show` variants pair.
 */
export function Stagger({
  children,
  className,
  variants,
  ...rest
}: DivProps & { variants?: Variants }) {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <div className={className} {...rest}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={inView}
      variants={variants ?? staggerParent}
      {...(rest as React.ComponentProps<typeof motion.div>)}
    >
      {children}
    </motion.div>
  );
}

/**
 * Hover lift — a 3px upward translate on hover, the same restrained motion
 * the v2 `.lift` CSS class provides but as a wrapper so a non-CSS element
 * can opt in without redefining styles. Inherits any extra props.
 */
export function HoverCard({
  children,
  className,
  ...rest
}: DivProps & { children: ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <div className={className} {...rest}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      className={className}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.36, ease: easeArrival }}
      {...(rest as React.ComponentProps<typeof motion.div>)}
    >
      {children}
    </motion.div>
  );
}
