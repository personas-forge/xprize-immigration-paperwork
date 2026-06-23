/**
 * Pure, env-injectable configuration for the LLM layer — engine selection and
 * model resolution. No `server-only` and no Node built-ins so it stays unit-
 * testable; `client.ts` consumes it and does the actual model calls.
 */

export type LlmEngine = "gemini" | "claude";

/** Abstract model tier. "fast" for short/structured ops; "long" for full-letter
 *  generation (maps to a long-context model on Gemini). */
export type LlmTier = "fast" | "long";

type Env = Record<string, string | undefined>;

/**
 * Decide which engine the AI routes should use, or `null` for the deterministic
 * template fallback. Precedence:
 *  - `LLM_ENGINE=gemini`  → Gemini, but only if GEMINI_API_KEY is set (else null)
 *  - `LLM_ENGINE=claude`  → Claude Code CLI (no API key needed; local subscription)
 *  - unset / "auto"       → Gemini when GEMINI_API_KEY is set, otherwise null
 *
 * The CLI is never selected implicitly — spawning a subprocess must be an
 * explicit opt-in (it's a local-dev engine; the login isn't present in prod).
 */
export function resolveEngine(env: Env = process.env): LlmEngine | null {
  const explicit = (env.LLM_ENGINE ?? "").trim().toLowerCase();
  if (explicit === "gemini") return env.GEMINI_API_KEY ? "gemini" : null;
  if (explicit === "claude" || explicit === "claude-cli" || explicit === "claude-code") {
    return "claude";
  }
  // unset / "auto" / anything else → default behaviour (unchanged).
  if (env.GEMINI_API_KEY) return "gemini";
  return null;
}

/** The Gemini model id for a tier. "long" uses GEMINI_DRAFT_MODEL when set. */
export function geminiModelFor(tier: LlmTier, env: Env = process.env): string {
  const fast = env.GEMINI_MODEL ?? "gemini-3-flash-preview";
  return tier === "long" ? env.GEMINI_DRAFT_MODEL ?? fast : fast;
}

/** Path to the Claude Code CLI binary (defaults to `claude` on PATH). */
export function claudeBin(env: Env = process.env): string {
  return env.CLAUDE_CLI_PATH ?? "claude";
}

const DEFAULT_CLAUDE_MODEL = "sonnet";

/** Claude model alias/id for the CLI. Sanitised — it goes into argv. */
export function claudeModel(env: Env = process.env): string {
  const m = env.CLAUDE_CLI_MODEL ?? DEFAULT_CLAUDE_MODEL;
  return m.replace(/[^a-zA-Z0-9._-]/g, "") || DEFAULT_CLAUDE_MODEL;
}
