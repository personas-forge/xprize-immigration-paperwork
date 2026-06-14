import { cn } from "@/lib/cn";
import { Card } from "./Card";

export type StatTone = "neutral" | "up" | "down" | "accent";

const deltaClass: Record<StatTone, string> = {
  neutral: "text-muted-strong",
  up: "text-success",
  down: "text-danger",
  accent: "text-accent-dark",
};

type StatCardProps = {
  label: string;
  value: string;
  delta?: string;
  tone?: StatTone;
  mono?: boolean;
  className?: string;
};

export function StatCard({
  label,
  value,
  delta,
  tone = "neutral",
  mono = true,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("p-5 lift", className)}>
      <div className="microprint">{label}</div>
      <div
        className={cn(
          "mt-3 text-[2rem] leading-none text-foreground",
          mono ? "doc-number" : "display",
        )}
      >
        {value}
      </div>
      {delta ? (
        <div className={cn("mt-2 font-mono text-[13px] uppercase tracking-document", deltaClass[tone])}>
          {delta}
        </div>
      ) : null}
    </Card>
  );
}
