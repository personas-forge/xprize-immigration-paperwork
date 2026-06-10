import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "./Button";

// The test glob is `src/**/*.test.ts` (no .tsx), so components are rendered
// with createElement + renderToStaticMarkup instead of JSX.
function renderClassAttr(variant?: "primary" | "secondary" | "ghost" | "seal"): string {
  const html = renderToStaticMarkup(createElement(Button, { variant }, "label"));
  const match = html.match(/class="([^"]*)"/);
  assert.ok(match, `expected a class attribute in rendered markup: ${html}`);
  return match[1];
}

const FOCUS_RING_CLASSES = [
  "focus-visible:ring-2",
  "focus-visible:ring-accent",
  "focus-visible:ring-offset-2",
];

test("ghost variant renders the focus-visible ring classes", () => {
  const classAttr = renderClassAttr("ghost");
  for (const cls of FOCUS_RING_CLASSES) {
    assert.ok(
      classAttr.split(" ").includes(cls),
      `ghost variant is missing "${cls}" in: ${classAttr}`,
    );
  }
});

test("ghost variant keeps its base styling alongside the focus ring", () => {
  // Positive control: the same class attribute still carries the ghost chrome,
  // so a passing focus-ring assertion cannot come from a degenerate render.
  const classAttr = renderClassAttr("ghost").split(" ");
  assert.ok(classAttr.includes("text-muted-strong"));
  assert.ok(classAttr.includes("border-transparent"));
  assert.ok(classAttr.includes("focus-visible:outline-none"));
});
