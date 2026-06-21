import assert from "node:assert/strict";
import { test } from "node:test";

import type { StoredDocument } from "@/lib/data/evidence";
import type { StoredCase } from "@/lib/data/petitions";
import { EvidenceAdapter, type EvidenceDeps } from "./evidence";

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

const DOC: StoredDocument = {
  id: "d1",
  name: "award.pdf",
  criterion: "Awards",
  exhibit: "A",
  status: "filed",
  facts: ["won a prize"],
  source: "model",
};

function deps(over: Partial<EvidenceDeps> = {}): EvidenceDeps {
  return {
    addCaseDocument: async () => DOC,
    getCaseDocuments: async () => [DOC],
    removeCaseDocument: async () => true,
    restoreCaseDocument: async () => true,
    refileCaseDocument: async () => true,
    getCaseForUser: async () => CASE,
    getCaseAnyOwner: async () => CASE,
    isConfiguredAttorney: () => false,
    storeConfigured: async () => true,
    ...over,
  };
}

const OWNER = { userId: "u1", email: "owner@x.com" };

test("addDocument: gates first — forbidden case never reaches addCaseDocument", async () => {
  let added = false;
  const a = new EvidenceAdapter(
    deps({
      getCaseForUser: async () => null,
      isConfiguredAttorney: () => false,
      addCaseDocument: async () => {
        added = true;
        return DOC;
      },
    }),
  );
  const r = await a.addDocument(
    { userId: "intruder", email: "x@x.com" },
    { caseId: "c1", name: "x", criterion: "Awards", facts: [], source: "model" },
  );
  assert.deepEqual(r, { ok: false, error: { kind: "forbidden" } });
  assert.equal(added, false);
});

test("addDocument: owner → returns the stored document", async () => {
  const a = new EvidenceAdapter(deps());
  const r = await a.addDocument(OWNER, {
    caseId: "c1",
    name: "award.pdf",
    criterion: "Awards",
    facts: ["won a prize"],
    source: "model",
  });
  assert.deepEqual(r, { ok: true, value: DOC });
});

test("addDocument: configured store but null insert → store_error", async () => {
  const a = new EvidenceAdapter(deps({ addCaseDocument: async () => null }));
  const r = await a.addDocument(OWNER, {
    caseId: "c1",
    name: "x",
    criterion: "Awards",
    facts: [],
    source: "model",
  });
  assert.equal(r.ok === false && r.error.kind, "store_error");
});

test("getDocuments: attorney path resolves then lists", async () => {
  const a = new EvidenceAdapter(
    deps({
      getCaseForUser: async () => null,
      isConfiguredAttorney: (e) => e === "counsel@firm.com",
      getCaseAnyOwner: async () => CASE,
    }),
  );
  const r = await a.getDocuments({ userId: null, email: "counsel@firm.com" }, "c1");
  assert.deepEqual(r, { ok: true, value: [DOC] });
});

test("removeDocument: owner → ok(void)", async () => {
  const a = new EvidenceAdapter(deps());
  const r = await a.removeDocument(OWNER, "c1", "d1");
  assert.deepEqual(r, { ok: true, value: undefined });
});

test("removeDocument: no row matched (wrong case / gone) → not_found, not a false ok", async () => {
  const a = new EvidenceAdapter(deps({ removeCaseDocument: async () => false }));
  const r = await a.removeDocument(OWNER, "c1", "missing");
  assert.deepEqual(r, { ok: false, error: { kind: "not_found" } });
});

test("removeDocument: soft-delete records the remover (deletedBy = access.userId)", async () => {
  let deletedBy: string | null | undefined = "SENTINEL";
  const a = new EvidenceAdapter(
    deps({ removeCaseDocument: async (_c, _d, by) => ((deletedBy = by), true) }),
  );
  await a.removeDocument(OWNER, "c1", "d1");
  assert.equal(deletedBy, OWNER.userId, "the soft-delete must record who removed the exhibit");
});

test("restoreDocument: gated; restores a deleted doc, not_found when nothing to restore", async () => {
  // gate denies a non-owner before any restore
  let touched = false;
  const denied = await new EvidenceAdapter(
    deps({
      getCaseForUser: async () => null,
      restoreCaseDocument: async () => ((touched = true), true),
    }),
  ).restoreDocument({ userId: "intruder", email: "x@x.com" }, "c1", "d1");
  assert.equal(denied.ok, false);
  assert.equal(touched, false, "a denied caller must never reach restore");
  // owner restoring a deleted doc → ok
  assert.deepEqual(await new EvidenceAdapter(deps()).restoreDocument(OWNER, "c1", "d1"), {
    ok: true,
    value: undefined,
  });
  // nothing deleted to restore → not_found
  assert.deepEqual(
    await new EvidenceAdapter(deps({ restoreCaseDocument: async () => false })).restoreDocument(OWNER, "c1", "d1"),
    { ok: false, error: { kind: "not_found" } },
  );
});

test("refileDocument: no matching document → not_found", async () => {
  const a = new EvidenceAdapter(deps({ refileCaseDocument: async () => false }));
  const r = await a.refileDocument(OWNER, "c1", "missing", "Press");
  assert.deepEqual(r, { ok: false, error: { kind: "not_found" } });
});

test("refileDocument: a store throw downstream of the gate → store_error", async () => {
  const a = new EvidenceAdapter(
    deps({
      refileCaseDocument: async () => {
        throw new Error("refile failed");
      },
    }),
  );
  const r = await a.refileDocument(OWNER, "c1", "d1", "Press");
  assert.equal(r.ok === false && r.error.kind, "store_error");
});

test("getDocuments: unconfigured store → unconfigured (gate short-circuits)", async () => {
  const a = new EvidenceAdapter(deps({ storeConfigured: async () => false }));
  const r = await a.getDocuments(OWNER, "c1");
  assert.deepEqual(r, { ok: false, error: { kind: "unconfigured" } });
});
