/**
 * Shared LLM engine mechanics — the Gemini SDK call, the Claude CLI spawn, and
 * the engine selection — with NO `import "server-only"`, so the eval/e2e harness
 * can load it under `tsx`/Playwright. This is the SINGLE home for the model-call
 * bodies:
 *   - the production wrapper `client.ts` imports these and layers LightTrack
 *     observability + output guards on top (and keeps the `server-only` guard);
 *   - the eval harness `scripts/llm-eval/engine.ts` runs them bare.
 *
 * Before this module, the harness kept a hand-maintained COPY of these bodies
 * that drifted from production — it had lost the stdin hang-guard, the
 * `temperature` option, and the Gemini SDK memoization. Single-sourcing them
 * makes that drift impossible.
 *
 * SERVER / TOOLING ONLY: this spawns a child process and loads the Gemini SDK.
 * It deliberately has no `server-only` guard (so the harness can import it) — do
 * NOT import it from a client component.
 */

import { spawn } from "node:child_process";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  claudeBin,
  claudeModel,
  geminiModelFor,
  resolveEngine,
  type LlmEngine,
  type LlmTier,
} from "./config";

export interface GenerateOptions {
  /** Ask for a JSON response (Gemini sets responseMimeType; the Claude path
   *  relies on the prompt instructing JSON). */
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
 * Resolve the active engine for a request, applying the multimodal downgrade:
 * the Claude CLI can't process images, so `requiresImages` excludes it (→ Gemini
 * when keyed, else null). Shared so the production wrapper and the harness select
 * the engine identically.
 */
export function selectEngine(opts: { requiresImages?: boolean } = {}): LlmEngine | null {
  let engine = resolveEngine();
  if (opts.requiresImages && engine === "claude") {
    engine = process.env.GEMINI_API_KEY ? "gemini" : null;
  }
  return engine;
}

// Memoize the SDK client so concurrent generate() calls don't each re-read the
// env var and re-allocate a GoogleGenerativeAI. The per-call model (with its own
// generationConfig) is still constructed per request in callGemini.
let genAISingleton: GoogleGenerativeAI | null = null;
function geminiSdk(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  if (!genAISingleton) genAISingleton = new GoogleGenerativeAI(key);
  return genAISingleton;
}

/** A raw Gemini call result. `response` is the SDK response object, passed to
 *  LightTrack's `trackGemini` (typed `unknown`) for usage extraction; the harness
 *  ignores it. `latencyMs` measures the `generateContent` call only (excluding
 *  model construction), matching the prior production measurement exactly. */
export interface GeminiCall {
  text: string;
  response: unknown;
  model: string;
  latencyMs: number;
}

/** Call Gemini for a prompt. The caller decides whether to track / guard the
 *  result — this only does the model call. */
export async function callGemini(
  prompt: string,
  options: GenerateOptions = {},
): Promise<GeminiCall> {
  const genAI = geminiSdk();
  const model = geminiModelFor(options.tier ?? "fast");
  const m = genAI.getGenerativeModel({
    model,
    generationConfig: {
      ...(options.json ? { responseMimeType: "application/json" } : {}),
      ...(typeof options.temperature === "number" ? { temperature: options.temperature } : {}),
    },
  });
  const startedAt = Date.now();
  const r = await m.generateContent(prompt);
  return { text: r.response.text(), response: r.response, model, latencyMs: Date.now() - startedAt };
}

const CLAUDE_TIMEOUT_MS = 180_000;

/**
 * Run `claude -p` non-interactively, feeding the prompt on STDIN (never as a
 * shell argument — no injection, no arg-length limits). The command is a single
 * shell string (no argv array → avoids Node's DEP0190) so the OS resolves
 * `claude`/`claude.cmd` cross-platform.
 *
 * TWO interpolated values land in the shell string and BOTH are hardened: the
 * model id is sanitised to `[A-Za-z0-9._-]` (config.ts), and the bin path —
 * operator config (`CLAUDE_CLI_PATH`) — is now QUOTED (so a normal Windows path
 * with spaces like `C:\Program Files\…\claude.cmd` isn't tokenised) and rejected
 * outright if it contains shell metacharacters (so it can't break out of the
 * quotes / chain a command).
 */
export function runClaudeCli(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const bin = claudeBin();
    if (/["'`$;&|<>\n\r]/.test(bin)) {
      reject(new Error("CLAUDE_CLI_PATH contains unsafe shell characters"));
      return;
    }
    const command = `"${bin}" -p --output-format text --model ${claudeModel()}`;
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
