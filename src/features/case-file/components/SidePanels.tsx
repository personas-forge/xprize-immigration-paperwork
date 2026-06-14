"use client";

import { Badge, Button, Card, CardBody, CardHeader, Skeleton } from "@/components/ui";
import { type CaseTask } from "../types";

export function TasksCard({ tasks }: { tasks: readonly CaseTask[] | null }) {
  return (
    <Card>
      <CardHeader>
        <div className="microprint" style={{ color: "var(--accent-dark)" }}>
          § III — Outstanding tasks
        </div>
        <Badge tone="accent">{tasks?.length ?? 0} open</Badge>
      </CardHeader>
      <CardBody className="space-y-1">
        {tasks === null ? (
          <div className="space-y-2 py-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <p className="py-3 font-sans text-[16px] italic text-muted-strong">
            No outstanding tasks — the file is clear.
          </p>
        ) : (
          tasks.map((task, i) => (
            <div
              key={task.id}
              className="flex items-baseline justify-between gap-3 border-b border-dotted border-rule py-2.5 last:border-b-0"
            >
              <div className="flex items-baseline gap-3">
                <span className="doc-number text-[12px] text-muted">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-sans text-[16px] text-foreground">
                  {task.label}
                </span>
              </div>
              <Badge tone="neutral">{task.owner}</Badge>
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}

export function PetitionDraftCard({ excerpt }: { excerpt: string | null }) {
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
          {excerpt === null ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            <p className="font-sans text-[15.5px] leading-[1.7] text-foreground-soft initial">
              {excerpt}
            </p>
          )}
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
