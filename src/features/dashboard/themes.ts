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
  "--accent-dark": "#8e6829",
  "--accent-soft": "#f4e6c2",
  "--accent-foreground": "#1a1206",
  "--seal": "#7d2a2e",
  "--seal-soft": "#ecd3cf",
  "--success": "#4e6b3c",
  "--success-soft": "#e6ead4",
  "--warning": "#a06410",
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
  "--accent-dark": "#b8893a",
  "--accent-soft": "rgba(212, 165, 84, 0.14)",
  "--accent-foreground": "#0c1a25",
  "--seal": "#c75b60",
  "--seal-soft": "rgba(199, 91, 96, 0.14)",
  "--success": "#9fc080",
  "--success-soft": "rgba(159, 192, 128, 0.14)",
  "--warning": "#d99947",
  "--warning-soft": "rgba(217, 153, 71, 0.14)",
  "--danger": "#d96b6f",
  "--danger-soft": "rgba(217, 107, 111, 0.14)",
};
