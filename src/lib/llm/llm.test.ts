import assert from "node:assert/strict";
import { test } from "node:test";

import { claudeModel, geminiModelFor, resolveEngine } from "./config";
import { asModelSource, isModelSource, sourceLabel } from "./label";

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
