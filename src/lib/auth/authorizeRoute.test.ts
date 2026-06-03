import assert from "node:assert/strict";
import { test } from "node:test";

import { authorizeRoute, type AuthzDeps } from "./authorizeRoute";

// A StoredCase is structural; tests only read .id/.petitioner/.classification.
const CASE = {
  id: "case-1",
  fileNumber: "O1-1234",
  petitioner: "Ada Lovelace",
  classification: "O-1A",
  status: "draft",
  approvalLikelihood: 0.7,
  receiptNumber: null,
};
const OWNER = { id: "user-owner", email: "owner@example.com" };
const ATTORNEY = { id: "user-attorney", email: "counsel@firm.com" };

/** Build deps with sensible no-access defaults; override per test. */
function deps(over: Partial<AuthzDeps> = {}): AuthzDeps {
  return {
    getUser: async () => null,
    getCaseForUser: async () => null,
    getCaseAnyOwner: async () => null,
    isConfiguredAttorney: () => false,
    ...over,
  };
}

function postReq(body: unknown): Request {
  return new Request("https://app.test/api/rfe", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

test("no caseId → anonymous, signed-in user rides along (rate-limit key)", async () => {
  const res = await authorizeRoute(
    postReq({ rfeText: "x" }),
    { requiresCase: true, requiresAttorney: true },
    deps({ getUser: async () => OWNER }),
  );
  assert.deepEqual(res, { status: "anonymous", user: OWNER });
});

test("no caseId, nobody signed in → anonymous with user null", async () => {
  const res = await authorizeRoute(postReq({ rfeText: "x" }), { requiresCase: true }, deps());
  assert.deepEqual(res, { status: "anonymous", user: null });
});

test("unparseable body → treated as no caseId (anonymous), never throws", async () => {
  const bad = new Request("https://app.test/api/rfe", { method: "POST", body: "not json" });
  const res = await authorizeRoute(bad, { requiresCase: true }, deps({ getUser: async () => OWNER }));
  assert.deepEqual(res, { status: "anonymous", user: OWNER });
});

test("caseId present but nobody signed in → unauthenticated (route's 401)", async () => {
  const res = await authorizeRoute(
    postReq({ caseId: "case-1" }),
    { requiresCase: true, requiresAttorney: true },
    deps({ getUser: async () => null }),
  );
  assert.deepEqual(res, { status: "unauthenticated" });
});

test("owner of the case → ok, carries user + resolved case", async () => {
  const res = await authorizeRoute(
    postReq({ caseId: "case-1" }),
    { requiresCase: true, requiresAttorney: true },
    deps({ getUser: async () => OWNER, getCaseForUser: async () => CASE }),
  );
  assert.equal(res.status, "ok");
  if (res.status === "ok") {
    assert.equal(res.user, OWNER);
    assert.equal(res.case.id, "case-1");
  }
});

test("non-owner configured attorney → ok via cross-tenant fallback", async () => {
  let anyOwnerArg: string | null = null;
  const res = await authorizeRoute(
    postReq({ caseId: "case-1" }),
    { requiresCase: true, requiresAttorney: true },
    deps({
      getUser: async () => ATTORNEY,
      getCaseForUser: async () => null, // not the owner
      isConfiguredAttorney: () => true,
      getCaseAnyOwner: async (id) => {
        anyOwnerArg = id;
        return CASE;
      },
    }),
  );
  assert.equal(res.status, "ok");
  assert.equal(anyOwnerArg, "case-1"); // fallback queried by caseId
});

test("FAIL CLOSED: non-owner, requiresAttorney but NOT configured → forbidden, no cross-tenant read", async () => {
  let anyOwnerCalled = false;
  const res = await authorizeRoute(
    postReq({ caseId: "case-1" }),
    { requiresCase: true, requiresAttorney: true },
    deps({
      getUser: async () => ATTORNEY,
      getCaseForUser: async () => null,
      isConfiguredAttorney: () => false, // unconfigured → deny
      getCaseAnyOwner: async () => {
        anyOwnerCalled = true;
        return CASE;
      },
    }),
  );
  assert.deepEqual(res, { status: "forbidden" });
  assert.equal(anyOwnerCalled, false); // never reached the cross-tenant read
});

test("owner-only policy (requiresAttorney falsy) never takes the attorney branch", async () => {
  let anyOwnerCalled = false;
  const res = await authorizeRoute(
    postReq({ caseId: "case-1" }),
    { requiresCase: true }, // draft today: owner-only
    deps({
      getUser: async () => ATTORNEY,
      getCaseForUser: async () => null,
      isConfiguredAttorney: () => true, // even a real attorney is irrelevant here
      getCaseAnyOwner: async () => {
        anyOwnerCalled = true;
        return CASE;
      },
    }),
  );
  assert.deepEqual(res, { status: "forbidden" });
  assert.equal(anyOwnerCalled, false);
});

test("configured attorney but case does not exist anywhere → forbidden", async () => {
  const res = await authorizeRoute(
    postReq({ caseId: "ghost" }),
    { requiresCase: true, requiresAttorney: true },
    deps({
      getUser: async () => ATTORNEY,
      getCaseForUser: async () => null,
      isConfiguredAttorney: () => true,
      getCaseAnyOwner: async () => null,
    }),
  );
  assert.deepEqual(res, { status: "forbidden" });
});

test("reads caseId from a CLONE — caller can still consume request.json()", async () => {
  const request = postReq({ caseId: "case-1", rfeText: "keep me" });
  await authorizeRoute(
    request,
    { requiresCase: true },
    deps({ getUser: async () => OWNER, getCaseForUser: async () => CASE }),
  );
  // The original body must remain unconsumed for the route to parse.
  const body = await request.json();
  assert.deepEqual(body, { caseId: "case-1", rfeText: "keep me" });
});
