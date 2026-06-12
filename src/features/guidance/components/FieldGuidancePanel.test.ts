import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Source-level assertions for FieldGuidancePanel — failed-fetch path.
// The test runner uses `tsx --test src/**/*.test.ts` with no DOM, and the
// repo's node_modules do not include react/react-dom, so rendering with
// renderToStaticMarkup is not available. Source checks are the established
// pattern (see PanelErrorBoundary.test.ts and DashboardTopBar.test.ts) for
// components that cannot render in the test environment.
//
// These cases pin the form/field-list fetch error handling: a rejected
// getForms() must flip an error state, the panel must render a retryable
// alert, and the recovery (error reset) must live OUTSIDE the effect body so
// it never re-introduces the react-hooks/set-state-in-effect lint failure
// that previously blocked this work.

const source = readFileSync(
  new URL("./FieldGuidancePanel.tsx", import.meta.url),
  "utf8",
);

// Isolate the catalog-loading useEffect body so we can assert what runs
// synchronously inside it vs. what runs in async callbacks / handlers.
function catalogEffect(): string {
  const start = source.indexOf("useEffect(");
  assert.notEqual(start, -1, "FieldGuidancePanel must declare a useEffect");
  // Match braces from the effect's opening to keep the slice to one effect.
  const braceOpen = source.indexOf("{", start);
  let depth = 0;
  for (let i = braceOpen; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error("could not bound the useEffect body");
}

test("the form-list fetch attaches a .catch() handler (no unhandled rejection)", () => {
  const effect = catalogEffect();
  assert.match(
    effect,
    /getForms\(\)/,
    "the catalog effect must call getForms() to load the form/field list",
  );
  assert.match(
    effect,
    /\.catch\(/,
    "getForms() must have a .catch() so a failed fetch is handled, not swallowed",
  );
});

test("a failed fetch flips an error state (setFormsError(true) lives in the catch)", () => {
  const effect = catalogEffect();
  const catchStart = effect.indexOf(".catch(");
  const catchBlock = effect.slice(catchStart);
  assert.match(
    catchBlock,
    /setFormsError\(true\)/,
    "the .catch() handler must set the forms-error state so the UI can react",
  );
});

test("the error state is declared with a default of no-error", () => {
  assert.match(
    source,
    /const \[formsError, setFormsError\] = useState\(false\)/,
    "formsError must default to false (no error until a fetch actually fails)",
  );
});

test("when the error state is set, a retryable alert is rendered", () => {
  assert.match(
    source,
    /formsError \?/,
    "the render must branch on formsError to show the error UI",
  );
  assert.match(
    source,
    /role="alert"/,
    "the failed-fetch UI must use role=\"alert\" so assistive tech announces it",
  );
  assert.match(
    source,
    /Could not load the USCIS form list/,
    "the alert must explain the failure in user-facing terms",
  );
});

test("the retry prompt offers a Retry control wired to a recovery handler", () => {
  assert.match(
    source,
    /onClick=\{onRetryForms\}/,
    "the alert must wire its retry control to onRetryForms",
  );
  assert.match(
    source,
    />\s*Retry\s*</,
    "the retry control must be labelled 'Retry'",
  );
});

test("recovery resets the error and re-triggers the fetch", () => {
  const start = source.indexOf("function onRetryForms");
  assert.notEqual(start, -1, "onRetryForms recovery handler must exist");
  const handler = source.slice(start, start + 200);
  assert.match(
    handler,
    /setFormsError\(false\)/,
    "Retry must clear the error state",
  );
  assert.match(
    handler,
    /setFormsAttempt/,
    "Retry must bump the attempt counter so the catalog effect re-runs",
  );
});

test("regression guard: the error state is never reset synchronously inside the effect body", () => {
  // PR #62 was blocked by react-hooks/set-state-in-effect because
  // setFormsError ran as a top-level statement in the effect. The reset must
  // live in the Retry handler, NOT in the effect — only the async .catch()
  // may set the error (to true).
  const effect = catalogEffect();
  assert.doesNotMatch(
    effect,
    /setFormsError\(false\)/,
    "setFormsError(false) must not run inside the effect — keep recovery in onRetryForms (avoids react-hooks/set-state-in-effect)",
  );
});
