import { describe, it } from "node:test";
import assert from "node:assert/strict";
// next.config.mjs lives outside src/ (Next.js requires it at the repo root),
// so it's imported by relative path rather than the "@/*" alias. It exports
// `buildCsp` (the pure, isDev-parameterized policy string builder) alongside
// the default nextConfig, specifically so this enforced CSP has a unit-tested
// home instead of living only as an unverified string literal — mirrors
// local-seo-agency's / grant-writing-nonprofits's src/lib/auth/csp.test.ts,
// adapted for this app's ENFORCED-RELAXED (no per-request nonce) policy.
import nextConfig, { buildCsp } from "../../../next.config.mjs";

function directive(csp: string, name: string): string {
  const dir = csp.split("; ").find((d) => d.startsWith(`${name} `));
  assert.ok(dir, `policy must declare ${name}`);
  return dir as string;
}

describe("buildCsp — enforced-relaxed CSP (next.config.mjs)", () => {
  it("dev loosens script-src for HMR ('unsafe-inline' + 'unsafe-eval'), no upgrade-insecure-requests", () => {
    const csp = buildCsp(true);
    const s = directive(csp, "script-src");
    assert.match(s, /'unsafe-inline'/);
    assert.match(s, /'unsafe-eval'/);
    assert.doesNotMatch(csp, /upgrade-insecure-requests/);
  });

  it("prod keeps script-src 'unsafe-inline' (the theme-init script + inline style props need it) without 'unsafe-eval', and upgrades to https", () => {
    const csp = buildCsp(false);
    const s = directive(csp, "script-src");
    assert.match(s, /'unsafe-inline'/);
    assert.doesNotMatch(s, /'unsafe-eval'/);
    assert.match(csp, /upgrade-insecure-requests/);
  });

  it("never nonces script-src — a per-request nonce would break the shared root-layout theme-init script on statically-cached routes", () => {
    for (const isDev of [true, false]) {
      const s = directive(buildCsp(isDev), "script-src");
      assert.doesNotMatch(s, /nonce-/);
      assert.doesNotMatch(s, /strict-dynamic/);
    }
  });

  it("scopes script-src + connect-src + frame-src to the Firebase Auth origins this app actually talks to", () => {
    const csp = buildCsp(false);
    assert.match(directive(csp, "script-src"), /https:\/\/apis\.google\.com/);
    assert.match(directive(csp, "script-src"), /https:\/\/www\.gstatic\.com/);
    assert.match(directive(csp, "connect-src"), /https:\/\/identitytoolkit\.googleapis\.com/);
    assert.match(directive(csp, "connect-src"), /https:\/\/securetoken\.googleapis\.com/);
    assert.match(directive(csp, "frame-src"), /https:\/\/\*\.firebaseapp\.com/);
    // Deliberately absent: no client-side Firestore/Storage SDK is used (the
    // store is server-only, via firebase-admin), so its origin isn't allowed.
    assert.doesNotMatch(csp, /firestore\.googleapis\.com/);
  });

  it("keeps style-src permissive (inline style props + next/font/React un-nonceable <style> tags) but everything else locked", () => {
    const csp = buildCsp(false);
    assert.match(directive(csp, "style-src"), /'unsafe-inline'/);
    assert.match(csp, /img-src 'self' data: blob:/);
    assert.match(csp, /font-src 'self' data:/);
  });

  it("locks framing/injection defenses in every mode", () => {
    for (const isDev of [true, false]) {
      const csp = buildCsp(isDev);
      assert.match(csp, /default-src 'self'/);
      assert.match(csp, /frame-ancestors 'none'/);
      assert.match(csp, /object-src 'none'/);
      assert.match(csp, /base-uri 'self'/);
      assert.match(csp, /form-action 'self'/);
    }
  });

  it("wires the violation-reporting sink (both report shapes, one endpoint)", () => {
    const csp = buildCsp(false);
    assert.match(csp, /report-uri \/api\/csp-report/);
    assert.match(csp, /report-to csp/);
  });
});

// next.config.mjs genuinely always defines headers() (see the file), so the
// NextConfig type's optionality doesn't reflect a real possibility here.
async function readHeaders() {
  assert.ok(nextConfig.headers, "next.config.mjs must define headers()");
  return nextConfig.headers();
}

describe("next.config.mjs headers() — CSP is enforced, not Report-Only", () => {
  it("sets Content-Security-Policy (not -Report-Only) and the Reporting-Endpoints group it needs", async () => {
    const entries = await readHeaders();
    const all = entries.flatMap((e: { headers: { key: string; value: string }[] }) => e.headers);

    const enforced = all.find((h) => h.key === "Content-Security-Policy");
    assert.ok(enforced, "Content-Security-Policy must be set as an enforced header");
    assert.ok(
      !all.some((h) => h.key === "Content-Security-Policy-Report-Only"),
      "Report-Only header must be gone now that CSP is enforced",
    );

    const reportingEndpoints = all.find((h) => h.key === "Reporting-Endpoints");
    assert.ok(reportingEndpoints, "Reporting-Endpoints header must back the CSP's report-to group");
    assert.match(reportingEndpoints!.value, /csp="\/api\/csp-report"/);
  });

  it("still ships every pre-existing security header untouched", async () => {
    const entries = await readHeaders();
    const all = entries.flatMap((e: { headers: { key: string; value: string }[] }) => e.headers);
    const keys = all.map((h) => h.key);
    assert.ok(keys.includes("X-Content-Type-Options"));
    assert.ok(keys.includes("X-Frame-Options"));
    assert.ok(keys.includes("Referrer-Policy"));
    assert.ok(keys.includes("Permissions-Policy"));
    assert.ok(keys.includes("Strict-Transport-Security"));
  });
});
