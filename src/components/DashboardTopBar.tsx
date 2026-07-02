import { type ReactNode } from "react";
import Image from "next/image";
import { Wordmark } from "./brand/Wordmark";

type DashboardTopBarProps = {
  product: string;
  context: string;
  actions?: ReactNode;
};

// Document-style app chrome: an engraved seal lockup on the left, the case
// reference set in monospace on the right, perforated baseline rule under
// the bar — every dashboard page sits on this masthead.
//
// The translucent backdrop-blur is gated behind Tailwind's `motion-safe:`
// variant (-> @media (prefers-reduced-motion: no-preference)) so users who
// request reduced motion get a fully opaque header (bg-surface/95) with no
// backdrop-filter, avoiding the blur-induced motion/transparency effect.
export function DashboardTopBar({
  product: _product,
  context,
  actions,
}: DashboardTopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 motion-safe:backdrop-blur">
      <div className="flex items-center justify-between gap-6 px-8 py-4">
        <div className="flex items-center gap-3">
          <Image
            src="/brand/logo.png"
            alt="Immigration Concierge"
            width={28}
            height={28}
            className="h-7 w-7 rounded-full"
            priority
          />
          <Wordmark context="Petition Atelier" size={32} />
        </div>

        <div className="hidden flex-1 items-center justify-center md:flex">
          <div className="inline-flex items-baseline gap-3 rounded-control border border-border-strong bg-surface-muted/60 px-4 py-1.5">
            <span className="microprint" style={{ color: "var(--muted)" }}>
              Active file
            </span>
            <span className="doc-number text-[14px] text-foreground">{context}</span>
          </div>
        </div>

        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      <div className="perforation mx-8 h-px" aria-hidden />
    </header>
  );
}
