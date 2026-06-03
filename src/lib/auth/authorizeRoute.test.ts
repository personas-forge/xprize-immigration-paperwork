import assert from "node:assert/strict";
import { test } from "node:test";

import { authorizeRoute, type AuthzDeps } from "./authorizeRoute";
import type { AppUser } from "@/lib/auth/devAuth";
import type { StoredCase } from "@/lib/db/store";

const USER: AppUser = {
  id: "user-1",
  email: "owner@example.com",
  user_metadata: { full_name: "Owner" },
};

const CASE: StoredCase = {
  id: "case-1",
  fileNumber: "O1-1234",
  petitioner: "Ada Lovelace",
  classification: "O-1A",
  status: "draft",
  approvalLikelihood: 0.8,
  receiptNumber: null,
};

/** A POST request carrying `body` as JSON, shaped like the real AI routes. */
function req(body: unknown): Request {
  return new Request("http://localhost/api/draft", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Deps double with call tracking. Each fn defaults to "nothing found / not an
 * attorney"; tests override the relevant ones. `calls` records invocations so a
 * test can assert a dependency was NEVER consulted (short-circuit guarantees).
 */
function makeDeps(over: Partial<AuthzDeps> = {}): {
  deps: AuthzDeps;
  calls: Record<string, number>;
} {
  const calls: Record<string, number> = {
    getUser: 0,
    getCaseForUser: 0,
    getCaseAnyOwner: 0,
    isConfiguredAttorney: 0,
  };
  // Compose: start from sane defaults, apply the test's overrides, THEN wrap
  // each in a counter — so call tracking holds whether or not a fn was
  // overridden (an override must never silently disable counting).
  const base: AuthzDeps = {
    getUser: async () => USER,
    getCaseForUser: async () => null,
    getCaseAnyOwner: async () => null,
    isConfiguredAttorney: () => false,
    ...over,
  };
  const deps: AuthzDeps = {
    getUser: async () => {
      calls.getUser++;
      return base.getUser();
    },
    getCaseForUser: async (userId, caseId) => {
      calls.getCaseForUser++;
      return base.getCaseForUser(userId, caseId);
    },
    getCaseAnyOwner: async (caseId) => {
      calls.getCaseAnyOwner++;
      return base.getCaseAnyOwner(caseId);
    },
    isConfiguredAttorney: (email) => {
      calls.isConfiguredAttorney++;
      return base.isConfiguredAttorney(email);
    },
  };
  return { deps, calls };
}

test("no caseId → 'anonymous', user passed through", async () => {
  const { deps } = makeDeps();
  const result = await authorizeRoute(req({ petitioner: "inline" }), {}, deps);
  assert.deepEqual(result, { status: "anonymous", user: USER });
});

test("caseId + null user → 'unauthenticated'", async () => {
  const { deps } = makeDeps({ getUser: async () => null });
  const result = await authorizeRoute(
    req({ caseId: "case-1" }),
    { requiresCase: true },
    deps,
  );
  assert.deepEqual(result, { status: "unauthenticated" });
});

test("owner match → 'ok' with that case; attorney dep NEVER called", async () => {
  const { deps, calls } = makeDeps({
    getCaseForUser: async () => CASE,
  });
  const result = await authorizeRoute(
    req({ caseId: "case-1" }),
    { requiresCase: true, requiresAttorney: true },
    deps,
  );
  assert.deepEqual(result, { status: "ok", user: USER, case: CASE });
  assert.equal(calls.isConfiguredAttorney, 0);
  assert.equal(calls.getCaseAnyOwner, 0);
});

test("requiresAttorney:false + non-owner → 'forbidden' even if attorney (branch not taken)", async () => {
  const { deps, calls } = makeDeps({
    // Would return true if asked — but the attorney branch must not be taken.
    isConfiguredAttorney: () => true,
    getCaseAnyOwner: async () => CASE,
  });
  const result = await authorizeRoute(
    req({ caseId: "case-1" }),
    { requiresCase: true /* requiresAttorney omitted → false */ },
    deps,
  );
  assert.deepEqual(result, { status: "forbidden" });
  assert.equal(calls.isConfiguredAttorney, 0);
  assert.equal(calls.getCaseAnyOwner, 0);
});

test("requiresAttorney:true + non-owner + configured attorney + case exists → 'ok'", async () => {
  const { deps, calls } = makeDeps({
    isConfiguredAttorney: () => true,
    getCaseAnyOwner: async () => CASE,
  });
  const result = await authorizeRoute(
    req({ caseId: "case-1" }),
    { requiresCase: true, requiresAttorney: true },
    deps,
  );
  assert.deepEqual(result, { status: "ok", user: USER, case: CASE });
  assert.equal(calls.getCaseAnyOwner, 1);
});

test("requiresAttorney:true + non-owner + NOT configured attorney (fail-closed) → 'forbidden'; getCaseAnyOwner never called", async () => {
  const { deps, calls } = makeDeps({
    isConfiguredAttorney: () => false,
    getCaseAnyOwner: async () => CASE, // present, but must not be consulted
  });
  const result = await authorizeRoute(
    req({ caseId: "case-1" }),
    { requiresCase: true, requiresAttorney: true },
    deps,
  );
  assert.deepEqual(result, { status: "forbidden" });
  assert.equal(calls.getCaseAnyOwner, 0);
});

test("requiresAttorney:true + configured attorney but getCaseAnyOwner returns null → 'forbidden'", async () => {
  const { deps, calls } = makeDeps({
    isConfiguredAttorney: () => true,
    getCaseAnyOwner: async () => null,
  });
  const result = await authorizeRoute(
    req({ caseId: "case-1" }),
    { requiresCase: true, requiresAttorney: true },
    deps,
  );
  assert.deepEqual(result, { status: "forbidden" });
  assert.equal(calls.getCaseAnyOwner, 1);
});
