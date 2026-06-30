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
// unchanged (operation.ts: GenerateOptions). Intra-`llm/` consumers import the
// types straight from `./engines` where they're defined.
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
  // the module `lt`. NOTE: `lt`'s `source` is fixed at construction (`"gemini"`),
  // so the guard score is attributed to `scored_by: "guard:gemini"` for BOTH
  // engines — it is NOT per-engine.
  if (engine === "gemini") return withGuards(geminiClient(), LLM_OUTPUT_GUARD, lt);
  if (engine === "claude") return withGuards(claudeClient(), LLM_OUTPUT_GUARD, lt);
  return null;
}

// LightTrack observability (fire-and-forget; LIGHTTRACK_URL from env, default localhost:8787).
const lt = new LightTrack({ project: "immigration-paperwork", source: "gemini" });

/** What an engine's `run` reports so `withTelemetry` can emit ONE success event.
 *  Each engine supplies its own model/usage/latency (Gemini: real usageMetadata +
 *  the SDK-measured call latency; the text-mode Claude CLI: zero tokens + the
 *  wall-clock latency), and `withTelemetry` owns the empty-output → "error" rule. */
interface EngineRun {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

/**
 * Wrap an engine's generate so BOTH the success- and error-path telemetry are
 * emitted in ONE place rather than copy-pasted into each engine — the drift that
 * once let the Gemini path drop its error events while Claude reported them, and
 * kept the empty-output→"error" rule duplicated per engine. The engine `run`
 * returns its text + the model/usage/latency it alone knows (see {@link EngineRun});
 * this decorator applies the shared empty-output rule and the fire-and-forget
 * `trackLlm`. `startedAt` is captured here so a throw before the engine returns
 * still reports latency. Mirrors the withGuards decorator (ADR-0008).
 */
function withTelemetry(
  name: Llm["name"],
  provider: "google" | "anthropic",
  modelOnError: (options: GenerateOptions) => string,
  run: (prompt: string, options: GenerateOptions, startedAt: number) => Promise<EngineRun>,
): Llm {
  return {
    name,
    async generate(prompt, options = {}) {
      const startedAt = Date.now();
      try {
        const result = await run(prompt, options, startedAt);
        // LLM /v1/events emission → external LightTrack (cost netted against Polar
        // revenue), tagged to the ambient billing customer set by
        // executeAiOperation's runWithBilling. Fire-and-forget, never blocks.
        void trackLlm({
          provider,
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          latencyMs: result.latencyMs,
          // Empty/whitespace output produced nothing usable (the route guard will
          // reclaim + fall to mock) — mark it 'error' so it isn't counted as a
          // successful generation in the margin/failure-rate dashboards.
          status: result.text.trim() === "" ? "error" : "success",
        });
        return result.text;
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
      // Real usage from the Gemini SDK's usageMetadata (promptTokenCount /
      // candidatesTokenCount); withTelemetry emits the /v1/events record.
      const usage = (response as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } })
        .usageMetadata;
      return {
        text,
        model,
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
        latencyMs,
      };
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
      // The text-mode CLI gives no token usage, so it's a zero-token call
      // (latency + model only); withTelemetry emits the /v1/events record.
      return {
        text: out,
        model: claudeModel(),
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: Date.now() - startedAt,
      };
    },
  );
}
