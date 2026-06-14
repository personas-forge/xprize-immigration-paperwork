import { Card, CardBody } from "@/components/ui";
import { caseRoadmap, type StageState } from "../roadmap";

// — Client roadmap ────────────────────────────────────────────────────────────
// The case's "what's done / what's next" progress stepper, derived purely from
// status + whether evidence/draft exist. Read-only and reassuring — the client
// portal view of where the petition stands.

const DOT: Record<StageState, string> = {
  done: "bg-accent border-accent text-[color:var(--accent-foreground)]",
  current:
    "bg-surface border-accent text-accent-dark ring-2 ring-[color:var(--accent)]/30",
  upcoming: "bg-surface border-border-strong text-muted",
};

const LABEL: Record<StageState, string> = {
  done: "text-foreground",
  current: "text-foreground",
  upcoming: "text-muted",
};

export function RoadmapStepper({
  status,
  hasEvidence,
  hasDraft,
}: {
  status: string;
  hasEvidence: boolean;
  hasDraft: boolean;
}) {
  const stages = caseRoadmap(status, { hasEvidence, hasDraft });

  return (
    <Card>
      <CardBody>
        <div className="microprint mb-3" style={{ color: "var(--accent-dark)" }}>
          § — Roadmap · where your petition stands
        </div>
        <ol className="flex flex-wrap items-center gap-y-3">
          {stages.map((s, i) => (
            <li key={s.key} className="flex items-center">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[12px] ${DOT[s.state]}`}
                >
                  {s.state === "done" ? "✓" : s.state === "current" ? "•" : ""}
                </span>
                <span
                  className={`font-mono text-[12.5px] uppercase tracking-document ${LABEL[s.state]}`}
                >
                  {s.label}
                </span>
              </div>
              {i < stages.length - 1 ? (
                <span aria-hidden className="mx-2 hidden h-px w-6 bg-rule sm:block" />
              ) : null}
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  );
}
