import { type ReactNode } from "react";

/**
 * Rubber-stamp ornament — a tilted, double-ruled block with monospace label
 * that "stamps" a key fact (qualification, status, etc.). Inspired by the
 * inked admission stamps on a passport page; rotated -3° by default, which
 * makes it feel hand-pressed rather than aligned.
 */
export function Stamp({
  label,
  meta,
  tone = "seal",
  rotate = -3,
}: {
  label: string;
  meta?: string;
  tone?: "seal" | "indigo" | "accent";
  rotate?: number;
}) {
  const toneClass = {
    seal: "text-seal border-seal",
    indigo: "text-indigo border-indigo",
    accent: "text-accent-dark border-accent-dark",
  }[tone];

  return (
    <div
      className={`inline-flex select-none flex-col items-start gap-0.5 border-2 border-double px-3 py-1.5 ${toneClass}`}
      style={{ transform: `rotate(${rotate}deg)` }}
      aria-hidden
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
