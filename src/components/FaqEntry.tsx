"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { easeArrival } from "@/lib/motion";

// One FAQ row, styled as a petition entry. A native <button> drives the
// disclosure state (better keyboard support than <details>), and the
// answer panel animates height + opacity with AnimatePresence. Reduced
// motion: panel toggles instantly with no transition.

type Props = {
  index: number;
  question: string;
  answer: string;
  defaultOpen?: boolean;
};

export function FaqEntry({ index, question, answer, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const reduce = useReducedMotion();
  const panelId = `faq-panel-${index}`;
  const buttonId = `faq-btn-${index}`;

  return (
    <li className="py-6">
      <button
        id={buttonId}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="group flex w-full items-baseline justify-between gap-6 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
      >
        <span className="flex flex-1 items-baseline gap-4">
          <span className="doc-number shrink-0 text-[12px] text-muted">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="display flex-1 text-[1.4rem] text-foreground transition-colors group-hover:text-accent-dark">
            {question}
          </span>
        </span>
        <span
          aria-hidden
          className="ml-auto inline-grid h-6 w-6 shrink-0 place-items-center rounded-pill border border-border-strong font-mono text-[11px] text-muted-strong transition-transform"
          style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }}
        >
          +
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            key="panel"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.42, ease: easeArrival }}
            className="overflow-hidden"
          >
            <div className="ml-12 mt-4 border-l border-rule pl-5">
              <p className="font-sans text-[15.5px] leading-relaxed text-foreground-soft">
                {answer}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  );
}
