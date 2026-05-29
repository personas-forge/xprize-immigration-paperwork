"use client";

// First-auth consent / registration — re-skinned to the Atelier of Arrival
// identity. Load-bearing parts are unchanged: the field names (full_name,
// terms, privacy, marketing) match the server action, and terms+privacy are
// required. Every colour is a semantic token, so it renders correctly in BOTH
// the parchment and ink themes.
//
// SENSITIVE PRODUCT: the UPL / not-legal-advice / attorney-of-record disclaimer
// renders prominently near sign-up via the shared DisclaimerStamp component.

import { useActionState } from "react";
import { submitConsent, type ConsentState } from "@/app/welcome/actions";
import { DisclaimerStamp } from "@/features/guidance/components/DisclaimerStamp";

const ATTORNEY_DISCLAIMER =
  "Creating an account does not form an attorney–client relationship and is " +
  "not legal advice. Immigration law is fact-specific; an attorney of record " +
  "licensed to practice law reviews and signs every petition before anything " +
  "is filed with USCIS.";

export function ConsentForm({
  defaultName,
  email,
}: {
  defaultName: string;
  email: string | null;
}) {
  const [state, action, pending] = useActionState<ConsentState, FormData>(
    submitConsent,
    {},
  );

  return (
    <form action={action} className="space-y-7">
      {/* Attorney-of-record / not-legal-advice safeguard, visible at sign-up. */}
      <DisclaimerStamp text={ATTORNEY_DISCLAIMER} />

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
          name="full_name"
          defaultValue={defaultName}
          required
          className="w-full rounded-control border border-border-strong bg-surface px-3.5 py-2.5 font-sans text-[15px] text-foreground placeholder:text-muted focus-visible:border-accent-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
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
        <Checkbox
          name="terms"
          required
          label="I accept the Terms of Service."
        />
        <Checkbox
          name="privacy"
          required
          label="I have read and accept the Privacy Policy."
        />
        <Checkbox
          name="marketing"
          label="Send me occasional product updates (optional)."
        />
      </fieldset>

      {state.error && (
        <p
          role="alert"
          className="rounded-control border border-seal/40 bg-seal-soft/50 px-3.5 py-2.5 font-sans text-[13px] text-seal"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-control bg-seal px-6 py-3.5 font-mono text-[12px] uppercase tracking-document text-background shadow-seal transition-transform hover:-translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40 disabled:opacity-60"
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
}: {
  name: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label className="flex items-start gap-3 font-sans text-[14px] text-foreground-soft">
      <input
        type="checkbox"
        name={name}
        required={required}
        className="mt-1 h-4 w-4 shrink-0 rounded-[2px] border-border-strong text-accent-dark accent-[color:var(--accent-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
      />
      <span className="leading-snug">
        {label}
        {required ? (
          <span aria-hidden className="ml-1 text-seal">
            *
          </span>
        ) : null}
      </span>
    </label>
  );
}
