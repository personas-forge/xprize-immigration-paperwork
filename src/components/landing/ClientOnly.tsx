"use client";

import { useSyncExternalStore, type ReactNode } from "react";

// Never re-subscribes — the value is constant per environment.
const emptySubscribe = () => () => {};

/**
 * Render children only on the client (after hydration).
 *
 * Recharts' ResponsiveContainer measures its parent on mount and has no useful
 * SSR output (zero-size container), so we gate on "are we past server render?".
 * `useSyncExternalStore` gives the SSR-safe answer without a setState-in-effect:
 * it returns `true` from the server snapshot and `false` from the client
 * snapshot, so React paints the placeholder for the server/hydration HTML and
 * swaps in the chart on the client with no hydration mismatch. `fallback`
 * should match the chart's box height to avoid layout shift.
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const isServer = useSyncExternalStore(
    emptySubscribe,
    () => false,
    () => true,
  );
  return <>{isServer ? fallback : children}</>;
}
