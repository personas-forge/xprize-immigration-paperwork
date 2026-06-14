import "server-only";

/**
 * The LLM wrapper — one `generate(prompt, opts)` surface over two engines, so
 * the AI routes don't care which model backend is active.
 *
 *  - **Gemini** (default, production): the `@google/generative-ai` SDK.
 *  - **Claude Code CLI** (opt-in, local dev): shells out to `claude -p`, which
 *    uses your local Claude subscription login. No API key, no per-token billing
 *    — handy for rapid local iteration. NOT available in prod (Cloud Run has no
 *    interactive login) and does NOT handle image/multimodal input.
 *
 * Pick the engine with `LLM_ENGINE` (see config.ts). `getLlm()` returns `null`
 * when no engine is configured, so callers fall back to their deterministic
 * template output exactly as before.
 *
 * The raw model-call mechanics (engine selection, the Gemini SDK call, the Claude
 * CLI spawn) live in the `server-only`-free `./engines` module, shared with the
 * eval/e2e harness so the two can never drift. THIS module is the production
 * wrapper: it keeps the `server-only` guard and layers LightTrack observability +
 * output guards on top.
 *
 * IMAGE OPERATIONS: call `getLlm({ requiresImages: true })`. That can never
 * return the Claude CLI engine — it falls back to Gemini (or null). Today no
 * operation sends images; this guards the future Document AI / OCR work.
 */

import { LightTrack } from "@/lib/lighttrack";
import { withGuards, LLM_OUTPUT_GUARD } from "./guards";
import { claudeModel } from "./config";
import {
  callGemini,
  runClaudeCli,
  selectEngine,
  type GenerateOptions,
  type Llm,
} from "./engines";

// Re-exported so existing importers keep importing from `@/lib/llm/client`
// unchanged (operation.ts: GenerateOptions; guards.ts / guards.test.ts: Llm).
export type { GenerateOptions, Llm };

/**
 * The active LLM engine, or `null` for the template fallback. Pass
 * `requiresImages: true` for multimodal operations — the Claude CLI engine is
 * excluded for those (it can't process images).
 */
export function getLlm(opts: { requiresImages?: boolean } = {}): Llm | null {
  const engine = selectEngine(opts);
  // Output guards are composed transparently via the decorator (ADR-0008) — each
  // engine stays guard-free; `withGuards` applies the shared rule once, sharing
  // the module `lt` so the score's `source` attribution stays per-engine.
  if (engine === "gemini") return withGuards(geminiClient(), LLM_OUTPUT_GUARD, lt);
  if (engine === "claude") return withGuards(claudeClient(), LLM_OUTPUT_GUARD, lt);
  return null;
}

// LightTrack observability (fire-and-forget; LIGHTTRACK_URL from env, default localhost:8787).
const lt = new LightTrack({ project: "immigration-paperwork", source: "gemini" });

function geminiClient(): Llm {
  return {
    name: "gemini",
    async generate(prompt, options = {}) {
      // engines.callGemini measures the generateContent latency itself (around
      // the call only), so the tracked latency matches the prior measurement.
      const { text, response, model, latencyMs } = await callGemini(prompt, options);
      lt.trackGemini(response, model, { latencyMs });
      return text;
    },
  };
}

function claudeClient(): Llm {
  return {
    name: "claude",
    // The CLI model is fixed by config; `json` is driven by the prompt and the
    // tolerant parsers, so options aren't needed on this path.
    async generate(prompt) {
      // Text-mode CLI gives no token usage; track the call + latency + model only.
      const startedAt = Date.now();
      try {
        const out = await runClaudeCli(prompt);
        lt.track("anthropic", claudeModel(), { latencyMs: Date.now() - startedAt });
        return out;
      } catch (err) {
        lt.track("anthropic", claudeModel(), {
          latencyMs: Date.now() - startedAt,
          status: "error",
          error: String(err),
        });
        throw err;
      }
    },
  };
}
