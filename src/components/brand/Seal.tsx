import { type SVGProps } from "react";

/**
 * Engraved monogram seal — the brand mark. Concentric rings reference the
 * central security rosette on banknotes and the relief stamps used on visa
 * pages. The "IC" monogram is rendered in inline SVG so it inherits color
 * and scales without bitmap artifacts at any size.
 */
export function Seal({
  size = 56,
  monogram = "IC",
  ...rest
}: SVGProps<SVGSVGElement> & { size?: number; monogram?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden
      {...rest}
    >
      {/* outer engraved ring */}
      <circle
        cx="50"
        cy="50"
        r="47"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.6"
        opacity="0.85"
      />
      <circle
        cx="50"
        cy="50"
        r="44.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.4"
        opacity="0.55"
      />
      {/* notary tick marks around the rim */}
      {Array.from({ length: 36 }).map((_, i) => {
        const a = (i * 360) / 36;
        return (
          <line
            key={i}
            x1="50"
            y1="3.5"
            x2="50"
            y2={i % 3 === 0 ? "7.2" : "5.6"}
            stroke="currentColor"
            strokeWidth={i % 3 === 0 ? "0.6" : "0.35"}
            opacity={i % 3 === 0 ? "0.85" : "0.45"}
            transform={`rotate(${a} 50 50)`}
          />
        );
      })}
      {/* inner medallion */}
      <circle
        cx="50"
        cy="50"
        r="26"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.45"
        opacity="0.6"
      />
      {/* monogram */}
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--font-fraunces), Georgia, serif"
        fontSize="22"
        fontStyle="italic"
        fontWeight="500"
        fill="currentColor"
      >
        {monogram}
      </text>
    </svg>
  );
}
