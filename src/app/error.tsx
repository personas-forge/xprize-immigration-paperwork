"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";

// Root error boundary — the branded catch for every segment WITHOUT its own
// error.tsx (marketing pages, /qualify, /billing, /welcome, /c/[token], …;
// the dashboard subtree keeps its more specific boundary). These include the
// sign-up and payment pages, where an unstyled framework error screen reads
// as "the product ate my money".
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] segment error:", error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center px-8 py-20">
      <div className="max-w-md text-center">
        <div className="microprint" style={{ color: "var(--accent-dark)" }}>
          § — Temporarily unavailable
        </div>
        <h1 className="display mt-4 text-[clamp(1.8rem,4vw,2.6rem)]">
          Something went <em>wrong</em>.
        </h1>
        <p className="mt-4 font-sans text-[17px] leading-relaxed text-muted-strong">
          The page hit an unexpected error while loading. Your data and your
          token balance are unchanged. Try again — if it persists, come back a
          little later.
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
    </main>
  );
}
