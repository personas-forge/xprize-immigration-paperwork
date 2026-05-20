import Link from "next/link";
import { type ReactNode } from "react";

type DashboardTopBarProps = {
  glyph: string;
  product: string;
  context: string;
  actions?: ReactNode;
};

// Thin app chrome shared by every dashboard route. Kept presentational so it
// can move into a shared layout once more routes exist.
export function DashboardTopBar({
  glyph,
  product,
  context,
  actions,
}: DashboardTopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
      <div className="flex items-center justify-between px-8 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="grid h-8 w-8 place-items-center rounded-control bg-foreground text-sm text-background"
            aria-label={product}
          >
            {glyph}
          </Link>
          <div>
            <div className="text-sm font-semibold text-foreground">{product}</div>
            <div className="text-[11px] text-muted">{context}</div>
          </div>
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
