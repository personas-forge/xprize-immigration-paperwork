import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Rubber-stamp ornament — a tilted, double-ruled block with monospace label
 * that "stamps" a key fact (qualification, status, etc.). Inspired by the
 * inked admission stamps on a passport page; rotated -3° by default, which
 * makes it feel hand-pressed rather than aligned.
 *
 * Decorative by default (the label is duplicated by nearby visible text, so it
 * is `aria-hidden`). Pass `decorative={false}` when the stamp is the SOLE
 * conveyor of a status — it is then exposed to AT as an image with a composed
 * `label — meta` accessible name instead of being hidden.
 */
export function Stamp({
  label,
  meta,
  tone = "seal",
  rotate = -3,
  className,
  decorative = true,
}: {
  label: string;
  meta?: string;
  tone?: "seal" | "accent";
  rotate?: number;
  className?: string;
  decorative?: boolean;
}) {
  const toneClass = {
    seal: "text-seal border-seal",
    accent: "text-accent-dark border-accent-dark",
  }[tone];

  return (
    <div
      className={cn(
        "inline-flex select-none flex-col items-start gap-0.5 border-2 border-double px-3 py-1.5",
        toneClass,
        className,
      )}
      style={{ transform: `rotate(${rotate}deg)` }}
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": meta ? `${label} — ${meta}` : label })}
    >
      <span className="display text-lg font-medium uppercase leading-none tracking-tight">
        {label}
      </span>
      {meta ? (
        <span className="microprint" style={{ color: "currentColor", opacity: 0.75 }}>
          {meta}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Decorative section ribbon — a roman-numeral chapter mark above section
 * headings. Reads as "§ I — Title" with the section-symbol set in mono.
 */
export function ChapterMark({
  numeral,
  label,
  children,
}: {
  numeral: string;
  label?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-3 text-muted-strong">
      <span className="microprint" aria-hidden>
        §
      </span>
      <span className="display text-xl italic text-accent-dark">{numeral}</span>
      {label ? (
        <span className="microprint" style={{ color: "var(--muted-strong)" }}>
          — {label}
        </span>
      ) : null}
      {children}
    </div>
  );
}
