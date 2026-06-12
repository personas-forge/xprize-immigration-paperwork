import { type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "seal";
type Size = "sm" | "md" | "lg";

// Buttons in the Atelier system are document-grade controls, not soft pills.
// Primary is ink-on-parchment with an engraved double rule on hover; the seal
// variant is bordeaux for ceremonial actions ("Sign", "File").
const variantClass: Record<Variant, string> = {
  primary:
    "bg-foreground text-background border border-foreground hover:bg-foreground-soft",
  secondary:
    "bg-transparent text-foreground border border-border-strong hover:border-foreground hover:bg-surface-muted/60",
  ghost:
    // ring-accent-dark, not ring-accent: gold-leaf --accent is 2.63:1 against the
    // parchment background (below the 3:1 non-text-contrast minimum, WCAG 1.4.11);
    // --accent-dark clears it on both themes (4.2:1 light, 5.6:1 dark). The offset
    // is pinned to the themed background so the gap never falls back to white.
    "text-muted-strong hover:text-foreground hover:bg-surface-muted/50 border border-transparent focus-visible:ring-2 focus-visible:ring-accent-dark focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  seal:
    "bg-seal text-background border border-seal hover:bg-[color:var(--accent-dark)] hover:border-[color:var(--accent-dark)]",
};

const sizeClass: Record<Size, string> = {
  sm: "px-3 py-1.5 text-[12px]",
  md: "px-5 py-2.5 text-[13px]",
  lg: "px-7 py-3.5 text-[14px]",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        // Document-grade chrome: small radius, mono-leaning label, restrained transition.
        "inline-flex items-center justify-center gap-2 rounded-control font-mono uppercase tracking-document",
        "transition-[background-color,border-color,color,transform] duration-300 ease-out",
        "focus-visible:outline-none active:translate-y-[1px]",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...props}
    />
  );
}
