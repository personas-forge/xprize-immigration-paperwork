import { cn } from "@/lib/cn";
import { Card } from "./Card";

export type StatTone = "neutral" | "up" | "down" | "accent";

const deltaClass: Record<StatTone, string> = {
  neutral: "text-muted",
  up: "text-success",
  down: "text-danger",
  accent: "text-accent",
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
    <Card className={cn("p-5", className)}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </div>
      <div
        className={cn(
          "mt-2 text-2xl tabular-nums text-foreground",
          mono && "font-mono"
        )}
      >
        {value}
      </div>
      {delta ? (
        <div className={cn("mt-1 text-xs", deltaClass[tone])}>{delta}</div>
      ) : null}
    </Card>
  );
}
