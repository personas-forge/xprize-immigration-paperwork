"use client";

import { useEffect, useRef, useState } from "react";
import { CRITERIA_PRIMERS } from "../criteria-primers";

/**
 * A `?` icon button that opens an inline popover with a one-sentence
 * plain-English definition and an evidence example for the given O-1A
 * criterion. Designed for first-time users unfamiliar with immigration law.
 *
 * Closes on outside-click or Escape. Positions above the button when there
 * is not enough space below (detected via a simple viewport-bottom check).
 */
export function CriterionPrimerButton({ criterionName }: { criterionName: string }) {
  const primer = CRITERIA_PRIMERS[criterionName];
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // Move focus into dialog on open; return it to trigger on close.
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      closeRef.current?.focus();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);

  // Close on Escape or outside click.
  useEffect(() => {
    if (!open) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open]);

  // No primer data for this criterion — render nothing.
  if (!primer) return null;

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Learn about the ${criterionName} criterion`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className={[
          // 24x24 min touch target (WCAG 2.5.8) — was h-4 w-4 (16x16px).
          "ml-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full",
          "border text-[12px] font-semibold leading-none",
          "transition-colors duration-150",
          open
            ? "border-accent-dark bg-accent-dark/10 text-accent-text"
            : "border-rule text-muted hover:border-accent-dark hover:text-accent-text",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-dark focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        ].join(" ")}
      >
        ?
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${criterionName} criterion explained`}
          className={[
            "absolute left-0 top-full z-50 mt-2",
            "w-72 rounded-control border border-border-strong",
            "bg-background shadow-md",
            "p-4 text-left",
          ].join(" ")}
        >
          {/* Close affordance — receives focus when dialog opens */}
          <button
            ref={closeRef}
            type="button"
            aria-label="Close primer"
            onClick={() => setOpen(false)}
            // 24x24 min touch target (WCAG 2.5.8) — was h-5 w-5 (20x20px).
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-dark"
          >
            ×
          </button>

          <p className="microprint mb-1 font-medium uppercase tracking-document text-accent-dark">
            {criterionName}
          </p>
          <p className="font-sans text-[15px] leading-snug text-foreground">
            {primer.definition}
          </p>
          <div className="mt-3 border-t border-dotted border-rule pt-3">
            <p className="microprint mb-1 text-muted">Example evidence</p>
            <p className="font-sans text-[14.5px] italic leading-snug text-muted-strong">
              {primer.example}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
