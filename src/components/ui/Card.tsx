import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  tone?: "default" | "accent" | "muted";
};

const toneClass: Record<NonNullable<CardProps["tone"]>, string> = {
  default: "border-border bg-surface",
  accent: "border-accent/30 bg-accent-soft",
  muted: "border-border bg-surface-muted",
};

export function Card({ tone = "default", className, ...props }: CardProps) {
  return (
    <div
      className={cn("rounded-card border shadow-card", toneClass[tone], className)}
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
        "flex items-center justify-between border-b border-border px-5 py-3",
        className
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
    <div className={cn("text-sm font-semibold text-foreground", className)} {...props} />
  );
}

export function CardSubtitle({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-xs text-muted", className)} {...props} />;
}

export function CardBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}
