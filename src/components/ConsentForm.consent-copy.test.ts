import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Regression guard for a UPL-critical copy requirement.
// The consent submit button MUST carry an explicit consent verb ("Agree").
// PR #64 silently dropped it ("Finish setup — open my case file"), shipping an
// unlabeled consent action to production. The React suite does not render
// component copy, so this source-level assertion is the regression seam.
const source = readFileSync(
  fileURLToPath(new URL("./ConsentForm.tsx", import.meta.url)),
  "utf8",
);

test("consent submit button copy carries the 'Agree' consent verb", () => {
  assert.match(
    source,
    /Agree & open my case file/,
    "ConsentForm submit button must read 'Agree & open my case file' — the consent verb is required for valid, non-UPL consent capture",
  );
});

test("consent submit button does not regress to the verb-less label", () => {
  assert.doesNotMatch(
    source,
    /Finish setup — open my case file/,
    "the verb-less 'Finish setup — open my case file' label is a banned UPL regression (see PR #64)",
  );
});
