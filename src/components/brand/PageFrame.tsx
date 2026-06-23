import { type ReactNode } from "react";
import { Guilloche } from "./Guilloche";

/**
 * Page frame — places guilloché watermarks in the top-right and bottom-left
 * corners of the viewport, fixed and pointer-events-none.
 *
 * Pure CSS / inline SVG (no canvas, no JS), all decorative layers behind
 * content with z-0. Children render in normal flow.
 */
export function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* corner watermarks — purely atmospheric */}
      <div
        aria-hidden
        className="pointer-events-none fixed -right-32 -top-32 z-0 text-accent-dark opacity-[0.12]"
      >
        <Guilloche size={520} rings={9} />
      </div>
      <div
        aria-hidden
        className="pointer-events-none fixed -bottom-40 -left-40 z-0 text-seal opacity-[0.08]"
      >
        <Guilloche size={460} rings={7} />
      </div>

      {/* faint vertical perforations down both edges of wide screens */}
      <div
        aria-hidden
        className="perforation-y pointer-events-none fixed left-6 top-0 z-0 hidden h-full w-px lg:block"
      />
      <div
        aria-hidden
        className="perforation-y pointer-events-none fixed right-6 top-0 z-0 hidden h-full w-px lg:block"
      />

      <div className="relative z-10">{children}</div>
    </div>
  );
}
