"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";
import { reportClientError } from "@/lib/reportClientError";

// Route-level error boundary for the dashboard segment. Keeps the Atelier
// voice (a calmly worded notice), logs the error for diagnostics, and offers
// a recovery action.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] segment error:", error);
    reportClientError("dashboard", error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center px-8 py-20">
      <div className="max-w-md text-center">
        <div className="microprint" style={{ color: "var(--accent-dark)" }}>
          § — Case file unavailable
        </div>
        <h1 className="display mt-4 text-[clamp(1.8rem,4vw,2.6rem)]">
          The file could not be <em>opened</em>.
        </h1>
        <p className="mt-4 font-sans text-[17px] leading-relaxed text-muted-strong">
          Something interrupted loading this case file. No data was changed.
          Try opening it again.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
          <Button variant="secondary" onClick={() => window.location.assign("/")}>
            Back to home
          </Button>
        </div>
      </div>
    </div>
  );
}
