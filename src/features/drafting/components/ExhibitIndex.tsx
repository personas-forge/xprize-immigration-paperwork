import { Badge } from "@/components/ui";

/**
 * Auto-generated exhibit index + citation-integrity meter (moonshots #10/#21).
 * Lists every vault exhibit on file, marks which the letter/RFE cites, and
 * quarantines any `(Exhibit N)` citation with no matching document — the "you
 * can never ship a letter that cites evidence you don't have" guarantee made
 * visible. Shared by the Drafting Studio and the RFE responder.
 */
export function ExhibitIndex({
  entries,
  citedNumbers,
  unresolved,
  coverage,
}: {
  entries: readonly { number: number; name: string }[];
  citedNumbers: ReadonlySet<number>;
  unresolved: readonly number[];
  coverage: number;
}) {
  const pct = Math.round(coverage * 100);
  return (
    <div className="rounded-control border border-accent/25 bg-surface px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="microprint" style={{ color: "var(--accent-dark)" }}>
          Exhibit index · citation integrity
        </span>
        <Badge tone={unresolved.length > 0 ? "danger" : "accent"}>
          {citedNumbers.size}/{entries.length} exhibits cited · {pct}%
        </Badge>
      </div>

      {unresolved.length > 0 ? (
        <div
          role="alert"
          className="mb-3 rounded-control border-2 border-double border-seal/50 bg-seal-soft/40 px-3 py-2"
        >
          <span className="microprint" style={{ color: "var(--seal)" }}>
            Unsupported citation — attorney must verify
          </span>
          <p className="mt-1 font-sans text-[14.5px] leading-snug text-foreground-soft">
            This cites {unresolved.map((n) => `Exhibit ${n}`).join(", ")}, which{" "}
            {unresolved.length === 1 ? "has" : "have"} no matching document in the
            vault. Remove the citation or add the exhibit before filing.
          </p>
        </div>
      ) : null}

      <ol className="space-y-1.5">
        {entries.map((e) => {
          const cited = citedNumbers.has(e.number);
          return (
            <li key={e.number} className="flex items-baseline gap-3">
              <span className="doc-number text-[12px] text-muted">Ex. {e.number}</span>
              <span className="font-sans text-[15px] text-foreground-soft">{e.name}</span>
              <span
                className="microprint ml-auto"
                style={{ color: cited ? "var(--accent-dark)" : "var(--muted)" }}
              >
                {cited ? "cited" : "not cited"}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
