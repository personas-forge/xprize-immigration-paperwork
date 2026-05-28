import type { Config } from "tailwindcss";

// Semantic design tokens (see src/app/globals.css for the CSS variables).
// Components reference these tokens — bg-surface, text-muted, border-border,
// text-accent — rather than raw palette classes, so the whole app re-themes
// from one place (the root :root block, plus [data-theme="ink"] override).
export default {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        "background-tint": "var(--background-tint)",
        surface: "var(--surface)",
        "surface-muted": "var(--surface-muted)",
        "surface-elevated": "var(--surface-elevated)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        rule: "var(--rule)",
        foreground: "var(--foreground)",
        "foreground-soft": "var(--foreground-soft)",
        muted: "var(--muted)",
        "muted-strong": "var(--muted-strong)",
        accent: {
          DEFAULT: "var(--accent)",
          dark: "var(--accent-dark)",
          soft: "var(--accent-soft)",
          foreground: "var(--accent-foreground)",
        },
        seal: {
          DEFAULT: "var(--seal)",
          soft: "var(--seal-soft)",
        },
        indigo: {
          DEFAULT: "var(--indigo)",
          soft: "var(--indigo-soft)",
        },
        success: "var(--success)",
        "success-soft": "var(--success-soft)",
        warning: "var(--warning)",
        "warning-soft": "var(--warning-soft)",
        danger: "var(--danger)",
        "danger-soft": "var(--danger-soft)",
      },
      borderRadius: {
        control: "var(--radius-control)",
        card: "var(--radius-card)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        // Soft, paper-like — never the generic "card" drop-shadow look.
        leaf: "0 1px 0 rgba(13,31,45,0.04), 0 12px 28px -16px rgba(13,31,45,0.18)",
        engraved: "inset 0 0 0 1px var(--border-strong)",
        seal: "0 2px 0 rgba(125,42,46,0.18), 0 12px 24px -10px rgba(125,42,46,0.30)",
      },
      fontFamily: {
        sans: ["var(--font-newsreader)", "Georgia", "serif"],
        serif: ["var(--font-newsreader)", "Georgia", "serif"],
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        document: "0.32em",
      },
    },
  },
  plugins: [],
} satisfies Config;
