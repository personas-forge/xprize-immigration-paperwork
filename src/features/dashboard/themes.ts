import { type Theme } from "./ThemeScope";

// Immigration Concierge ships two chosen skins — a light theme and a dark
// theme — toggled at runtime. Same Case file concept, same tokens.

// Light — calm, optimistic teal.
export const teal: Theme = {
  "--background": "#f6faf9",
  "--surface": "#ffffff",
  "--surface-muted": "#f1f5f4",
  "--border": "#e2ebe9",
  "--border-strong": "#cfdedb",
  "--foreground": "#1c1917",
  "--muted": "#6b7c79",
  "--accent": "#0f766e",
  "--accent-soft": "#f0fdfa",
  "--accent-foreground": "#ffffff",
  "--success": "#047857",
  "--success-soft": "#ecfdf5",
  "--warning": "#b45309",
  "--warning-soft": "#fffbeb",
  "--danger": "#be123c",
  "--danger-soft": "#fff1f2",
};

// Dark — focused graphite canvas, bright teal accent.
export const midnight: Theme = {
  "--background": "#0e1116",
  "--surface": "#171b22",
  "--surface-muted": "#20242d",
  "--border": "#2b2f3a",
  "--border-strong": "#394050",
  "--foreground": "#e6e7ea",
  "--muted": "#9094a0",
  "--accent": "#2dd4bf",
  "--accent-soft": "#0e3a35",
  "--accent-foreground": "#06140f",
  "--success": "#34d399",
  "--success-soft": "#0d2f26",
  "--warning": "#fbbf24",
  "--warning-soft": "#3a2e10",
  "--danger": "#fb7185",
  "--danger-soft": "#3a1620",
};
