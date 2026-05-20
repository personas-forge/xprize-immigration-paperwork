import { Badge, Button, Card, CardBody } from "@/components/ui";
import { caseFacts } from "../data";
import { CriteriaTable } from "./CriteriaTable";
import { PetitionDraftCard, TasksCard } from "./SidePanels";

export function CaseFileDashboard() {
  return (
    <div className="px-8 py-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <Card>
          <CardBody className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-accent">
                <span
                  aria-hidden
                  className="grid h-5 w-5 place-items-center rounded-pill bg-accent-soft text-[10px] ring-1 ring-accent/20"
                >
                  ✦
                </span>
                Petitioner · Case O1-241
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                Dr. Anya Krishnan
              </div>
              <div className="text-sm text-muted">
                Senior Research Engineer · India → US (O-1A)
              </div>
            </div>
            <div className="flex items-center gap-6">
              {caseFacts.map((fact) => (
                <div key={fact.label} className="text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    {fact.label}
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {fact.value}
                  </div>
                </div>
              ))}
              <Button variant="primary">Open petition letter</Button>
            </div>
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <CriteriaTable />
          </div>
          <div className="space-y-5 lg:col-span-4">
            <TasksCard />
            <PetitionDraftCard />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted">
          <Badge tone="success">92% approval likelihood</Badge>
          <Badge tone="neutral">$2,500 flat fee</Badge>
          <Badge tone="neutral">USCIS premium $2,805 passthrough</Badge>
        </div>
      </div>
    </div>
  );
}
