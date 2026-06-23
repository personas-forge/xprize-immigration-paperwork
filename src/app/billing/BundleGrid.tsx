"use client";

import { useEffect, useState } from "react";
import { Stamp } from "@/components/brand";
import {
  bundlePriceLabel,
  formatCentsPerToken,
  type Bundle,
} from "@/lib/tokens/economy";

// — Token bundle grid (client) ───────────────────────────────────────────────
// Renders the four prepaid bundles as document bands and runs the purchase
// handshake: POST /api/checkout → redirect to Polar's hosted checkout. When
// billing isn't configured the route 503s; we surface that inline rather than
// crash, so the page works in keyless builds and both themes (all colour comes
// from CSS tokens, so parchment/ink re-skin automatically).

type Status = { key: string | null; error: string | null };

export function BundleGrid({ bundles }: { bundles: Bundle[] }) {
  const [status, setStatus] = useState<Status>({ key: null, error: null });
  const loading = status.key !== null;

  // Clear the in-flight state if the page is restored from the bfcache (the user
  // opened Polar's checkout, then hit Back) — otherwise the button stays stuck on
  // "Opening…" and disabled.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setStatus({ key: null, error: null });
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  async function buy(key: string) {
    if (loading) return; // a checkout is already in flight
    setStatus({ key, error: null });
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundle: key }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (res.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      const message =
        res.status === 401
          ? "Please sign in to purchase tokens."
          : data.error === "billing_not_configured"
            ? "Checkout isn't configured yet — bundles will be purchasable once billing is live."
            : "Could not start checkout. Please try again.";
      setStatus({ key: null, error: message });
    } catch {
      setStatus({ key: null, error: "Network error — please try again." });
    }
  }

  return (
    <div>
      {status.error ? (
        <div
          role="alert"
          className="mb-6 rounded-control border border-danger/40 bg-danger-soft/50 px-4 py-3 font-sans text-[15px] text-danger"
        >
          {status.error}
        </div>
      ) : null}

      {/* The in-flight state is otherwise purely visual ("Opening…" + disabled).
          Announce it to assistive tech so a screen-reader user knows a money
          action started — a polite live region, so it doesn't interrupt. */}
      <div role="status" aria-live="polite" className="sr-only">
        {loading ? "Opening checkout…" : ""}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {bundles.map((b) => {
          const isBest = b.featured ?? false;
          return (
            <div
              key={b.key}
              className={`lift relative flex h-full flex-col rounded-card border bg-surface p-6 shadow-leaf ${
                isBest ? "border-accent/60 bg-accent-soft/30 shadow-seal" : "border-border"
              }`}
            >
              {isBest ? (
                <div className="absolute -top-3 left-5">
                  <Stamp label="Best value" meta="most topped up" tone="seal" rotate={-4} />
                </div>
              ) : null}

              <div className="microprint" style={{ color: "var(--accent-dark)" }}>
                Bundle · prepaid
              </div>
              <h3 className="display mt-2 text-2xl text-foreground">{b.label}</h3>

              <div className="mt-5 flex items-baseline gap-2">
                <span
                  className="display text-[2.6rem] text-foreground"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {bundlePriceLabel(b)}
                </span>
                {b.discountLabel ? (
                  <span className="microprint" style={{ color: "var(--accent-dark)" }}>
                    {b.discountLabel}
                  </span>
                ) : null}
              </div>

              <div className="perforation my-5 h-px" aria-hidden />

              <ul className="flex-1 space-y-2 font-sans text-[15.5px] leading-snug text-foreground-soft">
                <li className="flex items-baseline gap-2">
                  <span
                    className="doc-number text-[17px] text-foreground"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {b.tokens.toLocaleString()}
                  </span>
                  <span className="microprint" style={{ color: "var(--muted)" }}>
                    tokens
                  </span>
                </li>
                <li className="microprint" style={{ color: "var(--muted)" }}>
                  ≈ {formatCentsPerToken(b.centsPerToken)} / token
                </li>
                <li className="microprint" style={{ color: "var(--muted)" }}>
                  ≈ {b.tokens.toLocaleString()} guidance answers
                </li>
              </ul>

              <button
                type="button"
                onClick={() => buy(b.key)}
                disabled={loading}
                aria-busy={status.key === b.key}
                className={`mt-6 inline-flex items-center justify-center gap-2 rounded-control px-5 py-3 font-mono text-[14px] uppercase tracking-document transition-[background-color,border-color,transform] focus-ring active:translate-y-[1px] disabled:opacity-60 ${
                  isBest
                    ? "bg-seal text-background hover:bg-[color:var(--accent-dark)]"
                    : "border border-border-strong bg-transparent text-foreground hover:border-foreground"
                }`}
              >
                {status.key === b.key ? "Opening…" : "Buy tokens"}
                <span aria-hidden>→</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
