"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/reportClientError";

// Last-resort boundary: catches a throw in the ROOT LAYOUT itself, where the
// app shell (fonts, tokens, chrome) may not exist — so this must render its
// own <html>/<body> and can rely on NOTHING from globals.css. Inline styles
// only, tuned to the parchment identity by hand.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] root layout error:", error);
    reportClientError("global", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f5efe2",
          color: "#2b2620",
          fontFamily: "Georgia, 'Times New Roman', serif",
          textAlign: "center",
          padding: "5rem 2rem",
        }}
      >
        <div style={{ maxWidth: "28rem" }}>
          <p
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: "12px",
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: "#8a6d3b",
            }}
          >
            § — Temporarily unavailable
          </p>
          <h1 style={{ fontSize: "2.2rem", margin: "1rem 0 0" }}>
            Something went <em>wrong</em>.
          </h1>
          <p style={{ fontSize: "17px", lineHeight: 1.6, marginTop: "1rem", color: "#5c5347" }}>
            The application hit an unexpected error. Your data and your token
            balance are unchanged. Try again — if it persists, come back a
            little later.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "2rem",
              padding: "0.8rem 1.6rem",
              fontFamily: "ui-monospace, monospace",
              fontSize: "14px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              background: "#7a1f2b",
              color: "#f5efe2",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
