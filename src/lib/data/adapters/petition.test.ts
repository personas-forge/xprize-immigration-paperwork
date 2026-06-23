import assert from "node:assert/strict";
import { test } from "node:test";

import type { StoredCase } from "@/lib/data/petitions";
import { PetitionAdapter, type PetitionDeps } from "./petition";

const CASE: StoredCase = {
  id: "c1",
  fileNumber: "O1-1000",
  petitioner: "Ada",
  classification: "O-1A",
  status: "draft",
  approvalLikelihood: 70,
  receiptNumber: null,
  createdAt: null,
  updatedAt: null,
};

function deps(over: Partial<PetitionDeps> = {}): PetitionDeps {
  return {
    getCaseForUser: async () => CASE,
    getCaseAnyOwner: async () => CASE,
    getCasesForUser: async () => [CASE],
    getCasesInReview: async () => [CASE],
    createCaseWithCriteria: async () => ({ id: "c2", fileNumber: "O1-2000" }),
    getCriteriaForCase: async () => [],
    saveDraft: async () => 3,
    getLatestDraft: async () => null,
    saveRfeResponse: async () => 2,
    isConfiguredAttorney: () => false,
    isConfiguredOps: () => false,
    storeConfigured: async () => true,
    ...over,
  };
}

const OWNER = { userId: "u1", email: "owner@x.com" };

test("listOwnedCases: owner-scoped; no user id → forbidden", async () => {
  const a = new PetitionAdapter(deps());
  const ok = await a.listOwnedCases(OWNER);
  assert.equal(ok.ok, true);
  assert.equal(ok.ok && ok.value.length, 1);
  const denied = await a.listOwnedCases({ userId: null, email: null });
  assert.equal(denied.ok, false);
  assert.equal(!denied.ok && denied.error.kind, "forbidden");
});

test("listReviewQueue: fail-closed unless attorney OR ops (IDOR gate in the seam)", async () => {
  // neither attorney nor ops → forbidden, queue never read
  let read = false;
  const denied = await new PetitionAdapter(
    deps({ getCasesInReview: async () => ((read = true), [CASE]) }),
  ).listReviewQueue(OWNER);
  assert.equal(denied.ok, false);
  assert.equal(!denied.ok && denied.error.kind, "forbidden");
  assert.equal(read, false, "a non-attorney/non-ops caller must never reach the cross-tenant read");
  // attorney → allowed
  const asAttorney = await new PetitionAdapter(deps({ isConfiguredAttorney: () => true })).listReviewQueue(OWNER);
  assert.equal(asAttorney.ok, true);
  assert.equal(asAttorney.ok && asAttorney.value.length, 1);
  // ops-only → allowed (read-only view)
  const asOps = await new PetitionAdapter(deps({ isConfiguredOps: () => true })).listReviewQueue(OWNER);
  assert.equal(asOps.ok, true);
});

test("createCase: requires a user, then persists", async () => {
  const a = new PetitionAdapter(deps());
  assert.equal(
    (await a.createCase({ userId: null, email: null }, {
      petitioner: "Ada",
      approvalLikelihood: 70,
      criteria: [],
    })).ok,
    false,
  );
  const r = await a.createCase(OWNER, {
    petitioner: "Ada",
    approvalLikelihood: 70,
    criteria: [],
  });
  assert.deepEqual(r, { ok: true, value: { id: "c2", fileNumber: "O1-2000" } });
});

test("createCase: configured store but null write → store_error", async () => {
  const a = new PetitionAdapter(deps({ createCaseWithCriteria: async () => null }));
  const r = await a.createCase(OWNER, {
    petitioner: "Ada",
    approvalLikelihood: 70,
    criteria: [],
  });
  assert.equal(r.ok === false && r.error.kind, "store_error");
});

test("saveDraft: gates first — a forbidden case never reaches saveDraft", async () => {
  let saveCalled = false;
  const a = new PetitionAdapter(
    deps({
      getCaseForUser: async () => null, // not owner
      isConfiguredAttorney: () => false, // not attorney
      saveDraft: async () => {
        saveCalled = true;
        return 9;
      },
    }),
  );
  const r = await a.saveDraft(
    { userId: "intruder", email: "x@x.com" },
    "c1",
    [{ heading: "H", body: "B" }],
    "model",
  );
  assert.deepEqual(r, { ok: false, error: { kind: "forbidden" } });
  assert.equal(saveCalled, false);
});

test("saveDraft: owner → returns the new version number", async () => {
  const a = new PetitionAdapter(deps());
  const r = await a.saveDraft(OWNER, "c1", [{ heading: "H", body: "B" }], "model");
  assert.deepEqual(r, { ok: true, value: 3 });
});

test("saveDraft: store vanished mid-call (null version) → unconfigured", async () => {
  const a = new PetitionAdapter(deps({ saveDraft: async () => null }));
  const r = await a.saveDraft(OWNER, "c1", [], "model");
  assert.deepEqual(r, { ok: false, error: { kind: "unconfigured" } });
});

test("getLatestDraft: null (none yet) is still a success", async () => {
  const a = new PetitionAdapter(deps());
  const r = await a.getLatestDraft(OWNER, "c1");
  assert.deepEqual(r, { ok: true, value: null });
});

// getCriteria is the read /api/draft (ADR-0010 increment 4) now routes through
// instead of the raw getCriteriaForCase data-fn — gate first, then normalize.
test("getCriteria: gates first — a forbidden case never reaches getCriteriaForCase", async () => {
  let criteriaCalled = false;
  const a = new PetitionAdapter(
    deps({
      getCaseForUser: async () => null, // not owner
      isConfiguredAttorney: () => false, // not attorney
      getCriteriaForCase: async () => {
        criteriaCalled = true;
        return [];
      },
    }),
  );
  const r = await a.getCriteria({ userId: "intruder", email: "x@x.com" }, "c1");
  assert.deepEqual(r, { ok: false, error: { kind: "forbidden" } });
  assert.equal(criteriaCalled, false);
});

test("getCriteria: owner → returns the scored criteria", async () => {
  const criteria = [
    {
      id: "cr1",
      name: "Awards",
      status: "met",
      evidence: "Two national awards",
      rationale: "x",
      exhibit: "A",
    },
  ];
  const a = new PetitionAdapter(deps({ getCriteriaForCase: async () => criteria }));
  const r = await a.getCriteria(OWNER, "c1");
  assert.deepEqual(r, { ok: true, value: criteria });
});

test("getCriteria: a store throw downstream of the gate → store_error", async () => {
  const a = new PetitionAdapter(
    deps({
      getCriteriaForCase: async () => {
        throw new Error("read failed");
      },
    }),
  );
  const r = await a.getCriteria(OWNER, "c1");
  assert.equal(r.ok === false && r.error.kind, "store_error");
});

test("saveRfeResponse: a store throw downstream of the gate → store_error", async () => {
  const boom = new Error("write failed");
  const a = new PetitionAdapter(
    deps({
      saveRfeResponse: async () => {
        throw boom;
      },
    }),
  );
  const r = await a.saveRfeResponse(OWNER, "c1", "rfe text", [], "model");
  assert.equal(r.ok === false && r.error.kind, "store_error");
});
