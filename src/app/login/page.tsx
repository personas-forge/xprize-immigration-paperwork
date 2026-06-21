"use client";

// Sign-in — "The Visa Window". Re-skinned to the Atelier of Arrival identity:
// parchment/ink ground, gold-leaf accents, a guilloché rosette, a perforated
// rule and a rubber-stamp seal. Load-bearing logic: the Firebase popup Google
// sign-in handler and the "not yet configured" notice. Renders correctly in
// BOTH the parchment and ink themes — every colour is a semantic token, so the
// [data-theme="ink"] overrides apply automatically.

import { useState } from "react";
import Link from "next/link";
import { signInWithPopup } from "firebase/auth";
import { isDevAuth } from "@/lib/auth/devAuth";
import { authProvider } from "@/lib/auth/provider";
import { safeNext } from "@/lib/auth/safe-next";
import { firebaseAuth, googleProvider } from "@/lib/firebase/client";
import { PageFrame, Guilloche, Stamp, ChapterMark } from "@/components/brand";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LoginPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const devAuth = isDevAuth();
  const provider = authProvider();

  // Firebase / Identity Platform: popup sign-in → ID token → server session
  // cookie (POST /api/auth/session) → onboarding gate.
  async function signInWithGoogleFirebase() {
    setBusy(true);
    setError("");
    try {
      const cred = await signInWithPopup(firebaseAuth(), googleProvider());
      const idToken = await cred.user.getIdToken();
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) throw new Error("Could not establish a session.");
      // Carry the (validated) deep-link destination through onboarding. safeNext
      // rejects off-site / protocol-relative targets so this can't become an
      // open redirect; /welcome forwards an onboarded user straight to it.
      const dest = safeNext(new URLSearchParams(window.location.search).get("next"));
      window.location.href = `/welcome?next=${encodeURIComponent(dest)}`;
    } catch (e) {
      setBusy(false);
      setError(
        e instanceof Error && e.message
          ? e.message
          : "Sign-in failed. Please try again.",
      );
    }
  }

  return (
    <PageFrame>
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
        {/* Engraved certificate card */}
        <section className="relative overflow-hidden rounded-card border border-border-strong bg-surface guilloche shadow-leaf">
          {/* faint guilloché rosette behind the card content */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 z-0 text-accent-dark opacity-[0.14]"
          >
            <Guilloche size={320} rings={8} />
          </div>

          <div className="relative z-10 flex flex-col gap-7 p-8">
            <div className="flex items-center justify-between">
              <ChapterMark numeral="O-1" label="Atelier of Arrival" />
              <ThemeToggle />
            </div>

            <header className="space-y-3">
              <h1 className="display text-[clamp(2.1rem,7vw,3rem)] text-foreground">
                Sign in to your <em>case file</em>.
              </h1>
              <p className="font-sans text-[17px] leading-relaxed text-muted-strong">
                One secure door to your petition, your evidence vault, and your
                attorney of record.
              </p>
            </header>

            <div className="perforation h-px" aria-hidden />

            {devAuth ? (
              <div className="space-y-3">
                <Link
                  href="/dashboard"
                  className="group inline-flex items-center justify-center gap-3 rounded-control border border-foreground bg-foreground px-6 py-3.5 font-mono text-[14px] uppercase tracking-document text-background transition-[transform,background-color] hover:-translate-y-[1px] hover:bg-foreground-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]"
                >
                  Continue as developer →
                </Link>
                <p className="microprint" style={{ color: "var(--accent-dark)" }}>
                  Dev-auth on · local PGlite · NODE_ENV ≠ production
                </p>
              </div>
            ) : provider === "firebase" ? (
              <>
                <button
                  onClick={signInWithGoogleFirebase}
                  disabled={busy}
                  className="group inline-flex items-center justify-center gap-3 rounded-control border border-foreground bg-foreground px-6 py-3.5 font-mono text-[14px] uppercase tracking-document text-background transition-[transform,background-color] hover:-translate-y-[1px] hover:bg-foreground-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)] disabled:opacity-60"
                >
                  <GoogleGlyph />
                  {busy ? "Signing in…" : "Continue with Google"}
                </button>
                {error ? (
                  <p className="microprint mt-2" style={{ color: "var(--accent-dark)" }}>
                    {error}
                  </p>
                ) : null}
              </>
            ) : (
              <div
                role="note"
                className="rounded-control border border-dashed border-border-strong bg-surface-muted/60 px-4 py-3 font-sans text-[15px] leading-relaxed text-muted-strong"
              >
                <span className="microprint mb-1 block" style={{ color: "var(--accent-dark)" }}>
                  Sign-in not yet configured
                </span>
                Set{" "}
                <code className="font-mono text-[13px] text-foreground">
                  NEXT_PUBLIC_FIREBASE_API_KEY
                </code>{" "}
                and{" "}
                <code className="font-mono text-[13px] text-foreground">
                  NEXT_PUBLIC_FIREBASE_PROJECT_ID
                </code>{" "}
                in{" "}
                <code className="font-mono text-[13px] text-foreground">
                  .env.local
                </code>{" "}
                to enable Google sign-in.
              </div>
            )}

            {/* Not-legal-advice / attorney-of-record framing, kept visible near
                sign-up for this sensitive product. */}
            <div className="flex items-start justify-between gap-4">
              <p className="microprint max-w-[16rem] leading-relaxed" style={{ color: "var(--muted)" }}>
                Informational service only — not legal advice. An attorney of
                record reviews every petition before it is filed with USCIS.
              </p>
              <Stamp label="Bar-licensed" meta="On record · USCIS" tone="seal" rotate={4} />
            </div>
          </div>
        </section>
      </main>
    </PageFrame>
  );
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.8 6c1.9-5.6 7.1-9.8 13.7-9.8z"
      />
      <path
        fill="#4285F4"
        d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.1 5.3-4.6 7l7.1 5.5c4.2-3.9 6.6-9.6 6.6-17z"
      />
      <path
        fill="#FBBC05"
        d="M10.3 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.8-6C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.7l7.8-6z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.2 0 11.5-2 15.3-5.5l-7.1-5.5c-2 1.4-4.6 2.2-8.2 2.2-6.6 0-11.8-4.2-13.7-9.8l-7.8 6C6.4 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}
