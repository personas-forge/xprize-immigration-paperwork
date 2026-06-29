import assert from "node:assert/strict";
import { test } from "node:test";

import { claudeModel, geminiModelFor, isLongTierOnFastFallback, resolveEngine } from "./config";
import { isTransientGeminiError } from "./engines";
import { asModelSource, isModelSource, sourceLabel } from "./label";

// — Gemini retry classification ───────────────────────────────────────────────

test("isTransientGeminiError: retries rate-limit / 5xx / network / deadline only", () => {
  // transient (retry)
  assert.equal(isTransientGeminiError({ status: 429 }), true);
  assert.equal(isTransientGeminiError({ status: 503 }), true);
  assert.equal(isTransientGeminiError(new Error("gemini gemini-3 timed out after 60000ms")), true);
  assert.equal(isTransientGeminiError(new Error("ECONNRESET socket hang up")), true);
  assert.equal(isTransientGeminiError(new Error("503 model is overloaded")), true);
  // terminal (no retry) — auth / safety / bad request
  assert.equal(isTransientGeminiError({ status: 400 }), false);
  assert.equal(isTransientGeminiError({ status: 401 }), false);
  assert.equal(isTransientGeminiError(new Error("API key not valid")), false);
  assert.equal(isTransientGeminiError(new Error("blocked by safety settings")), false);
});

// — Engine selection ─────────────────────────────────────────────────────────

test("resolveEngine: default is Gemini-when-keyed, else template fallback", () => {
  assert.equal(resolveEngine({}), null, "no key, no engine → null (mock)");
  assert.equal(resolveEngine({ GEMINI_API_KEY: "k" }), "gemini");
  assert.equal(resolveEngine({ LLM_ENGINE: "auto", GEMINI_API_KEY: "k" }), "gemini");
});

test("resolveEngine: explicit gemini needs a key", () => {
  assert.equal(resolveEngine({ LLM_ENGINE: "gemini" }), null);
  assert.equal(resolveEngine({ LLM_ENGINE: "gemini", GEMINI_API_KEY: "k" }), "gemini");
});

test("resolveEngine: claude is explicit opt-in, never implicit, no key needed", () => {
  assert.equal(resolveEngine({ LLM_ENGINE: "claude" }), "claude");
  assert.equal(resolveEngine({ LLM_ENGINE: "claude-cli" }), "claude");
  // Explicit claude wins even when a Gemini key is present.
  assert.equal(resolveEngine({ LLM_ENGINE: "claude", GEMINI_API_KEY: "k" }), "claude");
  // It is never selected just because no key is set.
  assert.equal(resolveEngine({}), null);
});

// — Model resolution ─────────────────────────────────────────────────────────

test("geminiModelFor: fast default, long honours GEMINI_DRAFT_MODEL", () => {
  assert.equal(geminiModelFor("fast", {}), "gemini-3-flash-preview");
  assert.equal(geminiModelFor("long", {}), "gemini-3-flash-preview");
  assert.equal(geminiModelFor("fast", { GEMINI_MODEL: "x" }), "x");
  assert.equal(geminiModelFor("long", { GEMINI_MODEL: "x", GEMINI_DRAFT_MODEL: "pro" }), "pro");
});

test("isLongTierOnFastFallback: true only when long tier + GEMINI_DRAFT_MODEL unset (Tiger #2)", () => {
  // The premium long op silently on the fast model → flag it.
  assert.equal(isLongTierOnFastFallback("long", {}), true);
  assert.equal(isLongTierOnFastFallback("long", { GEMINI_MODEL: "x" }), true, "GEMINI_MODEL doesn't count");
  // A configured long model → not a fallback.
  assert.equal(isLongTierOnFastFallback("long", { GEMINI_DRAFT_MODEL: "pro" }), false);
  // Derived from geminiModelFor: a draft model explicitly equal to the fast model
  // IS a fallback (long resolves to the same model the fast tier would).
  assert.equal(
    isLongTierOnFastFallback("long", { GEMINI_MODEL: "x", GEMINI_DRAFT_MODEL: "x" }),
    true,
  );
  // The fast tier is never a 'fallback' — it's meant to be fast.
  assert.equal(isLongTierOnFastFallback("fast", {}), false);
  assert.equal(isLongTierOnFastFallback("fast", { GEMINI_DRAFT_MODEL: "pro" }), false);
});

test("claudeModel: defaults to sonnet and sanitises argv input", () => {
  assert.equal(claudeModel({}), "sonnet");
  assert.equal(claudeModel({ CLAUDE_CLI_MODEL: "opus" }), "opus");
  assert.equal(claudeModel({ CLAUDE_CLI_MODEL: "evil; rm -rf" }), "evilrm-rf");
});

// — Source labels ────────────────────────────────────────────────────────────

test("sourceLabel / isModelSource / asModelSource", () => {
  assert.equal(sourceLabel("gemini"), "Gemini");
  assert.equal(sourceLabel("claude"), "Claude");
  assert.equal(sourceLabel("mock"), "Template");
  assert.ok(isModelSource("gemini") && isModelSource("claude"));
  assert.ok(!isModelSource("mock"));
  assert.equal(asModelSource("claude"), "claude");
  assert.equal(asModelSource("nonsense"), "mock");
  assert.equal(asModelSource(undefined), "mock");
});
