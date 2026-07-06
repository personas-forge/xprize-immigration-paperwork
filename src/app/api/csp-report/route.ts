import { NextResponse, type NextRequest } from "next/server";

// Content-Security-Policy violation sink (burn-in): now that the CSP is
// ENFORCED-RELAXED (next.config.mjs's buildCsp), this is the only remaining
// visibility into a misconfiguration in production — a wrong/missing origin
// silently breaks a script/style/connect instead of throwing, so violations
// MUST land somewhere observable. Two report shapes hit this route depending
// on browser support:
//   • legacy `report-uri`     → Content-Type: application/csp-report,
//     body: { "csp-report": { ... } }        (single report per POST)
//   • Reporting API `report-to` → Content-Type: application/reports+json,
//     body: [ { type: "csp-violation", body: { ... } }, ... ]  (batched)
// Both are unauthenticated, browser-originated, best-effort telemetry — never
// gate app behavior on this route, never throw, always 204 so the browser
// doesn't retry/backoff oddly. No user PII is expected in a CSP report body
// (it's URLs + directive names), but it's still logged server-side only, not
// echoed back. No explicit `runtime`/`dynamic` route-segment config here:
// this app's `cacheComponents` rejects them outright (Turbopack build error —
// "not compatible with nextConfig.cacheComponents"), and none of the other
// API routes in this app declare them either — a POST handler that reads the
// request body is inherently per-request already, and the route defaults to
// the Node.js runtime (no `edge` opt-in), which this handler doesn't need
// anyway (no Node-only API used).
type CspReportBody =
  | { "csp-report"?: Record<string, unknown> }
  | Array<{ type?: string; body?: Record<string, unknown> }>
  | Record<string, unknown>;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Some browsers send the legacy report as text/plain-ish rather than the
    // declared application/csp-report or application/reports+json — parse
    // best-effort by shape (below) rather than branching on Content-Type and
    // risking a 415 on a real violation report.
    const raw = await request.text();
    if (!raw) return new NextResponse(null, { status: 204 });

    const parsed = JSON.parse(raw) as CspReportBody;

    if (Array.isArray(parsed)) {
      // Reporting API batch (application/reports+json) — may contain non-CSP
      // report types too (e.g. deprecation); log each, tagging its type.
      for (const entry of parsed) {
        console.warn(`[csp-report] ${entry.type ?? "unknown"}:`, entry.body ?? entry);
      }
    } else if ("csp-report" in parsed && parsed["csp-report"]) {
      // Legacy report-uri shape (application/csp-report).
      console.warn("[csp-report] csp-violation:", parsed["csp-report"]);
    } else {
      // Unrecognized but valid JSON — log the raw shape rather than drop it.
      console.warn("[csp-report] unrecognized report shape:", parsed);
    }
  } catch (e) {
    // Malformed body from a non-conforming client — not actionable, but log
    // for visibility rather than silently swallowing.
    console.warn("[csp-report] failed to parse report body:", e);
  }

  return new NextResponse(null, { status: 204 });
}

// Browsers occasionally probe with GET/HEAD or send a CORS preflight for the
// reporting endpoint; respond cheaply instead of a 405 muddying report logs.
export async function GET(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204 });
}
