/**
 * The not-legal-advice disclaimer, rendered as a prominent bordeaux (seal)
 * rubber-stamp block. This component is the single place the UPL safeguard
 * surfaces; it MUST render on every AI guidance output. It is NOT aria-hidden
 * (unlike the decorative Stamp ornament) — the disclaimer must be read by
 * assistive tech.
 */
export function DisclaimerStamp({ text }: { text: string }) {
  return (
    <div
      role="note"
      aria-label="Legal disclaimer"
      className="relative flex items-start gap-3 rounded-control border-2 border-double border-seal bg-seal-soft/50 px-4 py-3 text-seal"
      style={{ transform: "rotate(-0.6deg)" }}
    >
      <span
        aria-hidden
        className="mt-[1px] shrink-0 font-mono text-[11px] font-semibold uppercase leading-tight tracking-document"
      >
        Not
        <br />
        legal
        <br />
        advice
      </span>
      <span className="block h-auto w-px self-stretch bg-seal/30" aria-hidden />
      <p className="font-sans text-[14.5px] leading-snug text-seal">{text}</p>
    </div>
  );
}
