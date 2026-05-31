/**
 * Smoke test for the LLM-eval harness wiring.
 *
 * Confirms two things before we build the full harness:
 *   1. tsx resolves the `@/` path alias (used by config.ts + feature modules).
 *   2. The active engine actually answers (a real `claude -p` round-trip).
 *
 * Run: LLM_ENGINE=claude npx tsx scripts/llm-eval/smoke.ts
 */
import { getLlm } from "./engine";

async function main(): Promise<void> {
  const llm = getLlm();
  console.log("resolved engine:", llm?.name ?? "none (would use mock)");
  if (!llm) {
    console.log("No engine resolved — set LLM_ENGINE=claude (CLI) or GEMINI_API_KEY.");
    process.exit(2);
  }
  const t0 = Date.now();
  const out = await llm.generate(
    'Return STRICT JSON ONLY, no prose: {"ok": true, "engine": "<your model family>"}',
    { json: true, tier: "fast" },
  );
  console.log(`round-trip: ${Date.now() - t0}ms`);
  console.log("raw output:\n" + out);
}

main().catch((e) => {
  console.error("SMOKE FAILED:", e);
  process.exit(1);
});
