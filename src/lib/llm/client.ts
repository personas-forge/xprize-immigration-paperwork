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
import { trackLlm } from "@/lib/cost-telemetry";
import { withGuards, LLM_OUTPUT_GUARD } from "./guards";
import { claudeModel, geminiModelFor } from "./config";
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

/**
 * Wrap an engine's generate so the ERROR-path telemetry (provider, model,
 * latency, status:"error", rethrow) is emitted in ONE place rather than copy-
 * pasted into each engine's catch — the drift that once let the Gemini path drop
 * its error events while Claude reported them. The success-side `trackLlm` stays
 * inside each engine (token usage genuinely differs: Gemini reports usageMetadata,
 * the text-mode Claude CLI reports none). `startedAt` is captured here so a throw
 * before the engine returns still reports latency. Mirrors the withGuards
 * decorator (ADR-0008).
 */
function withTelemetry(
  name: Llm["name"],
  provider: "google" | "anthropic",
  modelOnError: (options: GenerateOptions) => string,
  run: (prompt: string, options: GenerateOptions, startedAt: number) => Promise<string>,
): Llm {
  return {
    name,
    async generate(prompt, options = {}) {
      const startedAt = Date.now();
      try {
        return await run(prompt, options, startedAt);
      } catch (err) {
        void trackLlm({
          provider,
          model: modelOnError(options),
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: Date.now() - startedAt,
          status: "error",
        });
        throw err;
      }
    },
  };
}

function geminiClient(): Llm {
  return withTelemetry(
    "gemini",
    "google",
    (options) => geminiModelFor(options.tier ?? "fast"),
    async (prompt, options) => {
      // engines.callGemini measures the generateContent latency itself (around
      // the call only), so the tracked latency matches the prior measurement.
      const { text, response, model, latencyMs } = await callGemini(prompt, options);
      // LLM /v1/events emission → external LightTrack (cost netted against Polar revenue), tagged to the
      // ambient billing customer set by executeAiOperation's runWithBilling. Real usage from the Gemini
      // SDK's usageMetadata (promptTokenCount / candidatesTokenCount); fire-and-forget, never blocks.
      const usage = (response as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } })
        .usageMetadata;
      void trackLlm({
        provider: "google",
        model,
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
        latencyMs,
        // Empty/whitespace output produced nothing usable (the route guard will
        // reclaim + fall to mock) — mark it 'error' so it isn't counted as a
        // successful generation in the margin/failure-rate dashboards.
        status: text.trim() === "" ? "error" : "success",
      });
      return text;
    },
  );
}

function claudeClient(): Llm {
  // The CLI model is fixed by config; `json` is driven by the prompt and the
  // tolerant parsers, so options aren't needed on this path.
  return withTelemetry(
    "claude",
    "anthropic",
    () => claudeModel(),
    async (prompt, _options, startedAt) => {
      const out = await runClaudeCli(prompt);
      // LLM /v1/events emission → external LightTrack. The text-mode CLI gives no token usage, so cost
      // is tracked as a zero-token call (latency + model only). Sole emission per call — the old SDK-
      // client `lt.track` path was removed to avoid double counting.
      void trackLlm({
        provider: "anthropic",
        model: claudeModel(),
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: Date.now() - startedAt,
        // Blank CLI output is a non-result (route guard → mock); don't count it
        // as a successful generation.
        status: out.trim() === "" ? "error" : "success",
      });
      return out;
    },
  );
}
