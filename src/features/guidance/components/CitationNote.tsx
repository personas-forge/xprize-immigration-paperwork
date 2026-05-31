/**
 * Attorney-facing reminder to verify the legal citations in an AI-generated
 * letter. Drafts cite the governing statute/regulation (case law is disallowed
 * by the prompt), but a model can still cite the wrong section — so the attorney
 * of record must confirm each one before filing. Rendered alongside the
 * not-legal-advice DisclaimerStamp on draft / RFE output.
 */
export function CitationNote() {
  return (
    <div
      role="note"
      aria-label="Citation verification reminder"
      className="flex items-start gap-3 rounded-control border border-accent/35 bg-accent-soft/30 px-4 py-2.5"
    >
      <span
        aria-hidden
        className="mt-[1px] shrink-0 font-mono text-[9px] font-semibold uppercase leading-tight tracking-document text-accent-dark"
      >
        Verify
        <br />
        cites
      </span>
      <span className="block h-auto w-px self-stretch bg-accent/25" aria-hidden />
      <p className="font-sans text-[12.5px] leading-snug text-muted-strong">
        Confirm every statutory and regulatory citation (e.g. INA / 8 C.F.R.
        sections) against the current code before filing — generated text can
        reference the wrong provision. The attorney of record adds and verifies
        all legal authorities.
      </p>
    </div>
  );
}
