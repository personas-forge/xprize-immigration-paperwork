import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

// UAT harness — user journeys driven through the real UI against REAL billing
// and persistence (billing-and-uat.md B1): PGlite store, dev-auth identity,
// metering ON (no TOKENS_BYPASS), and the app's real `claude` engine path with
// CLAUDE_CLI_PATH pointed at the deterministic fake CLI (e2e/uat/fake-claude.mjs)
// — the nondeterministic upstream is stubbed at the process boundary, so debits,
// reclaims, paywalls, and persistence behave exactly as production.
//
// KNOWN DEVIATION from B1: this runs `next dev`, not a production build —
// dev-auth is hard-gated to NODE_ENV!=="production" (a safety property we must
// not weaken), so authenticated journeys cannot run under `next start` without
// a real Firebase project. A separate prod-build smoke covers boot/serve.
//
// The PGlite dir is wiped by global-setup, so every run starts from a fresh
// seed: the dev user exists, has NOT consented, and holds 0 tokens until the
// signup grant. Specs are therefore order-dependent within one journey file but
// files must not depend on each other beyond the shared onboarded user
// (helpers.ensureOnboarded is idempotent).

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.UAT_PORT ?? 3013);
const BASE_URL = `http://localhost:${PORT}`;

export const UAT_PGLITE_DIR = path.join(here, "e2e", "uat", ".pglite");

/** Webhook secret for the simulated Polar `order.paid` payloads (standardwebhooks
 *  format: whsec_ + base64 key). The uat-billing spec signs with the same key. */
export const UAT_WEBHOOK_SECRET = `whsec_${Buffer.from(
  "uat-webhook-secret-0123456789abcdef",
).toString("base64")}`;

/** Fake Polar product ids — the webhook resolves bundles by product id. */
export const UAT_PRODUCTS = {
  starter: "uat_prod_starter",
  builder: "uat_prod_builder",
  pro: "uat_prod_pro",
  scale: "uat_prod_scale",
  monthly: "uat_prod_monthly",
} as const;

const fakeClaude = path.join(
  here,
  "e2e",
  "uat",
  process.platform === "win32" ? "fake-claude.cmd" : "fake-claude.mjs",
);

export default defineConfig({
  testDir: "./e2e/uat",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0, // a flaky journey is a finding, not a retry (B4)
  reporter: process.env.CI
    ? "list"
    : [["list"], ["html", { open: "never", outputFolder: "playwright-report-uat" }]],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  globalSetup: "./e2e/uat/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: "on-first-retry",
  },
  projects: [{ name: "uat-chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: BASE_URL,
    // Never reuse: a stale server holds the previous run's PGlite dir open and
    // would defeat the fresh-seed determinism rule.
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      // Identity + persistence: synthetic dev user over an embedded PGlite store.
      NEXT_PUBLIC_DEV_AUTH: "1",
      DB_DRIVER: "pglite",
      PGLITE_PATH: UAT_PGLITE_DIR,
      // Metering ON — explicit empty shields against ambient shell/.env values.
      TOKENS_BYPASS: "",
      // Deterministic "model": the real claude engine path, fake CLI behind it.
      LLM_ENGINE: "claude",
      CLAUDE_CLI_PATH: fakeClaude,
      GEMINI_API_KEY: "",
      // Journeys click fast and repeatedly; the limiter is not under test here
      // (the hostile-user journey re-enables it via its own server if needed).
      RATE_LIMIT_DISABLED: "1",
      // Polar: no access token (checkout 503s — asserted as such), but the
      // webhook is live + signature-verified for the simulated purchase journey.
      POLAR_ACCESS_TOKEN: "",
      POLAR_WEBHOOK_SECRET: UAT_WEBHOOK_SECRET,
      POLAR_SERVER: "sandbox",
      POLAR_PRODUCT_STARTER: UAT_PRODUCTS.starter,
      POLAR_PRODUCT_BUILDER: UAT_PRODUCTS.builder,
      POLAR_PRODUCT_PRO: UAT_PRODUCTS.pro,
      POLAR_PRODUCT_SCALE: UAT_PRODUCTS.scale,
      POLAR_PRODUCT_MONTHLY: UAT_PRODUCTS.monthly,
      // The dev user doubles as the configured attorney for review journeys.
      ATTORNEY_EMAILS: "developer@localhost",
      OPS_EMAILS: "",
      // Telemetry off.
      LIGHTTRACK_URL: "",
      LIGHTTRACK_KEY: "",
    },
  },
});
