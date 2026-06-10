import { test } from "node:test";
import assert from "node:assert/strict";

import { parchment, ink } from "./themes";

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
