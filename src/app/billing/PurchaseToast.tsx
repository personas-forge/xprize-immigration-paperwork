"use client";

import { useEffect, useState } from "react";

// Shown when Polar redirects back to /billing?status=success after a purchase.
// Confirms the top-up (the webhook credits the balance) and auto-dismisses.
export function PurchaseToast() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShow(false), 4500);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div
      role="status"
      className="mb-8 flex items-center justify-between gap-4 rounded-control border border-success/40 bg-success-soft/50 px-5 py-3.5 font-sans text-[16px] text-foreground"
    >
      <span className="flex items-center gap-2.5">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="shrink-0 text-success"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        Payment received — your tokens will appear in your balance momentarily.
      </span>
      <button
        type="button"
        onClick={() => setShow(false)}
        aria-label="Dismiss"
        className="shrink-0 font-mono text-[13px] uppercase tracking-document text-muted-strong transition-colors hover:text-foreground focus-ring"
      >
        Dismiss
      </button>
    </div>
  );
}
