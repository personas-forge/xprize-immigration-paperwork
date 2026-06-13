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
 * IMAGE OPERATIONS: call `getLlm({ requiresImages: true })`. That can never
 * return the Claude CLI engine — it falls back to Gemini (or null). Today no
 * operation sends images; this guards the future Document AI / OCR work.
 */

import { spawn } from "node:child_process";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { LightTrack } from "@/lib/lighttrack";
import { withGuards, LLM_OUTPUT_GUARD } from "./guards";
import {
  claudeBin,
  claudeModel,
  geminiModelFor,
  resolveEngine,
  type LlmEngine,
  type LlmTier,
} from "./config";

export interface GenerateOptions {
  /** Ask for a JSON response (Gemini sets responseMimeType; the prompt also
   *  instructs JSON, so the Claude path relies on the prompt). */
  json?: boolean;
  /** Model tier — "fast" (default) or "long" for full-letter generation. */
  tier?: LlmTier;
  /** Sampling temperature (Gemini only). Use 0 for deterministic structured ops
   *  like screening/categorization. The Claude CLI path has no temperature knob. */
  temperature?: number;
}

export interface Llm {
  readonly name: LlmEngine;
  generate(prompt: string, opts?: GenerateOptions): Promise<string>;
}

/**
 * The active LLM engine, or `null` for the template fallback. Pass
 * `requiresImages: true` for multimodal operations — the Claude CLI engine is
 * excluded for those (it can't process images).
 */
export function getLlm(opts: { requiresImages?: boolean } = {}): Llm | null {
  let engine = resolveEngine();
  if (opts.requiresImages && engine === "claude") {
    engine = process.env.GEMINI_API_KEY ? "gemini" : null;
  }
  // Output guards are composed transparently via the decorator (ADR-0008) — each
  // engine stays guard-free; `withGuards` applies the shared rule once, sharing
  // the module `lt` so the score's `source` attribution stays per-engine.
  if (engine === "gemini") return withGuards(geminiClient(), LLM_OUTPUT_GUARD, lt);
  if (engine === "claude") return withGuards(claudeClient(), LLM_OUTPUT_GUARD, lt);
  return null;
}

// LightTrack observability (fire-and-forget; LIGHTTRACK_URL from env, default localhost:8787).
const lt = new LightTrack({ project: "immigration-paperwork", source: "gemini" });

// Memoize the SDK client so concurrent generate() calls don't each re-read the
// env var and re-allocate a GoogleGenerativeAI. The per-call model (with its own
// generationConfig) is still constructed per request below.
let genAISingleton: GoogleGenerativeAI | null = null;
function geminiSdk(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  if (!genAISingleton) genAISingleton = new GoogleGenerativeAI(key);
  return genAISingleton;
}

function geminiClient(): Llm {
  return {
    name: "gemini",
    async generate(prompt, options = {}) {
      const genAI = geminiSdk();
      const modelName = geminiModelFor(options.tier ?? "fast");
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          ...(options.json ? { responseMimeType: "application/json" } : {}),
          ...(typeof options.temperature === "number" ? { temperature: options.temperature } : {}),
        },
      });
      const startedAt = Date.now();
      const r = await model.generateContent(prompt);
      lt.trackGemini(r.response, modelName, { latencyMs: Date.now() - startedAt });
      return r.response.text();
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

const CLAUDE_TIMEOUT_MS = 180_000;

/**
 * Run `claude -p` non-interactively, feeding the prompt on STDIN (never as a
 * shell argument — no injection, no arg-length limits). The command is a single
 * shell string (no argv array → avoids Node's DEP0190) so the OS resolves
 * `claude`/`claude.cmd` cross-platform; the only interpolated value is the
 * sanitised model id, and the bin path is operator config.
 */
function runClaudeCli(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const command = `${claudeBin()} -p --output-format text --model ${claudeModel()}`;
    const child = spawn(command, {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: CLAUDE_TIMEOUT_MS,
      windowsHide: true,
      shell: true,
    });

    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", reject);
    // A stdin pipe error (e.g. the child exits immediately on auth failure and
    // closes the pipe) would otherwise be an unhandled stream 'error' and could
    // hang the promise until the 180s timeout — reject like the process error.
    child.stdin.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(`claude CLI exited with code ${code}: ${err.slice(0, 400)}`));
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}
