/**
 * Faithful, `server-only`-free mirror of `src/lib/llm/client.ts` for the eval
 * harness.
 *
 * `client.ts` opens with `import "server-only"`, a package Next.js injects at
 * build time but that isn't installed for a plain `tsx` run — so it can't be
 * imported outside the Next bundler. This module reproduces the wrapper exactly
 * while reusing the REAL resolution logic (`src/lib/llm/config.ts`) and the REAL
 * feature prompt builders/parsers (imported by the harness). Only the
 * `server-only` guard is dropped.
 *
 * Keep in sync with `src/lib/llm/client.ts`.
 */
import { spawn } from "node:child_process";
import {
  claudeBin,
  claudeModel,
  geminiModelFor,
  resolveEngine,
  type LlmEngine,
  type LlmTier,
} from "@/lib/llm/config";

export interface GenerateOptions {
  json?: boolean;
  tier?: LlmTier;
}

export interface Llm {
  readonly name: LlmEngine;
  generate(prompt: string, opts?: GenerateOptions): Promise<string>;
}

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
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
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
    generate(prompt) {
      return runClaudeCli(prompt);
    },
  };
}

const CLAUDE_TIMEOUT_MS = 180_000;

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
