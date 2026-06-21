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

function geminiClient(): Llm {
  return {
    name: "gemini",
    async generate(prompt, options = {}) {
      // Capture startedAt here so the error path (below) can still report latency
      // even when callGemini throws before returning a GeminiCall.
      const startedAt = Date.now();
      try {
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
      } catch (err) {
        // A Gemini safety-block / empty-candidates throw is EXACTLY the call you
        // most want in observability — the Claude path emits error telemetry; the
        // Gemini path used to drop it, so error/margin dashboards under-counted.
        void trackLlm({
          provider: "google",
          model: geminiModelFor(options.tier ?? "fast"),
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
      } catch (err) {
        void trackLlm({
          provider: "anthropic",
          model: claudeModel(),
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
