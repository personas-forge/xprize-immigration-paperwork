import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Loading skeleton primitive — a parchment-toned shimmer block. Shared so
 * every async surface (case list, guidance panel, route loading.tsx) shows a
 * consistent placeholder instead of bespoke spinners.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        "skeleton-shimmer rounded-[3px]",
        className,
      )}
      {...props}
    />
  );
}
