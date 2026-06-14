import { test } from "node:test";
import assert from "node:assert/strict";
import { DISCLAIMER } from "@/features/guidance/guidance";
import {
  executeAiOperation,
  type AiOperationDeps,
  type AiOperationSpec,
  type ChargeOutcome,
  type OperationLlm,
} from "./operation";

// ---------------------------------------------------------------------------
// Test scaffolding. The orchestrator's only impure boundaries — token charge,
// LLM client, auth session, rate-limit — are injected, so these tests run under
// `tsx --test` with no `server-only`, no network, and no real model call.
// ---------------------------------------------------------------------------

interface Input {
  text: string;
}

function jsonRequest(body: unknown): Request {
  return new Request("http://test.local/api/op", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "9.9.9.9" },
    body: JSON.stringify(body),
  });
}

/** A spy charge that records reclaim() calls and returns a configurable outcome. */
function chargeSpy(outcome: ChargeOutcome) {
  const calls = { reclaimed: 0, charged: 0, lastOp: "" };
  const charge = async (op: string): Promise<ChargeOutcome> => {
    calls.charged += 1;
    calls.lastOp = op;
    if (outcome.ok) {
      return { ...outcome, reclaim: async () => void (calls.reclaimed += 1) };
    }
    return outcome;
  };
  return { charge, calls };
}

function llmReturning(text: string, name = "gemini"): OperationLlm {
  return { name, generate: async () => text };
}

function llmThrowing(name = "gemini"): OperationLlm {
  return {
    name,
    generate: async () => {
      throw new Error("model exploded");
    },
  };
}

/** Base spec: a string-output "echo" op with sensible defaults; override per test. */
function baseSpec(over: Partial<AiOperationSpec<Input, string>> = {}): AiOperationSpec<Input, string> {
  return {
    operation: "guidance",
    unauthenticatedError: "Sign in to use this.",
    parse: ({ body }) => {
      const b = body as Partial<Input>;
      if (typeof b?.text !== "string") {
        return { ok: false, response: jsonError("Bad request.", 400) };
      }
      return { ok: true, value: { text: b.text } };
    },
    prompt: (input) => ({ text: `prompt:${input.text}`, options: { tier: "fast" } }),
    guard: (raw) => raw.trim() || null,
    mock: () => "MOCK_OUTPUT",
    build: (output, source) => ({ result: output, source, disclaimer: DISCLAIMER }),
    ...over,
  };
}

function jsonError(message: string, status: number) {
  // NextResponse is what the orchestrator emits; the same Response shape is fine here.
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  }) as never;
}

function deps(over: Partial<AiOperationDeps>): AiOperationDeps {
  const charge = over.charge ?? chargeSpy({ ok: true, cost: 1, balance: 9, reclaim: async () => {} }).charge;
  return {
    charge,
    getLlm: over.getLlm ?? (() => null),
    resolveUser: over.resolveUser ?? (async () => null),
    rateLimit: over.rateLimit ?? {
      check: () => ({ ok: true, limit: 40, remaining: 39, retryAfterSec: 0 }),
      key: (_req, scope, userId) => (userId ? `${scope}:u:${userId}` : `${scope}:ip`),
      enabled: () => true,
      limits: { draft: 20, rfe: 20, guidance: 40, categorize: 40 } as never,
    },
    newRequestId: () => "req-fixed",
  };
}

// ---------------------------------------------------------------------------
// 1. Malformed JSON body → 400 "Invalid JSON body."
// ---------------------------------------------------------------------------
test("malformed JSON body → 400 Invalid JSON body", async () => {
  const req = new Request("http://test.local/api/op", { method: "POST", body: "{not json" });
  const res = await executeAiOperation(req, baseSpec(), deps({}));
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "Invalid JSON body." });
});

// ---------------------------------------------------------------------------
// 2. parse failure → the spec's own error response is returned verbatim
// ---------------------------------------------------------------------------
test("parse failure passes through the route's error response", async () => {
  const res = await executeAiOperation(jsonRequest({ wrong: 1 }), baseSpec(), deps({}));
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "Bad request." });
});

// ---------------------------------------------------------------------------
// 3. rate-limit miss → 429 + Retry-After header + DISCLAIMER, charge NOT called
// ---------------------------------------------------------------------------
test("rate-limit miss → 429 with Retry-After + DISCLAIMER, before charge", async () => {
  const spy = chargeSpy({ ok: true, cost: 1, balance: 9, reclaim: async () => {} });
  const res = await executeAiOperation(
    jsonRequest({ text: "hi" }),
    baseSpec({ rateLimit: { bucket: "guidance", scope: "guidance" } }),
    deps({
      charge: spy.charge,
      rateLimit: {
        check: () => ({ ok: false, limit: 40, remaining: 0, retryAfterSec: 17 }),
        key: (_r, s) => s,
        enabled: () => true,
        limits: { guidance: 40 } as never,
      },
    }),
  );
  assert.equal(res.status, 429);
  assert.equal(res.headers.get("Retry-After"), "17");
  const body = await res.json();
  assert.equal(body.error, "rate_limited");
  assert.equal(body.retryAfterSec, 17);
  assert.equal(body.disclaimer, DISCLAIMER);
  assert.equal(spy.calls.charged, 0, "charge must not run after a 429");
});

// ---------------------------------------------------------------------------
// 4. charge unauthenticated → 401 with the spec's message
// ---------------------------------------------------------------------------
test("unauthenticated charge → 401 with route message", async () => {
  const res = await executeAiOperation(
    jsonRequest({ text: "hi" }),
    baseSpec({ unauthenticatedError: "Sign in to run guidance." }),
    deps({ charge: chargeSpy({ ok: false, reason: "unauthenticated" }).charge }),
  );
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { error: "Sign in to run guidance." });
});

// ---------------------------------------------------------------------------
// 5. insufficient tokens → 402 with cost/balance/DISCLAIMER
// ---------------------------------------------------------------------------
test("insufficient tokens → 402 with cost, balance, DISCLAIMER", async () => {
  const res = await executeAiOperation(
    jsonRequest({ text: "hi" }),
    baseSpec(),
    deps({ charge: chargeSpy({ ok: false, reason: "insufficient", cost: 3, balance: 1 }).charge }),
  );
  assert.equal(res.status, 402);
  assert.deepEqual(await res.json(), {
    error: "insufficient_tokens",
    cost: 3,
    balance: 1,
    disclaimer: DISCLAIMER,
  });
});

// ---------------------------------------------------------------------------
// 6. model throws → reclaim() called + mock + source:"mock"
// ---------------------------------------------------------------------------
test("model throw → reclaim + mock labelled source:mock, still 200", async () => {
  const spy = chargeSpy({ ok: true, cost: 1, balance: 9, reclaim: async () => {} });
  const res = await executeAiOperation(
    jsonRequest({ text: "hi" }),
    baseSpec(),
    deps({ charge: spy.charge, getLlm: () => llmThrowing() }),
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.result, "MOCK_OUTPUT");
  assert.equal(body.source, "mock");
  assert.equal(spy.calls.reclaimed, 1, "throw must reclaim the charge");
});

// ---------------------------------------------------------------------------
// 7. guard returns null (unusable output) → reclaim + mock + source:"mock"
// ---------------------------------------------------------------------------
test("unusable model output (guard null) → reclaim + mock", async () => {
  const spy = chargeSpy({ ok: true, cost: 1, balance: 9, reclaim: async () => {} });
  const res = await executeAiOperation(
    jsonRequest({ text: "hi" }),
    baseSpec(),
    deps({ charge: spy.charge, getLlm: () => llmReturning("   ") }), // whitespace → guard null
  );
  const body = await res.json();
  assert.equal(body.result, "MOCK_OUTPUT");
  assert.equal(body.source, "mock");
  assert.equal(spy.calls.reclaimed, 1, "unusable output must reclaim the charge");
});

// ---------------------------------------------------------------------------
// 8. happy path → source = engine name, no reclaim
// ---------------------------------------------------------------------------
test("happy path → model output with source = engine name, no reclaim", async () => {
  const spy = chargeSpy({ ok: true, cost: 1, balance: 9, reclaim: async () => {} });
  const res = await executeAiOperation(
    jsonRequest({ text: "hi" }),
    baseSpec(),
    deps({ charge: spy.charge, getLlm: () => llmReturning("REAL ANSWER", "gemini") }),
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.result, "REAL ANSWER");
  assert.equal(body.source, "gemini");
  assert.equal(body.disclaimer, DISCLAIMER);
  assert.equal(spy.calls.reclaimed, 0, "a billed model answer must not reclaim");
});

// ---------------------------------------------------------------------------
// 9. no engine configured → mock WITHOUT reclaim (legitimate keyless result)
// ---------------------------------------------------------------------------
test("no engine → deterministic mock, charge kept (no reclaim)", async () => {
  const spy = chargeSpy({ ok: true, cost: 1, balance: 9, reclaim: async () => {} });
  const res = await executeAiOperation(
    jsonRequest({ text: "hi" }),
    baseSpec(),
    deps({ charge: spy.charge, getLlm: () => null }),
  );
  const body = await res.json();
  assert.equal(body.source, "mock");
  assert.equal(spy.calls.reclaimed, 0, "keyless mock is not a refund case");
});

// ---------------------------------------------------------------------------
// 10. persist throws → onPersistError fields merged + 200 (paid response survives)
// ---------------------------------------------------------------------------
test("persist failure → onPersistError merged, response still 200", async () => {
  const res = await executeAiOperation(
    jsonRequest({ text: "hi" }),
    baseSpec({
      persist: async () => {
        throw new Error("db down");
      },
      onPersistError: () => ({ saveFailed: true, caseId: null }),
    }),
    deps({ getLlm: () => llmReturning("REAL ANSWER") }),
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.saveFailed, true);
  assert.equal(body.caseId, null);
  assert.equal(body.result, "REAL ANSWER");
});

// ---------------------------------------------------------------------------
// 11. persist success → returned fields merged into the body
// ---------------------------------------------------------------------------
test("persist success → fields merged into the body; receives the source label", async () => {
  let persistSource = "";
  const res = await executeAiOperation(
    jsonRequest({ text: "hi" }),
    baseSpec({
      persist: async (_output, _input, _user, source) => {
        persistSource = source;
        return { caseId: "case-123", version: 2 };
      },
    }),
    deps({ getLlm: () => llmReturning("REAL ANSWER", "gemini") }),
  );
  const body = await res.json();
  assert.equal(body.caseId, "case-123");
  assert.equal(body.version, 2);
  assert.equal(persistSource, "gemini", "persist receives the resolved source label");
});

// ---------------------------------------------------------------------------
// 12. operation as a function → the billed op key is derived from the input
// ---------------------------------------------------------------------------
test("operation(input) selects the billed op key", async () => {
  const spy = chargeSpy({ ok: true, cost: 1, balance: 9, reclaim: async () => {} });
  await executeAiOperation(
    jsonRequest({ text: "section" }),
    baseSpec({ operation: (input) => (input.text === "section" ? "draft_section" : "draft") }),
    deps({ charge: spy.charge, getLlm: () => llmReturning("X") }),
  );
  assert.equal(spy.calls.lastOp, "draft_section");
});

// ---------------------------------------------------------------------------
// 13. byUser rate-limit keys on the resolved user id
// ---------------------------------------------------------------------------
test("byUser rate-limit keys on user id, not IP", async () => {
  let keyedWith = "";
  await executeAiOperation(
    jsonRequest({ text: "hi" }),
    baseSpec({ rateLimit: { bucket: "rfe", scope: "rfe", byUser: true } }),
    deps({
      resolveUser: async () => ({ id: "user-42" }),
      rateLimit: {
        check: () => ({ ok: true, limit: 20, remaining: 19, retryAfterSec: 0 }),
        key: (_r, scope, userId) => {
          keyedWith = `${scope}:${userId ?? "ip"}`;
          return keyedWith;
        },
        enabled: () => true,
        limits: { rfe: 20 } as never,
      },
    }),
  );
  assert.equal(keyedWith, "rfe:user-42");
});
