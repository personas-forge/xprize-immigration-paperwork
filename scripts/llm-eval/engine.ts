/**
 * Eval-harness LLM wrapper.
 *
 * The engine mechanics — selection, the Gemini SDK call, the Claude CLI spawn —
 * now live in the shared, `server-only`-free `@/lib/llm/engines`, imported by
 * BOTH this harness and the production `client.ts`. The previous hand-maintained
 * copy here had drifted (it lost the stdin hang-guard, `temperature`, and the SDK
 * memoization); single-sourcing the bodies makes that impossible.
 *
 * This wrapper runs the engines BARE: no LightTrack observability and no output
 * guards — the harness asserts raw engine behavior under `tsx`. The `server-only`
 * guard that `client.ts` carries is the only thing it intentionally drops.
 */
import {
  callGemini,
  runClaudeCli,
  selectEngine,
  type Llm,
} from "@/lib/llm/engines";

export function getLlm(): Llm | null {
  const engine = selectEngine();
  if (engine === "gemini") {
    return {
      name: "gemini",
      async generate(prompt, options = {}) {
        return (await callGemini(prompt, options)).text;
      },
    };
  }
  if (engine === "claude") {
    return { name: "claude", generate: (prompt) => runClaudeCli(prompt) };
  }
  return null;
}
