"use client";

import {
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBarChart,
  RadialBar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  LabelList,
  Tooltip,
} from "recharts";
import { CHART_FONT, type Palette } from "./palette";
import { useThemePalette } from "./useThemePalette";
import { ClientOnly } from "./ClientOnly";
import { FIRM_FEE } from "@/lib/site";
import { bundlePriceLabel, featuredBundle } from "@/lib/tokens/economy";

// ── Themed Recharts set for the landing ─────────────────────────────────────
// Every chart is dressed to read as a piece of the engraved-document system:
// parchment/ink ground, gold-leaf data, one bordeaux accent. Colors come from
// useThemePalette() (concrete hex — SVG attributes can't take CSS vars), so the
// charts re-skin live when the parchment/ink theme is toggled. Fonts route
// through the mono stack so ticks look like microprint. All values are clearly
// labelled illustrative — this is regulated-adjacent.

function tooltipStyle(p: Palette) {
  return {
    background: p.surface,
    border: `1px solid ${p.borderStrong}`,
    borderRadius: 4,
    fontFamily: CHART_FONT,
    fontSize: 12,
    color: p.foreground,
    boxShadow: "0 12px 28px -16px rgba(13,31,45,0.4)",
  } as const;
}

function ChartSkeleton({ h }: { h: number }) {
  return (
    <div
      aria-hidden
      className="skeleton-shimmer w-full rounded-card"
      style={{ height: h }}
    />
  );
}

/* ── 1 · Criteria coverage radar ─────────────────────────────────────────── */
// "You need 3 of 8 — here's how a strong record spreads across them."
const RADAR_DATA = [
  { k: "Awards", you: 84, bar: 50 },
  { k: "Membership", you: 58, bar: 50 },
  { k: "Press", you: 92, bar: 50 },
  { k: "Judging", you: 70, bar: 50 },
  { k: "Original work", you: 82, bar: 50 },
  { k: "Scholarship", you: 95, bar: 50 },
  { k: "Leading role", you: 56, bar: 50 },
  { k: "High pay", you: 66, bar: 50 },
];

export function CriteriaRadar({ height = 340 }: { height?: number }) {
  const P = useThemePalette();
  return (
    <ClientOnly fallback={<ChartSkeleton h={height} />}>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <RadarChart data={RADAR_DATA} outerRadius="72%">
            <PolarGrid stroke={P.borderStrong} strokeOpacity={0.6} />
            <PolarAngleAxis
              dataKey="k"
              tick={{ fill: P.mutedStrong, fontSize: 11, fontFamily: CHART_FONT }}
            />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              name="Evidentiary bar"
              dataKey="bar"
              stroke={P.seal}
              strokeWidth={1.2}
              strokeDasharray="4 4"
              fill="none"
              isAnimationActive
            />
            <Radar
              name="A strong record"
              dataKey="you"
              stroke={P.accentDark}
              strokeWidth={1.8}
              fill={P.accent}
              fillOpacity={0.22}
              isAnimationActive
              animationDuration={1100}
            />
            <Tooltip contentStyle={tooltipStyle(P)} cursor={{ stroke: P.rule }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </ClientOnly>
  );
}

/* ── 2 · Cost comparison ─────────────────────────────────────────────────── */
// Firm packet vs the featured bundle. The point is the gulf — yours is a sliver.
// Both bars derive from the single sources (FIRM_FEE, featuredBundle()) so the
// chart can't quote a stale firm fee or bundle price the rest of the page has
// moved on from, and it highlights the SAME bundle the pricing grid stamps "Best
// value" (featured is a permanent catalog property, so the lookup resolves).
const FEATURED_BUNDLE = featuredBundle()!;
const COST_DATA = [
  {
    name: "Law-firm packet",
    value: FIRM_FEE.midpointUsd,
    label: `${FIRM_FEE.range} ${FIRM_FEE.verb}d`,
  },
  {
    name: `Your draft · ${FEATURED_BUNDLE.label} bundle`,
    value: Math.round(FEATURED_BUNDLE.priceCents / 100),
    label: `${bundlePriceLabel(FEATURED_BUNDLE)} · ${FEATURED_BUNDLE.tokens.toLocaleString("en-US")} tokens`,
  },
];

export function CostCompareBars({ height = 220 }: { height?: number }) {
  const P = useThemePalette();
  const fills = [P.seal, P.accentDark];
  return (
    <ClientOnly fallback={<ChartSkeleton h={height} />}>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <BarChart
            data={COST_DATA}
            layout="vertical"
            margin={{ top: 8, right: 150, bottom: 8, left: 8 }}
            barCategoryGap={28}
          >
            <XAxis type="number" hide domain={[0, 13000]} />
            <YAxis
              type="category"
              dataKey="name"
              width={150}
              tickLine={false}
              axisLine={{ stroke: P.borderStrong }}
              tick={{ fill: P.foregroundSoft, fontSize: 12, fontFamily: CHART_FONT }}
            />
            <Bar dataKey="value" radius={[0, 3, 3, 0]} barSize={26} isAnimationActive animationDuration={1100} minPointSize={4}>
              {COST_DATA.map((d, i) => (
                <Cell key={d.name} fill={fills[i]} />
              ))}
              <LabelList
                dataKey="label"
                position="right"
                style={{ fill: P.mutedStrong, fontSize: 12, fontFamily: CHART_FONT }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ClientOnly>
  );
}

/* ── 3 · Approval-likelihood gauge ───────────────────────────────────────── */
export function ApprovalGauge({
  value = 92,
  height = 220,
}: {
  value?: number;
  height?: number;
}) {
  const P = useThemePalette();
  const data = [{ name: "likelihood", value }];
  return (
    <ClientOnly fallback={<ChartSkeleton h={height} />}>
      <div style={{ position: "relative", width: "100%", height }}>
        <ResponsiveContainer>
          <RadialBarChart
            data={data}
            startAngle={220}
            endAngle={-40}
            innerRadius="68%"
            outerRadius="100%"
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar
              background={{ fill: P.surfaceMuted }}
              dataKey="value"
              cornerRadius={8}
              fill={P.success}
              isAnimationActive
              animationDuration={1200}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="display text-5xl text-foreground">{value}%</span>
          <span className="microprint mt-1" style={{ color: P.mutedStrong }}>
            illustrative
          </span>
        </div>
      </div>
    </ClientOnly>
  );
}

/* ── 4 · Path-to-decision timeline ───────────────────────────────────────── */
const TIMELINE_DATA = [
  { stage: "AI draft", days: 1 },
  { stage: "Attorney review", days: 3 },
  { stage: "USCIS premium", days: 15 },
];

export function ProcessTimeline({ height = 220 }: { height?: number }) {
  const P = useThemePalette();
  const fills = [P.accent, P.accentDark, P.seal];
  return (
    <ClientOnly fallback={<ChartSkeleton h={height} />}>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <BarChart
            data={TIMELINE_DATA}
            layout="vertical"
            margin={{ top: 8, right: 56, bottom: 8, left: 8 }}
            barCategoryGap={20}
          >
            <XAxis type="number" hide domain={[0, 18]} />
            <YAxis
              type="category"
              dataKey="stage"
              width={130}
              tickLine={false}
              axisLine={{ stroke: P.borderStrong }}
              tick={{ fill: P.foregroundSoft, fontSize: 12, fontFamily: CHART_FONT }}
            />
            <Bar dataKey="days" radius={[0, 3, 3, 0]} barSize={22} isAnimationActive animationDuration={1100}>
              {TIMELINE_DATA.map((d, i) => (
                <Cell key={d.stage} fill={fills[i]} />
              ))}
              <LabelList
                dataKey="days"
                position="right"
                formatter={(v) => `${v}d`}
                style={{ fill: P.mutedStrong, fontSize: 12, fontFamily: CHART_FONT }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ClientOnly>
  );
}
