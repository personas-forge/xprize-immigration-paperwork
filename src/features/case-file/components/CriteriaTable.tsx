import { Badge, Card, CardHeader } from "@/components/ui";
import { QUALIFYING_THRESHOLD, statusTone, summarizeCriteria } from "../criteria";
import { criteria } from "../data";

export function CriteriaTable() {
  const summary = summarizeCriteria(criteria);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-accent-soft">
        <div>
          <div className="text-sm font-semibold text-foreground">
            O-1A Criteria · {summary.total} of {criteria.length} evaluated
          </div>
          <div className="text-xs text-muted">
            Need {QUALIFYING_THRESHOLD} to qualify. AI-scored from CV + evidence vault.
          </div>
        </div>
        <Badge tone={summary.meetsThreshold ? "success" : "warning"}>
          {summary.qualifying} strong · {summary.partial} partial
        </Badge>
      </CardHeader>

      <table className="w-full text-sm">
        <thead className="bg-surface-muted text-left text-[11px] uppercase tracking-wider text-muted">
          <tr>
            <th className="px-5 py-2 font-semibold">Criterion</th>
            <th className="px-5 py-2 font-semibold">Status</th>
            <th className="px-5 py-2 font-semibold">Evidence</th>
            <th className="px-5 py-2 text-right font-semibold">Exhibits</th>
          </tr>
        </thead>
        <tbody>
          {criteria.map((c) => (
            <tr key={c.id} className="border-t border-border hover:bg-accent-soft/40">
              <td className="px-5 py-3 font-medium text-foreground">{c.name}</td>
              <td className="px-5 py-3">
                <Badge tone={statusTone(c.status)}>{c.status}</Badge>
              </td>
              <td className="px-5 py-3 text-muted">{c.evidence}</td>
              <td className="px-5 py-3 text-right font-mono text-xs text-muted">
                {c.exhibit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
