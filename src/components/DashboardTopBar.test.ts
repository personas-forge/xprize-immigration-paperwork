import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// DashboardTopBar applies a translucent backdrop-blur on its sticky header.
// Per the prefers-reduced-motion gate, that blur MUST be expressed through
// Tailwind's `motion-safe:` variant so reduced-motion users get an opaque
// header with no backdrop-filter. We assert this at the source level because
// the repo's test runner (`tsx --test`) has no DOM to render the component.
const source = readFileSync(
  new URL("./DashboardTopBar.tsx", import.meta.url),
  "utf8",
);

test("backdrop-blur is gated behind the motion-safe variant", () => {
  // Positive control: the blur effect must still be present (gated), so this
  // fails loudly if someone deletes the blur entirely instead of gating it.
  assert.match(
    source,
    /motion-safe:backdrop-blur/,
    "expected a motion-safe:backdrop-blur class on the header",
  );
});

test("no unconditional backdrop-blur survives in any className", () => {
  // Scope the check to actual className attribute values (ignore prose in
  // comments). Within every className string, each `backdrop-blur` token must
  // be the `motion-safe:` variant; a bare token would apply the filter even
  // when the user requested reduced motion.
  const classNames = [...source.matchAll(/className="([^"]*)"/g)].map(
    (m) => m[1],
  );
  const ungated = classNames
    .flatMap((cls) => cls.split(/\s+/))
    .filter((token) => /(^|:)backdrop-blur/.test(token))
    .filter((token) => !token.startsWith("motion-safe:backdrop-blur"));
  assert.equal(
    ungated.length,
    0,
    `found ungated backdrop-blur class token(s): ${ungated.join(", ")}`,
  );
});
