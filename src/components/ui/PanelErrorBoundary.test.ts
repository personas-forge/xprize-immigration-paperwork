import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Source-level assertions for PanelErrorBoundary.
// The test runner uses `tsx --test src/**/*.test.ts` with no DOM, and the
// repo's node_modules do not include react/react-dom, so rendering with
// renderToStaticMarkup is not available. Source checks are the established
// pattern (see DashboardTopBar.test.ts) for components that can't render
// in the test environment.

const source = readFileSync(
  new URL("./PanelErrorBoundary.tsx", import.meta.url),
  "utf8",
);

test("PanelErrorBoundary declares getDerivedStateFromError (required to catch render errors)", () => {
  assert.match(
    source,
    /getDerivedStateFromError/,
    "PanelErrorBoundary must declare getDerivedStateFromError to function as an error boundary",
  );
});

test("PanelErrorBoundary declares componentDidCatch (error logging hook)", () => {
  assert.match(
    source,
    /componentDidCatch/,
    "PanelErrorBoundary must declare componentDidCatch for diagnostic logging",
  );
});

test("PanelErrorBoundary extends React.Component (class-component boundary, not a function component)", () => {
  assert.match(
    source,
    /extends Component/,
    "Error boundaries must be class components — hooks cannot catch render errors",
  );
});

test("PanelFallback contains the 'Could not load' user-facing message", () => {
  assert.match(
    source,
    /Could not load/,
    "PanelFallback must include a 'Could not load' message so users understand the failure",
  );
});

test("PanelFallback contains a retry action labelled 'Retry'", () => {
  assert.match(
    source,
    /Retry/,
    "PanelFallback must offer a retry action so users can recover without a full page reload",
  );
});

test("PanelErrorBoundary and PanelFallback are both exported (needed for wrapping call-sites and tests)", () => {
  assert.match(source, /export class PanelErrorBoundary/, "PanelErrorBoundary must be a named export");
  assert.match(source, /export function PanelFallback/, "PanelFallback must be a named export for direct unit testing");
});

test("hasError state field drives the fallback render path (structural invariant)", () => {
  // Positive control: if someone removes the hasError check, the fallback never
  // shows. Assert the guard is present so a refactor doesn't silently remove it.
  assert.match(
    source,
    /hasError/,
    "PanelErrorBoundary must use a hasError state field to toggle the fallback",
  );
});
