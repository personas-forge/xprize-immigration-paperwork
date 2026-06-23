import assert from "node:assert/strict";
import { test } from "node:test";

import { LightTrack, type GuardResult } from "../lighttrack";
import { withGuards, LLM_OUTPUT_GUARD } from "./guards";
import type { Llm } from "./engines";

// A minimal in-memory engine standing in for the gemini/claude clients. Records
// the prompt/opts it was called with so we can assert transparent forwarding.
function fakeLlm(name: Llm["name"], output: string, seen?: { prompt?: string; opts?: unknown }): Llm {
  return {
    name,
    async generate(prompt, opts) {
      if (seen) {
        seen.prompt = prompt;
        seen.opts = opts;
      }
      return output;
    },
  };
}

// A stub tracker that records every trackGuard() call and returns a verdict
// derived from a trivial non-empty check — lets us assert the decorator wires
// the guard without depending on LightTrack internals.
function spyTracker() {
  const calls: Array<{ output: string; rules: unknown; opts: unknown }> = [];
  const stub = {
    trackGuard(output: string, rules: unknown, opts: unknown): GuardResult {
      calls.push({ output, rules, opts });
      const ok = output.trim().length > 0;
      return { ok, violations: ok ? [] : ["too short: 0 words < 1"], checks: {} };
    },
  };
  return { stub: stub as unknown as LightTrack, calls };
}

// A real LightTrack with no endpoint configured: it never posts over the network
// but still runs the deterministic guard() and returns the verdict.
function realTracker(): LightTrack {
  return new LightTrack({ project: "test", source: "gemini" });
}

test("preserves the wrapped engine name and forwards prompt + opts unchanged", async () => {
  const seen: { prompt?: string; opts?: unknown } = {};
  const { stub } = spyTracker();
  const guarded = withGuards(fakeLlm("gemini", "ok output", seen), LLM_OUTPUT_GUARD, stub);

  assert.equal(guarded.name, "gemini", "engine name is preserved through the decorator");

  const out = await guarded.generate("hello", { json: true, tier: "fast" });
  assert.equal(out, "ok output", "output returned byte-for-byte");
  assert.equal(seen.prompt, "hello", "prompt forwarded to the inner engine");
  assert.deepEqual(seen.opts, { json: true, tier: "fast" }, "opts forwarded to the inner engine");
});

test("invokes trackGuard exactly once with the configured rule and llm-output name", async () => {
  const { stub, calls } = spyTracker();
  const guarded = withGuards(fakeLlm("gemini", "a valid answer"), LLM_OUTPUT_GUARD, stub);

  await guarded.generate("p");

  assert.equal(calls.length, 1, "guard runs once per generate");
  assert.equal(calls[0].output, "a valid answer", "guard sees the engine output");
  assert.deepEqual(calls[0].rules, LLM_OUTPUT_GUARD, "guard uses the shared LLM_OUTPUT_GUARD rule");
  assert.deepEqual(calls[0].opts, { name: "llm-output" }, "guard score is named llm-output");
});

test("returns output unchanged AND warns when the guard fails (non-blocking)", async () => {
  const warnings: string[] = [];
  const orig = console.warn;
  console.warn = (...a: unknown[]) => {
    warnings.push(a.join(" "));
  };
  try {
    const guarded = withGuards(fakeLlm("gemini", "   "), LLM_OUTPUT_GUARD, realTracker());
    const out = await guarded.generate("p");
    assert.equal(out, "   ", "blank output is still returned — guards never block");
    assert.equal(warnings.length, 1, "a violation is warned exactly once");
    assert.match(warnings[0], /output guard flagged/, "warning identifies the guard");
  } finally {
    console.warn = orig;
  }
});

test("clean output passes the guard with no warning", async () => {
  const warnings: string[] = [];
  const orig = console.warn;
  console.warn = (...a: unknown[]) => {
    warnings.push(a.join(" "));
  };
  try {
    const guarded = withGuards(fakeLlm("claude", "This is a valid, sufficiently long answer."), LLM_OUTPUT_GUARD, realTracker());
    const out = await guarded.generate("p");
    assert.equal(out, "This is a valid, sufficiently long answer.");
    assert.equal(warnings.length, 0, "clean output produces no warning");
  } finally {
    console.warn = orig;
  }
});

test("does not run the guard when the inner engine rejects; the error propagates", async () => {
  const { stub, calls } = spyTracker();
  const boom: Llm = {
    name: "claude",
    async generate() {
      throw new Error("claude CLI failed");
    },
  };
  const guarded = withGuards(boom, LLM_OUTPUT_GUARD, stub);

  await assert.rejects(() => guarded.generate("p"), /claude CLI failed/, "rejection propagates unchanged");
  assert.equal(calls.length, 0, "the guard must not run on a rejected generate");
});
