import { Badge, Card, CardHeader } from "@/components/ui";
import { QUALIFYING_THRESHOLD, statusTone, summarizeCriteria } from "../criteria";
import { criteria } from "../data";

export function CriteriaTable() {
  const summary = summarizeCriteria(criteria);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-surface-muted/60">
        <div>
          <div className="microprint" style={{ color: "var(--accent-dark)" }}>
            § II — O-1A Criteria
          </div>
          <div className="display mt-1 text-[18px]">
            {summary.total} of {criteria.length} evaluated
            <span className="font-sans text-[13px] italic text-muted-strong">
              {" "}— need {QUALIFYING_THRESHOLD} to qualify, AI-scored from CV + evidence vault.
            </span>
          </div>
        </div>
        <Badge tone={summary.meetsThreshold ? "success" : "warning"}>
          {summary.qualifying} strong · {summary.partial} partial
        </Badge>
      </CardHeader>

      <table className="w-full text-sm">
        <thead className="bg-background-tint/40 text-left">
          <tr>
            <th className="px-5 py-3 microprint font-medium">Criterion</th>
            <th className="px-5 py-3 microprint font-medium">Status</th>
            <th className="px-5 py-3 microprint font-medium">Evidence</th>
            <th className="px-5 py-3 microprint text-right font-medium">Ex.</th>
          </tr>
        </thead>
        <tbody>
          {criteria.map((c, i) => (
            <tr
              key={c.id}
              className="border-t border-dotted border-rule transition-[background-color] duration-200 hover:bg-accent-soft/35"
            >
              <td className="px-5 py-3.5">
                <div className="flex items-baseline gap-3">
                  <span className="doc-number text-[10px] text-muted">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-sans text-[14.5px] text-foreground">
                    {c.name}
                  </span>
                </div>
              </td>
              <td className="px-5 py-3.5">
                <Badge tone={statusTone(c.status)}>{c.status}</Badge>
              </td>
              <td className="px-5 py-3.5 font-sans text-[13.5px] italic text-muted-strong">
                {c.evidence}
              </td>
              <td className="px-5 py-3.5 text-right doc-number text-[11px] text-muted">
                {c.exhibit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
