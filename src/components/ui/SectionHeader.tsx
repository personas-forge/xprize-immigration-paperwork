import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
};

export function SectionHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-3",
        className,
      )}
    >
      <div className="max-w-3xl">
        {eyebrow ? (
          <div className="microprint mb-2" style={{ color: "var(--accent-dark)" }}>
            {eyebrow}
          </div>
        ) : null}
        <h2 className="display text-[clamp(2rem,5vw,3.4rem)] text-foreground">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-3 max-w-2xl font-sans text-[17.5px] leading-relaxed text-muted-strong">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
