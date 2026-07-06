"use client";

// First-auth consent / registration — re-skinned to the Atelier of Arrival
// identity. Load-bearing parts are unchanged: the field names (full_name,
// terms, privacy, marketing) match the server action, and terms+privacy are
// required. Every colour is a semantic token, so it renders correctly in BOTH
// the parchment and ink themes.
//
// SENSITIVE PRODUCT: the UPL / not-legal-advice / attorney-of-record disclaimer
// renders prominently near sign-up via the shared DisclaimerStamp component.

import { useActionState, useEffect, useId, useRef } from "react";
import { submitConsent, type ConsentState } from "@/app/welcome/actions";
import { CONSENT_FIELDS } from "@/lib/auth/consent";
import { CONSENT_DISCLAIMER } from "@/lib/result";
import { DisclaimerStamp } from "@/components/legal";

export function ConsentForm({
  defaultName,
  email,
  next,
}: {
  defaultName: string;
  email: string | null;
  /** Validated deep-link destination to forward to after consent. */
  next?: string;
}) {
  const [state, action, pending] = useActionState<ConsentState, FormData>(
    submitConsent,
    {},
  );

  // Synchronous double-submit guard: the consents table is append-only, so two
  // submits before `pending` commits would write TWO consent rows for one
  // acceptance (consent #4). On success the action redirects (never returns, so
  // the form stays disabled through navigation); on an error return we reset the
  // guard so the user can correct and resubmit.
  const submittedRef = useRef(false);
  useEffect(() => {
    if (state.error) submittedRef.current = false;
  }, [state.error]);

  // The single shared error can be caused by full_name OR either required
  // checkbox (see @/app/welcome/actions) — no per-field message exists, so
  // all three point aria-invalid/aria-describedby at the one banner.
  const errorId = useId();
  const invalid = Boolean(state.error);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (submittedRef.current) {
          e.preventDefault();
          return;
        }
        submittedRef.current = true;
      }}
      className="space-y-7"
    >
      {/* Carry the (already-validated) deep-link destination through consent;
          the server action re-validates it before redirecting. */}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {/* Attorney-of-record / not-legal-advice safeguard, visible at sign-up. */}
      <DisclaimerStamp text={CONSENT_DISCLAIMER} />

      <div className="space-y-2">
        <label
          htmlFor="full_name"
          className="microprint block"
          style={{ color: "var(--accent-dark)" }}
        >
          Full legal name
        </label>
        <input
          id="full_name"
          name={CONSENT_FIELDS.fullName}
          defaultValue={defaultName}
          required
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
          className="w-full rounded-control border border-border-strong bg-surface px-3.5 py-2.5 font-sans text-[17px] text-foreground placeholder:text-muted focus-visible:border-accent-dark focus-ring"
        />
        {email && (
          <p className="microprint" style={{ color: "var(--muted)" }}>
            Signed in as <span className="doc-number text-foreground">{email}</span>
          </p>
        )}
      </div>

      <div className="perforation h-px" aria-hidden />

      <fieldset className="space-y-3.5">
        <legend className="microprint mb-1" style={{ color: "var(--muted-strong)" }}>
          Consent &amp; agreements
        </legend>
        {/* The documents being accepted must be READABLE from here — links sit
            outside the <label>s so opening one can't toggle a checkbox. */}
        <p className="font-sans text-[15px] text-muted-strong">
          Read the{" "}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="ink-link focus-ring">
            Terms of Service
          </a>{" "}
          and the{" "}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="ink-link focus-ring">
            Privacy Policy
          </a>{" "}
          (each opens in a new tab).
        </p>
        <Checkbox
          name={CONSENT_FIELDS.terms}
          required
          label="I accept the Terms of Service."
          invalid={invalid}
          describedBy={invalid ? errorId : undefined}
        />
        <Checkbox
          name={CONSENT_FIELDS.privacy}
          required
          label="I have read and accept the Privacy Policy."
          invalid={invalid}
          describedBy={invalid ? errorId : undefined}
        />
        <Checkbox
          name={CONSENT_FIELDS.marketing}
          label="Send me occasional product updates (optional)."
        />
      </fieldset>

      {state.error && (
        <p
          id={errorId}
          role="alert"
          className="rounded-control border border-seal/40 bg-seal-soft/50 px-3.5 py-2.5 font-sans text-[15px] text-seal"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-control bg-seal px-6 py-3.5 font-mono text-[14px] uppercase tracking-document text-background shadow-seal transition-transform hover:-translate-y-[1px] focus-ring disabled:opacity-60"
      >
        {pending ? "Stamping…" : "Agree & open my case file"}
        <span aria-hidden>→</span>
      </button>
    </form>
  );
}

function Checkbox({
  name,
  label,
  required,
  invalid,
  describedBy,
}: {
  name: string;
  label: string;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <label className="flex items-start gap-3 font-sans text-[16px] text-foreground-soft">
      <input
        type="checkbox"
        name={name}
        required={required}
        aria-required={required}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className="mt-1 h-4 w-4 shrink-0 rounded-[2px] border-border-strong text-accent-dark accent-[color:var(--accent-dark)] focus-ring"
      />
      <span className="leading-snug">
        {label}
        {required ? (
          <>
            {/* The "*" is visual-only; the sr-only "(required)" puts the
                requirement into the accessible name for screen-reader users. */}
            <span aria-hidden className="ml-1 text-seal">
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        ) : null}
      </span>
    </label>
  );
}
