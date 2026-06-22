// Concrete hex values mirroring the light "Atelier of Arrival" tokens in
// globals.css. Recharts sets most colors as SVG presentation ATTRIBUTES, where
// CSS custom properties (var(--accent)) are not valid — so chart code reads the
// resolved hex from here instead of the token names. The landing prototypes
// render on parchment regardless of the theme toggle, so the light values are
// the right reference. Keep in sync with :root in globals.css.
export const PALETTE = {
  background: "#f3ead6",
  backgroundTint: "#ece1c4",
  surface: "#fbf6e7",
  surfaceMuted: "#ede2c2",
  border: "rgba(13,31,45,0.12)",
  borderStrong: "rgba(13,31,45,0.22)",
  rule: "rgba(13,31,45,0.18)",
  foreground: "#0d1f2d",
  foregroundSoft: "#1f3445",
  muted: "#6b5d3e",
  mutedStrong: "#4d4029",
  accent: "#b8893a",
  accentDark: "#8e6829",
  accentSoft: "#f4e6c2",
  seal: "#7d2a2e",
  sealSoft: "#ecd3cf",
  indigo: "#3a4d6b",
  success: "#4e6b3c",
  warning: "#a06410",
} as const;

export type Palette = Record<keyof typeof PALETTE, string>;

// Dark "ink" theme equivalents — mirrors the [data-theme="ink"] block in
// globals.css. Charts can't read CSS vars (SVG attributes), so we keep an
// explicit second palette and pick between them at runtime (see
// useThemePalette). Keep both in sync with globals.css if the tokens change.
export const INK_PALETTE: Palette = {
  background: "#0c1a25",
  backgroundTint: "#08131c",
  surface: "#122535",
  surfaceMuted: "#0e1e2a",
  border: "rgba(243,234,214,0.10)",
  borderStrong: "rgba(243,234,214,0.20)",
  rule: "rgba(243,234,214,0.16)",
  foreground: "#f3ead6",
  foregroundSoft: "#ddd0ac",
  muted: "#95876a",
  mutedStrong: "#b7a988",
  accent: "#d4a554",
  accentDark: "#b8893a",
  accentSoft: "rgba(212,165,84,0.14)",
  seal: "#c75b60",
  sealSoft: "rgba(199,91,96,0.14)",
  indigo: "#8b9fc1",
  success: "#9fc080",
  warning: "#d99947",
};

// Mono stack reused for axis ticks / labels so charts read as document
// microprint rather than default sans chart chrome.
export const CHART_FONT =
  "var(--font-plex-mono), ui-monospace, SFMono-Regular, monospace";
