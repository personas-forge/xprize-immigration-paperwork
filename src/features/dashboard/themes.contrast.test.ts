import { test } from "node:test";
import assert from "node:assert/strict";

import { parchment, ink } from "./themes";
import { type Theme } from "./ThemeScope";

// Programmatic WCAG AA contrast audit over the dashboard theme tokens.
// Runs under `npm test` (and therefore in CI on every PR) and FAILS on any
// text-token / surface-token pair below 4.5:1 — the AA threshold for normal
// text, which is the binding requirement for small muted copy such as the
// 11px `.doc-number` spans in CaseFileDashboard.tsx.

/** WCAG 2.x relative luminance of a #rrggbb color. */
function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`expected #rrggbb hex color, got: ${hex}`);
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two #rrggbb colors (1..21). */
function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Alpha-composite an rgba(...)/#rrggbb color over an opaque #rrggbb backing. */
function compositeOver(fg: string, backing: string): string {
  if (/^#[0-9a-f]{6}$/i.test(fg)) return fg;
  const m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\)$/i.exec(fg);
  if (!m) throw new Error(`expected rgba(...) or #rrggbb, got: ${fg}`);
  const [r, g, b] = [+m[1], +m[2], +m[3]];
  const a = m[4] !== undefined ? +m[4] : 1;
  const bm = /^#([0-9a-f]{6})$/i.exec(backing);
  if (!bm) throw new Error(`expected #rrggbb backing, got: ${backing}`);
  const [br, bg, bb] = [0, 2, 4].map((i) => parseInt(bm[1].slice(i, i + 2), 16));
  const mix = (fc: number, bc: number) => Math.round(fc * a + bc * (1 - a));
  return (
    "#" +
    [mix(r, br), mix(g, bg), mix(b, bb)]
      .map((c) => c.toString(16).padStart(2, "0"))
      .join("")
  );
}

const AA_NORMAL_TEXT = 4.5;

// Tokens that carry normal-size text (text-muted, text-foreground, …) and the
// opaque surfaces that text is rendered over. Alpha (rgba) tokens are borders
// and tint washes, not text grounds, so they are out of scope here.
const TEXT_TOKENS = [
  "--foreground",
  "--foreground-soft",
  "--muted",
  "--muted-strong",
] as const;

const SURFACE_TOKENS = [
  "--background",
  "--background-tint",
  "--surface",
  "--surface-muted",
  "--surface-elevated",
] as const;

const THEMES = { parchment, ink } as const;

test("contrast helpers are calibrated (positive controls)", () => {
  // Sanity-check the math so the audit below cannot pass vacuously.
  assert.equal(contrastRatio("#ffffff", "#000000"), 21);
  assert.equal(contrastRatio("#ffffff", "#ffffff"), 1);
  // The pre-fix ink --muted (#95876a) MUST be flagged as failing on
  // --surface-elevated — proves the audit detects a real violation.
  assert.ok(contrastRatio("#95876a", ink["--surface-elevated"]) < AA_NORMAL_TEXT);
});

for (const [themeName, theme] of Object.entries(THEMES)) {
  test(`${themeName}: every text token meets WCAG AA 4.5:1 on every surface`, () => {
    const failures: string[] = [];
    let pairs = 0;
    for (const textToken of TEXT_TOKENS) {
      for (const surfaceToken of SURFACE_TOKENS) {
        pairs += 1;
        const ratio = contrastRatio(theme[textToken], theme[surfaceToken]);
        if (ratio < AA_NORMAL_TEXT) {
          failures.push(
            `${textToken} (${theme[textToken]}) on ${surfaceToken} ` +
              `(${theme[surfaceToken]}) = ${ratio.toFixed(2)}:1 < ${AA_NORMAL_TEXT}:1`,
          );
        }
      }
    }
    // Guard against the audit silently iterating nothing.
    assert.equal(pairs, TEXT_TOKENS.length * SURFACE_TOKENS.length);
    assert.deepEqual(failures, [], `WCAG AA violations:\n${failures.join("\n")}`);
  });

  test(`${themeName}: audited tokens exist and are opaque hex colors`, () => {
    for (const token of [...TEXT_TOKENS, ...SURFACE_TOKENS]) {
      const value = theme[token];
      assert.ok(value, `${themeName} is missing token ${token}`);
      assert.match(
        value,
        /^#[0-9a-f]{6}$/i,
        `${themeName} ${token} must be #rrggbb so the audit can measure it`,
      );
    }
  });
}

test("ink --muted stays visually subordinate to --muted-strong", () => {
  // The fix must not invert the type hierarchy: muted reads quieter than
  // muted-strong on the surface where contrast is tightest.
  const surface = ink["--surface-elevated"];
  assert.ok(
    contrastRatio(ink["--muted"], surface) <
      contrastRatio(ink["--muted-strong"], surface),
  );
});

// ── Brand/semantic tokens as real rendered text ─────────────────────────────
// The TEXT_TOKENS x SURFACE_TOKENS grid above only covers the general body
// tokens (foreground/muted). Site-wide, --seal/--danger/--warning also render
// as small TEXT — Button's "seal" variant and Badge's success/warning/danger
// tones — on top of their own (sometimes translucent, in ink) "-soft" wash
// tokens. (Badge's accent tone and the count-pill chips in DraftStudio/
// RfeRiskRadar/CriterionPrimerButton render --accent-text instead — see the
// --accent-text section further down.) This section audits those pairs with
// the SAME worst-case-over-every-surface methodology, compositing the alpha
// washes over each opaque surface first.

/** Worst (lowest) contrast ratio of `textHex` against `bgToken` composited
 *  over every surface in the theme — the surface a card/badge might sit on
 *  isn't fixed, so the audit must hold on all of them. */
function worstRatioOverSurfaces(theme: Theme, textHex: string, bgToken: string): number {
  return Math.min(
    ...SURFACE_TOKENS.map((s) => contrastRatio(textHex, compositeOver(bgToken, theme[s]))),
  );
}

test("contrast helpers are calibrated (positive controls, part 2)", () => {
  // The pre-fix ink --seal/--danger/--warning MUST be flagged as failing on
  // their own soft-wash tokens — proves the audit below detects real
  // violations, not just passes vacuously.
  assert.ok(worstRatioOverSurfaces(ink, "#c75b60", ink["--seal-soft"]) < AA_NORMAL_TEXT);
  assert.ok(worstRatioOverSurfaces(ink, "#d96b6f", ink["--danger-soft"]) < AA_NORMAL_TEXT);
  assert.ok(worstRatioOverSurfaces(ink, "#d99947", ink["--warning-soft"]) < AA_NORMAL_TEXT);
  assert.ok(worstRatioOverSurfaces(parchment, "#a06410", parchment["--warning-soft"]) < AA_NORMAL_TEXT);
  // Ink's --accent-dark (#b8893a, unchanged — it keeps its other, non-badge
  // roles) MUST still measure as failing when used as badge/chip TEXT on
  // bg-accent/15 — this is the exact 3.26:1 Phase-2 finding that motivated
  // splitting --accent-text off as its own token below, rather than nudging
  // --accent-dark itself (which would collide with --accent).
  assert.ok(
    worstRatioOverSurfaces(ink, ink["--accent-dark"], withAlpha(ink["--accent"], 0.15)) < AA_NORMAL_TEXT,
  );
});

for (const [themeName, theme] of Object.entries(THEMES)) {
  test(`${themeName}: Button "seal" variant (text-background on bg-seal) meets 4.5:1`, () => {
    const ratio = contrastRatio(theme["--background"], theme["--seal"]);
    assert.ok(
      ratio >= AA_NORMAL_TEXT,
      `text-background (${theme["--background"]}) on bg-seal (${theme["--seal"]}) = ${ratio.toFixed(2)}:1 < ${AA_NORMAL_TEXT}:1`,
    );
  });

  // Badge tones (seal/success/warning/danger) render TEXT_TOKEN-less brand
  // colors directly as text on their matching "-soft" background, on
  // whichever surface the badge/alert/chip is placed on. --accent-dark is
  // DELIBERATELY excluded from this enforced matrix — in its OTHER
  // (larger-text / fill / decorative) roles it isn't held to 4.5:1, and its
  // small-badge-TEXT role was split off into a dedicated --accent-text token
  // instead (see themes.ts and the --accent-text tests below).
  const BADGE_SOFT_PAIRS = [
    ["--seal", "--seal-soft"],
    ["--success", "--success-soft"],
    ["--warning", "--warning-soft"],
    ["--danger", "--danger-soft"],
  ] as const;

  for (const [textToken, softToken] of BADGE_SOFT_PAIRS) {
    test(`${themeName}: ${textToken} on its own ${softToken} wash meets 4.5:1 on every surface`, () => {
      const ratio = worstRatioOverSurfaces(theme, theme[textToken], theme[softToken]);
      assert.ok(
        ratio >= AA_NORMAL_TEXT,
        `${textToken} (${theme[textToken]}) worst-case on ${softToken} (${theme[softToken]}) = ${ratio.toFixed(2)}:1 < ${AA_NORMAL_TEXT}:1`,
      );
    });
  }
}

/** hex + Tailwind-style opacity modifier (e.g. bg-accent/15) as an rgba(...) string. */
function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`expected #rrggbb, got: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

test("parchment: --accent-dark badge/chip text meets 4.5:1 (accent-soft, bg-accent/15, bg-accent-dark/10)", () => {
  // Historical/legacy check: parchment's --accent-dark itself already clears
  // 4.5:1 in this role (no sibling-collision risk there — darkening moves it
  // further from --accent, not closer), which is why parchment's
  // --accent-text simply mirrors --accent-dark's value (see themes.ts).
  // Actual badge/chip components now render --accent-text, not --accent-dark
  // directly — see the "--accent-text badge/chip text" tests below for the
  // token that is actually enforced site-wide.
  const cases: Array<[string, string]> = [
    ["--accent-soft", parchment["--accent-soft"]],
    ["bg-accent/15", withAlpha(parchment["--accent"], 0.15)],
    ["bg-accent-dark/10", withAlpha(parchment["--accent-dark"], 0.1)],
  ];
  for (const [label, bg] of cases) {
    const ratio = worstRatioOverSurfaces(parchment, parchment["--accent-dark"], bg);
    assert.ok(
      ratio >= AA_NORMAL_TEXT,
      `--accent-dark on ${label} worst-case = ${ratio.toFixed(2)}:1 < ${AA_NORMAL_TEXT}:1`,
    );
  }
});

// ── --accent-text: the badge/chip TEXT split off from --accent-dark ────────
// Phase 2 found ink's --accent-dark measuring 3.26:1 (worst case) as small
// badge/chip TEXT — Badge.tsx "accent" tone, DraftStudio/RfeRiskRadar count
// pills, CriterionPrimerButton's active state — on the translucent
// --accent-soft / bg-accent/15 / bg-accent-dark/10 washes those components
// use. It can't simply be lightened to clear 4.5:1 there (~#cea662) without
// visually colliding with sibling --accent (#d4a554). --accent-text is a
// separate token, tuned to its own lightness/chroma point, used ONLY for
// that small-badge/chip-TEXT role in both themes — --accent and
// --accent-dark keep every other (larger-text / fill / decorative) role
// unchanged.
for (const [themeName, theme] of Object.entries(THEMES)) {
  test(`${themeName}: --accent-text badge/chip text meets 4.5:1 (accent-soft, bg-accent/15, bg-accent-dark/10)`, () => {
    const cases: Array<[string, string]> = [
      ["--accent-soft", theme["--accent-soft"]],
      ["bg-accent/15", withAlpha(theme["--accent"], 0.15)],
      ["bg-accent-dark/10", withAlpha(theme["--accent-dark"], 0.1)],
    ];
    for (const [label, bg] of cases) {
      const ratio = worstRatioOverSurfaces(theme, theme["--accent-text"], bg);
      assert.ok(
        ratio >= AA_NORMAL_TEXT,
        `${themeName} --accent-text on ${label} worst-case = ${ratio.toFixed(2)}:1 < ${AA_NORMAL_TEXT}:1`,
      );
    }
  });

  test(`${themeName}: --accent-text doesn't collide with --accent`, () => {
    // The whole point of splitting this token out is that it doesn't read as
    // the same color as --accent — guard against a future edit quietly
    // re-merging it with the token it exists to stay distinct from.
    assert.notEqual(theme["--accent-text"].toLowerCase(), theme["--accent"].toLowerCase());
  });
}

test("ink: --accent-text doesn't collide with --accent-dark either", () => {
  // In parchment, --accent-text intentionally mirrors --accent-dark (which
  // already clears 4.5:1 in this role there — see the legacy test above), so
  // that equality is by design and isn't asserted against. In ink, though,
  // --accent-dark is the token --accent-text was split OFF of specifically
  // because --accent-dark fails 4.5:1 as badge/chip text — so the two must
  // stay visibly distinct there.
  assert.notEqual(ink["--accent-text"].toLowerCase(), ink["--accent-dark"].toLowerCase());
});
