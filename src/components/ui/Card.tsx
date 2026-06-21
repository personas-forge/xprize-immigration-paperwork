import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  tone?: "default" | "accent" | "muted" | "seal";
  /** Opt in to a subtle hover-lift (the `.lift` class — a 3px translate that
   *  globals.css neutralises under prefers-reduced-motion). STATIC by default. */
  interactive?: boolean;
};

// Cards are vellum cards — a hairline ruled edge, a paper-warm fill, a static
// leaf-shadow; depth comes from edge contrast. They do NOT lift on hover by
// default (pass `interactive` for that). The "accent" tone tints parchment-gold.
const toneClass: Record<NonNullable<CardProps["tone"]>, string> = {
  default: "border-border bg-surface",
  accent: "border-accent/40 bg-accent-soft/40",
  muted: "border-border bg-surface-muted",
  seal: "border-seal/40 bg-seal-soft/50",
};

export function Card({ tone = "default", interactive = false, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "relative rounded-card border shadow-leaf",
        toneClass[tone],
        interactive && "lift",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-border px-5 py-3.5",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "display text-[1.05rem] font-medium text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function CardSubtitle({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("microprint", className)}
      style={{ color: "var(--muted)" }}
      {...props}
    />
  );
}

export function CardBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}
