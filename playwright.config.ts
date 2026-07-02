import { defineConfig, devices } from "@playwright/test";

// E2E harness — boots the real app and drives the AI flows end-to-end. The
// server runs KEYLESS + unmetered (no DB, no auth, TOKENS_BYPASS=1) so the
// public /qualify flow and every AI route work with no backend.
//
// Engine selection is forwarded from the shell, so:
//   npm run e2e                          → template fallback (deterministic, CI-safe)
//   LLM_ENGINE=claude npm run e2e        → exercises the Claude Code CLI for real
//   GEMINI_API_KEY=... npm run e2e       → exercises Gemini
//
// The specs assert the result `source` matches the active engine, so a green
// `LLM_ENGINE=claude` run proves the Claude path actually executed.

const PORT = Number(process.env.E2E_PORT ?? 3003);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // The UAT journeys live under e2e/uat with their OWN config (metered PGlite
  // server, fake engine — playwright.uat.config.ts / `npm run uat`); under this
  // keyless config they would run against the wrong server.
  testIgnore: "uat/**",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],
  // Generous: a live Claude/Gemini draft can take a couple of minutes.
  timeout: 240_000,
  expect: { timeout: 180_000 },
  use: {
    baseURL: BASE_URL,
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      // Keyless + unmetered: no DB, no auth, token guard free-passes.
      TOKENS_BYPASS: "1",
      DATABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      // Engine selection forwarded from the shell.
      LLM_ENGINE: process.env.LLM_ENGINE ?? "",
      CLAUDE_CLI_PATH: process.env.CLAUDE_CLI_PATH ?? "claude",
      CLAUDE_CLI_MODEL: process.env.CLAUDE_CLI_MODEL ?? "sonnet",
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "",
    },
  },
});
