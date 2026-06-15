import assert from "node:assert/strict";
import { test } from "node:test";

import type { StoredCase } from "@/lib/data/petitions";
import { type CaseGateDeps, resolveCase } from "./access";

const CASE: StoredCase = {
  id: "c1",
  fileNumber: "O1-1000",
  petitioner: "Ada",
  classification: "O-1A",
  status: "draft",
  approvalLikelihood: 70,
  receiptNumber: null,
  createdAt: null,
};

/** Build gate deps with sensible no-op defaults; override per test. */
function deps(over: Partial<CaseGateDeps> = {}): CaseGateDeps {
  return {
    getCaseForUser: async () => null,
    getCaseAnyOwner: async () => null,
    isConfiguredAttorney: () => false,
    storeConfigured: async () => true,
    ...over,
  };
}

test("resolveCase: no backend → unconfigured (503-class), gate never runs", async () => {
  let touched = false;
  const r = await resolveCase(
    deps({
      storeConfigured: async () => false,
      getCaseForUser: async () => {
        touched = true;
        return CASE;
      },
    }),
    { userId: "u1", email: null },
    "c1",
  );
  assert.deepEqual(r, { ok: false, error: { kind: "unconfigured" } });
  assert.equal(touched, false);
});

test("resolveCase: owner match → ok(case)", async () => {
  const r = await resolveCase(
    deps({ getCaseForUser: async (u, c) => (u === "u1" && c === "c1" ? CASE : null) }),
    { userId: "u1", email: "owner@x.com" },
    "c1",
  );
  assert.deepEqual(r, { ok: true, value: CASE });
});

test("resolveCase: non-owner, non-attorney → forbidden (no existence leak)", async () => {
  let anyOwnerCalled = false;
  const r = await resolveCase(
    deps({
      getCaseAnyOwner: async () => {
        anyOwnerCalled = true;
        return CASE;
      },
    }),
    { userId: "intruder", email: "intruder@x.com" },
    "c1",
  );
  assert.deepEqual(r, { ok: false, error: { kind: "forbidden" } });
  // fail-closed: a non-attorney must never trigger the cross-tenant read
  assert.equal(anyOwnerCalled, false);
});

test("resolveCase: configured attorney, case exists → ok(case)", async () => {
  const r = await resolveCase(
    deps({
      isConfiguredAttorney: (e) => e === "counsel@firm.com",
      getCaseAnyOwner: async () => CASE,
    }),
    { userId: null, email: "counsel@firm.com" },
    "c1",
  );
  assert.deepEqual(r, { ok: true, value: CASE });
});

test("resolveCase: configured attorney, case missing → not_found", async () => {
  const r = await resolveCase(
    deps({
      isConfiguredAttorney: () => true,
      getCaseAnyOwner: async () => null,
    }),
    { userId: null, email: "counsel@firm.com" },
    "missing",
  );
  assert.deepEqual(r, { ok: false, error: { kind: "not_found" } });
});

test("resolveCase: a store throw becomes store_error (never propagates)", async () => {
  const boom = new Error("firestore unavailable");
  const r = await resolveCase(
    deps({
      getCaseForUser: async () => {
        throw boom;
      },
    }),
    { userId: "u1", email: null },
    "c1",
  );
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.error.kind, "store_error");
  assert.equal(r.ok === false && r.error.cause, boom);
});

test("resolveCase: owner check skipped when userId is null, falls to attorney path", async () => {
  let ownerCalled = false;
  const r = await resolveCase(
    deps({
      getCaseForUser: async () => {
        ownerCalled = true;
        return CASE;
      },
      isConfiguredAttorney: () => true,
      getCaseAnyOwner: async () => CASE,
    }),
    { userId: null, email: "counsel@firm.com" },
    "c1",
  );
  assert.equal(ownerCalled, false);
  assert.deepEqual(r, { ok: true, value: CASE });
});
