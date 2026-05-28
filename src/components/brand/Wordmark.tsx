import Link from "next/link";
import { Seal } from "./Seal";

/**
 * The product wordmark — engraved seal next to a two-line lockup. Used in
 * page headers and the dashboard top bar. Kept presentational; pure HTML.
 */
export function Wordmark({
  href = "/",
  size = 36,
  context,
}: {
  href?: string;
  size?: number;
  context?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 text-foreground"
      aria-label="Immigration Concierge"
    >
      <span className="text-foreground transition-transform duration-500 group-hover:rotate-[8deg]">
        <Seal size={size} />
      </span>
      <span className="leading-tight">
        <span className="display block text-[1.05rem] tracking-tight">
          Immigration <em className="italic">Concierge</em>
        </span>
        <span className="microprint mt-0.5 block">
          {context ?? "Atelier · est. 2026"}
        </span>
      </span>
    </Link>
  );
}
