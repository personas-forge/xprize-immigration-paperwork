// Mirrors src/lib/llm/config.ts `resolveEngine()` so the specs can assert the
// result `source` matches whatever engine the server was launched with:
// explicit claude wins (no API key needed); else gemini when GEMINI_API_KEY is
// set; else the deterministic template fallback.

const ENGINE = (process.env.LLM_ENGINE ?? "").toLowerCase();
const EXPECT_CLAUDE =
  ENGINE === "claude" || ENGINE === "claude-cli" || ENGINE === "claude-code";

export type ExpectedSource = "mock" | "gemini" | "claude";

export const EXPECTED_SOURCE: ExpectedSource = EXPECT_CLAUDE
  ? "claude"
  : process.env.GEMINI_API_KEY
    ? "gemini"
    : "mock";

/** The badge label the UI shows for the active engine. */
export const EXPECTED_BADGE =
  EXPECTED_SOURCE === "claude"
    ? "Claude"
    : EXPECTED_SOURCE === "gemini"
      ? "Gemini"
      : "Template";

/** Per-request timeout — a live model call can take a while. */
export const AI_TIMEOUT = 200_000;
