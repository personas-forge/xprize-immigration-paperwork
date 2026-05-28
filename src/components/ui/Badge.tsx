import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger";

// Badges are document annotations — small monospace marks with a thin
// ruled box. No pill shape (that's the generic SaaS dialect); a tight
// rectilinear chip with letterspacing reads like a stamp register entry.
const toneClass: Record<BadgeTone, string> = {
  neutral: "bg-surface-muted text-muted-strong border-border-strong",
  accent: "bg-accent-soft text-accent-dark border-accent/40",
  success: "bg-success-soft text-success border-success/40",
  warning: "bg-warning-soft text-warning border-warning/40",
  danger: "bg-danger-soft text-danger border-danger/40",
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[2px] border px-2 py-[3px]",
        "font-mono text-[10px] font-medium uppercase tracking-document",
        toneClass[tone],
        className,
      )}
      {...props}
    />
  );
}
