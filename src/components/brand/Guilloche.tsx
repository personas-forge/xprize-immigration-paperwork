import { type SVGProps } from "react";

/**
 * Inline-SVG guilloché rosette — the security pattern used on banknotes,
 * passports, and engraved certificates. Layered Lissajous curves produced
 * by parametric equations, drawn at low stroke-width. Pointer-events-none,
 * aria-hidden — purely decorative atmosphere.
 *
 * Pre-computed at module load (no JS at runtime); inherits currentColor.
 */
export function Guilloche({
  size = 320,
  rings = 7,
  ...rest
}: SVGProps<SVGSVGElement> & { size?: number; rings?: number }) {
  const center = 200;
  const radius = 180;
  const samples = 600;

  const paths: string[] = [];
  for (let r = 0; r < rings; r++) {
    const a = 3 + r * 0.7;
    const b = 4 + r * 0.9;
    const A = radius * (0.42 + r * 0.07);
    const B = radius * (0.46 + r * 0.06);
    const phase = (r * Math.PI) / 7;
    let d = "";
    for (let i = 0; i <= samples; i++) {
      const t = (i / samples) * Math.PI * 2;
      const x = center + A * Math.cos(a * t + phase);
      const y = center + B * Math.sin(b * t);
      d += i === 0 ? `M${x.toFixed(2)} ${y.toFixed(2)}` : `L${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    paths.push(d);
  }

  return (
    <svg
      viewBox="0 0 400 400"
      width={size}
      height={size}
      aria-hidden
      {...rest}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="0.45"
        strokeLinejoin="round"
        opacity="0.55"
      >
        {paths.map((d, i) => (
          <path key={i} d={d} opacity={0.35 + (i / paths.length) * 0.4} />
        ))}
      </g>
    </svg>
  );
}
