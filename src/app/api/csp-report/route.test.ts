import assert from "node:assert/strict";
import { test } from "node:test";
import type { NextRequest } from "next/server";
import { GET, POST } from "./route";

/** A minimal POST the handler can `.text()`. */
function req(body: string, contentType = "application/csp-report"): NextRequest {
  return new Request("http://localhost/api/csp-report", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body,
  }) as unknown as NextRequest;
}

// Silence the intentional console.warn burn-in logging so the test suite's
// output stays readable; each test asserts on the response, not the log line.
function withSilencedWarn<T>(fn: () => T): T {
  const original = console.warn;
  console.warn = () => {};
  try {
    return fn();
  } finally {
    console.warn = original;
  }
}

test("csp-report POST: 204s on the legacy report-uri shape (single csp-report object)", async () => {
  const res = await withSilencedWarn(() =>
    POST(req(JSON.stringify({ "csp-report": { "violated-directive": "script-src", "blocked-uri": "https://evil.example" } }))),
  );
  assert.equal(res.status, 204);
});

test("csp-report POST: 204s on the Reporting API batch shape (array of reports)", async () => {
  const res = await withSilencedWarn(() =>
    POST(
      req(
        JSON.stringify([
          { type: "csp-violation", body: { blockedURL: "https://evil.example", disposition: "enforce" } },
        ]),
        "application/reports+json",
      ),
    ),
  );
  assert.equal(res.status, 204);
});

test("csp-report POST: 204s on an empty body (some browsers send a preflight-like empty POST)", async () => {
  const res = await withSilencedWarn(() => POST(req("")));
  assert.equal(res.status, 204);
});

test("csp-report POST: 204s (never throws) on malformed JSON", async () => {
  const res = await withSilencedWarn(() => POST(req("not json{{{")));
  assert.equal(res.status, 204);
});

test("csp-report GET: 204s cheaply instead of a 405 (browser probes)", async () => {
  const res = await GET();
  assert.equal(res.status, 204);
});
