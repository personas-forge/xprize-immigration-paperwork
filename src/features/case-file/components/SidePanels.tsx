import { Badge, Button, Card, CardBody, CardHeader } from "@/components/ui";
import { outstandingTasks, petitionExcerpt } from "../data";

export function TasksCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span aria-hidden>✓</span>
          Outstanding tasks
        </div>
        <Badge tone="accent">{outstandingTasks.length} open</Badge>
      </CardHeader>
      <CardBody className="space-y-2">
        {outstandingTasks.map((task) => (
          <div
            key={task.id}
            className="flex items-start justify-between gap-3 rounded-control bg-surface-muted px-3 py-2 text-sm"
          >
            <span className="text-foreground">{task.label}</span>
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
      <CardHeader className="border-accent/20">
        <div className="text-sm font-semibold text-foreground">
          Petition letter · §III.A
        </div>
        <span className="text-[11px] text-muted">Draft 3 · 14 min read</span>
      </CardHeader>
      <CardBody>
        <div className="rounded-control border border-accent/20 bg-surface p-3 font-mono text-[12px] leading-relaxed text-foreground/80">
          {petitionExcerpt}
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="secondary">
            Regenerate §III.A
          </Button>
          <Button size="sm" variant="primary">
            Send to attorney
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
