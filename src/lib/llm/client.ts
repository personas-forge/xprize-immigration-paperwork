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
  if (engine === "gemini") return geminiClient();
  if (engine === "claude") return claudeClient();
  return null;
}

function geminiClient(): Llm {
  return {
    name: "gemini",
    async generate(prompt, options = {}) {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const model = genAI.getGenerativeModel({
        model: geminiModelFor(options.tier ?? "fast"),
        ...(options.json
          ? { generationConfig: { responseMimeType: "application/json" } }
          : {}),
      });
      const r = await model.generateContent(prompt);
      return r.response.text();
    },
  };
}

function claudeClient(): Llm {
  return {
    name: "claude",
    // The CLI model is fixed by config; `json` is driven by the prompt and the
    // tolerant parsers, so options aren't needed on this path.
    generate(prompt) {
      return runClaudeCli(prompt);
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
    child.on("close", (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(`claude CLI exited with code ${code}: ${err.slice(0, 400)}`));
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}
