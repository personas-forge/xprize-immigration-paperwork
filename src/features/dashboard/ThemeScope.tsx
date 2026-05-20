import { type CSSProperties, type ReactNode } from "react";

// A theme is a set of design-token CSS-variable overrides. Applying it to a
// wrapper re-themes everything inside: every token utility class the app uses
// (bg-surface, text-accent, border-border, …) resolves to these variables, so
// the whole concept re-skins from one object — no component edits.
export type Theme = Record<`--${string}`, string>;

export function ThemeScope({
  theme,
  children,
}: {
  theme: Theme;
  children: ReactNode;
}) {
  return (
    <div
      style={theme as CSSProperties}
      className="min-h-screen bg-background text-foreground"
    >
      {children}
    </div>
  );
}
