import { Badge, Button, Card, CardBody, CardHeader } from "@/components/ui";
import { outstandingTasks, petitionExcerpt } from "../data";

export function TasksCard() {
  return (
    <Card>
      <CardHeader>
        <div className="microprint" style={{ color: "var(--accent-dark)" }}>
          § III — Outstanding tasks
        </div>
        <Badge tone="accent">{outstandingTasks.length} open</Badge>
      </CardHeader>
      <CardBody className="space-y-1">
        {outstandingTasks.map((task, i) => (
          <div
            key={task.id}
            className="flex items-baseline justify-between gap-3 border-b border-dotted border-rule py-2.5 last:border-b-0"
          >
            <div className="flex items-baseline gap-3">
              <span className="doc-number text-[10px] text-muted">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-sans text-[14px] text-foreground">
                {task.label}
              </span>
            </div>
            <Badge tone="neutral">{task.owner}</Badge>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

export function PetitionDraftCard() {
  return (
    <Card tone="accent">
      <CardHeader className="border-accent/30 bg-accent-soft/40">
        <div className="microprint" style={{ color: "var(--accent-dark)" }}>
          § IV — Petition letter · §III.A
        </div>
        <span className="microprint" style={{ color: "var(--muted)" }}>
          Draft 3 · 14 min read
        </span>
      </CardHeader>
      <CardBody>
        {/* The excerpt is rendered as a fragment of the petition itself —
            ruled top + bottom margins, italic body, dropped initial.       */}
        <div className="relative rounded-control border border-accent/30 bg-surface px-5 py-4">
          <div className="absolute inset-x-0 top-0 perforation h-px" aria-hidden />
          <p className="font-sans text-[13.5px] leading-[1.7] text-foreground-soft initial">
            {petitionExcerpt}
          </p>
          <div className="absolute inset-x-0 bottom-0 perforation h-px" aria-hidden />
        </div>
        <div className="mt-4 flex gap-2">
          <Button size="sm" variant="secondary">
            Regenerate §III.A
          </Button>
          <Button size="sm" variant="seal">
            Send to attorney
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
