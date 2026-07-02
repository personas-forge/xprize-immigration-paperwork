#!/usr/bin/env node
/**
 * Production-build smoke: boots `next start` against the EXISTING .next build
 * (run `npm run build` first — this script refuses to guess) and probes the
 * surfaces a deploy must serve:
 *
 *   - GET  /                    → 200, landing content
 *   - GET  /api/health          → 200, { ok: true } + config shape
 *   - GET  /no-such-page        → 404, the branded not-found copy
 *   - GET  /dashboard           → redirect to /login when unauthenticated
 *   - GET  /api/me/export       → 401 unauthenticated
 *   - POST /api/qualify/preview → 200 anonymous deterministic screening
 *
 * This is the hostile/logged-out half of the UAT depth bar that the dev-auth
 * journey harness cannot cover (dev-auth authenticates everything), run against
 * the real production bundle. Usage: node scripts/prod-smoke.mjs [port]
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const PORT = Number(process.argv[2] ?? 3021);
const BASE = `http://localhost:${PORT}`;

if (!existsSync(new URL("../.next/BUILD_ID", import.meta.url))) {
  console.error("prod-smoke: no .next build found — run `npm run build` first");
  process.exit(2);
}

const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
  stdio: ["ignore", "pipe", "pipe"],
  shell: process.platform === "win32",
});
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));

function killServer() {
  if (process.platform === "win32" && server.pid) {
    spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"], { windowsHide: true });
  } else {
    server.kill("SIGKILL");
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitReady(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  throw new Error(`server not ready within ${timeoutMs}ms\n${serverLog.slice(-2000)}`);
}

let failures = 0;
function check(name, ok, detail = "") {
  if (ok) console.log(`ok   ${name}`);
  else {
    failures++;
    console.error(`FAIL ${name} ${detail}`);
  }
}

try {
  await waitReady();

  {
    const res = await fetch(BASE);
    const html = await res.text();
    check("GET / serves the landing", res.status === 200 && html.length > 5_000, `status=${res.status}`);
  }
  {
    const res = await fetch(`${BASE}/api/health`);
    const body = await res.json();
    check(
      "GET /api/health reports ok + config shape",
      res.status === 200 && body.ok === true && "store" in body && "llm" in body,
      JSON.stringify(body),
    );
    console.log(`     health: ${JSON.stringify(body)}`);
  }
  {
    const res = await fetch(`${BASE}/definitely-not-a-page`);
    const html = await res.text();
    check(
      "GET /no-such-page renders the branded 404",
      res.status === 404 && html.includes("No such record"),
      `status=${res.status}`,
    );
  }
  {
    const res = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
    const location = res.headers.get("location") ?? "";
    // Firebase-configured (no cookie) → /login. Fully keyless builds also land
    // on /login via the layout redirect. Either a 3xx or an RSC-rendered
    // redirect is acceptable; what may NOT happen is a 200 dashboard.
    const redirected = res.status >= 300 && res.status < 400 && location.includes("/login");
    check(
      "GET /dashboard (unauthenticated) redirects to /login",
      redirected,
      `status=${res.status} location=${location}`,
    );
  }
  {
    const res = await fetch(`${BASE}/api/me/export`);
    check("GET /api/me/export (unauthenticated) → 401", res.status === 401, `status=${res.status}`);
  }
  {
    const res = await fetch(`${BASE}/api/qualify/preview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Smoke",
        classification: "O-1A",
        profile: "Prod-smoke probe: 6 papers, 412 citations, a granted patent, press coverage.",
      }),
    });
    const body = await res.json().catch(() => ({}));
    check(
      "POST /api/qualify/preview serves the anonymous screening",
      res.status === 200 && Array.isArray(body.criteria),
      `status=${res.status}`,
    );
  }
} catch (err) {
  failures++;
  console.error("FAIL smoke aborted:", err.message ?? err);
} finally {
  killServer();
}

if (failures > 0) {
  console.error(`\nprod-smoke: ${failures} failure(s)`);
  process.exit(1);
}
console.log("\nprod-smoke: all checks passed");
