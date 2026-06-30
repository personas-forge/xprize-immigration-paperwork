// Derive the expected result `source` from the CANONICAL engine resolver
// (src/lib/llm/config.ts, unit-pinned) rather than re-stating its precedence
// here — otherwise a change to the engine-selection rule produces zero compile
// error in this file and the specs quietly assert a stale `source`. The `@/`
// alias resolves under Playwright via tsconfig paths.
import { resolveEngine } from "@/lib/llm/config";

export type ExpectedSource = "mock" | "gemini" | "claude";

export const EXPECTED_SOURCE: ExpectedSource = resolveEngine() ?? "mock";

/** The badge label the UI shows for the active engine. */
export const EXPECTED_BADGE =
  EXPECTED_SOURCE === "claude"
    ? "Claude"
    : EXPECTED_SOURCE === "gemini"
      ? "Gemini"
      : "Template";

/** Per-request timeout — a live model call can take a while. */
export const AI_TIMEOUT = 200_000;
