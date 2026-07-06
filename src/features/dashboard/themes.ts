import { type Theme } from "./ThemeScope";

// Two skins of the Atelier identity, applied at runtime by the dashboard
// theme toggle. Parchment is the daylight desk; Ink is the after-hours
// notary's office. Same identity, opposite ground.

export const parchment: Theme = {
  "--background": "#f3ead6",
  "--background-tint": "#ece1c4",
  "--surface": "#fbf6e7",
  "--surface-muted": "#ede2c2",
  "--surface-elevated": "#ffffff",
  "--border": "rgba(13, 31, 45, 0.12)",
  "--border-strong": "rgba(13, 31, 45, 0.22)",
  "--rule": "rgba(13, 31, 45, 0.18)",
  "--foreground": "#0d1f2d",
  "--foreground-soft": "#1f3445",
  "--muted": "#6b5d3e",
  "--muted-strong": "#4d4029",
  "--accent": "#b8893a",
  // #765622 is the darkest-preserving-hue shade of --accent-dark that clears
  // WCAG AA 4.5:1 as small badge/chip TEXT on its own --accent-soft wash and
  // on the translucent bg-accent/15 + bg-accent-dark/10 chip backgrounds
  // (Badge.tsx "accent" tone, DraftStudio/RfeRiskRadar count pills,
  // CriterionPrimerButton's active state) — the previous #8e6829 measured
  // 3.47:1 in the worst case (bg-accent-dark/10 over --surface-muted).
  // Enforced by themes.contrast.test.ts.
  "--accent-dark": "#765622",
  // --accent-text is the badge/chip-TEXT sibling split off from --accent-dark
  // (see the ink theme below for why the split exists — ink's --accent-dark
  // can't simply be lightened without colliding with --accent). Parchment's
  // --accent-dark already clears 4.5:1 in that exact role (see the comment
  // above), so no separate value is needed here — --accent-text mirrors it.
  // Enforced by themes.contrast.test.ts.
  "--accent-text": "#765622",
  "--accent-soft": "#f4e6c2",
  "--accent-foreground": "#1a1206",
  "--seal": "#7d2a2e",
  "--seal-soft": "#ecd3cf",
  "--success": "#4e6b3c",
  "--success-soft": "#e6ead4",
  // #8e580e is the darkest-preserving-hue shade of --warning that holds
  // 4.5:1 as Badge/status text on --warning-soft (and on every plain
  // surface, defensively) — the previous #a06410 measured 3.73:1 worst case.
  // Enforced by themes.contrast.test.ts.
  "--warning": "#8e580e",
  "--warning-soft": "#f4e2c0",
  "--danger": "#7d2a2e",
  "--danger-soft": "#ecd3cf",
};

export const ink: Theme = {
  "--background": "#0c1a25",
  "--background-tint": "#08131c",
  "--surface": "#122535",
  "--surface-muted": "#0e1e2a",
  "--surface-elevated": "#1a3245",
  "--border": "rgba(243, 234, 214, 0.10)",
  "--border-strong": "rgba(243, 234, 214, 0.20)",
  "--rule": "rgba(243, 234, 214, 0.16)",
  "--foreground": "#f3ead6",
  "--foreground-soft": "#ddd0ac",
  // #a89a7e is the darkest shade of the warm-khaki muted hue that holds
  // WCAG AA 4.5:1 for normal text on every ink surface — the binding pair
  // is --surface-elevated #1a3245 (4.78:1; the previous #95876a sat at
  // 3.75:1 there and 4.44:1 on --surface). It stays below --muted-strong
  // (5.70:1 on the same surface) so the muted < muted-strong hierarchy
  // survives. Enforced by themes.contrast.test.ts.
  "--muted": "#a89a7e",
  "--muted-strong": "#b7a988",
  "--accent": "#d4a554",
  // --accent-dark keeps its other (larger-text / fill / decorative) roles
  // as-is here — it still measures 3.26:1 (worst case) as small badge/chip
  // TEXT on the translucent bg-accent-soft / bg-accent/15 washes, and simply
  // lightening it to clear 4.5:1 (~#cea662) would land it visually on top of
  // --accent (#d4a554), erasing the accent/accent-dark distinction the two
  // sibling tokens exist to carry. Resolved (Phase 2) by splitting the
  // badge/chip TEXT role into its own token below instead of nudging this
  // one. See themes.contrast.test.ts for both measurements.
  "--accent-dark": "#b8893a",
  // #daa725 is a distinct lightness/chroma point from both --accent and
  // --accent-dark (not just a lightened --accent-dark), chosen so small
  // badge/chip TEXT clears WCAG AA 4.5:1 on --accent-soft, bg-accent/15, and
  // bg-accent-dark/10 without visually colliding with either sibling token —
  // legibility over hue-purity, while staying in the same amber/gold family.
  // Used ONLY for small accent-colored TEXT (Badge.tsx "accent" tone,
  // DraftStudio/RfeRiskRadar count pills, CriterionPrimerButton's active
  // state); --accent and --accent-dark keep their other (larger-text / fill /
  // decorative) roles unchanged. Enforced by themes.contrast.test.ts.
  "--accent-text": "#daa725",
  "--accent-soft": "rgba(212, 165, 84, 0.14)",
  "--accent-foreground": "#0c1a25",
  // #d88d90 is the lightest-preserving-hue shade of --seal that clears WCAG
  // AA 4.5:1 as text on its own --seal-soft wash (worst case 2.83:1 at the
  // previous #c75b60, on --surface-elevated) — this also covers the "seal"
  // Button variant (text-background on bg-seal), which only improves
  // (6.83:1). Enforced by themes.contrast.test.ts.
  "--seal": "#d88d90",
  "--seal-soft": "rgba(199, 91, 96, 0.14)",
  "--success": "#9fc080",
  "--success-soft": "rgba(159, 192, 128, 0.14)",
  // #da9d4d clears 4.5:1 as Badge/status text on --warning-soft (previous
  // #d99947 measured 4.36:1 worst case, on --surface-elevated) — a small
  // nudge, same pattern as --muted above. Enforced by
  // themes.contrast.test.ts.
  "--warning": "#da9d4d",
  "--warning-soft": "rgba(217, 153, 71, 0.14)",
  // #e28c8f clears 4.5:1 as Badge/alert text on --danger-soft (previous
  // #d96b6f measured 3.38:1 worst case, on --surface-elevated). Enforced by
  // themes.contrast.test.ts.
  "--danger": "#e28c8f",
  "--danger-soft": "rgba(217, 107, 111, 0.14)",
};
