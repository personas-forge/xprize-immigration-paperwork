/**
 * Contract test for the owner-only case gate the review server actions adopt
 * (ADR-0010, increment 7/7). `src/features/review/actions.ts` is a server-only
 * `"use server"` module (imports `@/lib/auth/session`, `next/cache`) and cannot
 * load under `tsx --test`, so the invariant it now depends on is pinned here on
 * the dependency-injected {@link PetitionAdapter} instead.
 *
 * The invariant: `submitForReview` and `addReviewNote`'s ownership branch call
 * `petitions.resolveCase({ userId, email: null }, caseId)`. Omitting `email`
 * MUST make the configured-attorney cross-tenant fallback unreachable, so the
 * gate resolves OWNER-ONLY — byte-for-byte the prior `getCaseForUser(user.id,
 * caseId)` semantics those actions replaced.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type { StoredCase } from "@/lib/data/petitions";
import { PetitionAdapter, type PetitionDeps } from "@/lib/data/adapters/petition";

const CASE: StoredCase = {
  id: "c1",
  fileNumber: "O1-1000",
  petitioner: "Ada",
  classification: "O-1A",
  status: "Drafting",
  approvalLikelihood: 70,
  receiptNumber: null,
  createdAt: null,
  updatedAt: null,
};

/** Deps where the requesting user owns NO case, but IS a configured attorney
 *  and a case exists under another owner — the exact cross-tenant scenario the
 *  owner-only gate must deny. */
function deps(over: Partial<PetitionDeps> = {}): PetitionDeps {
  return {
    getCaseForUser: async () => null, // requester owns nothing
    getCaseAnyOwner: async () => CASE, // ...but the case exists under another owner
    createCaseWithCriteria: async () => null,
    getCriteriaForCase: async () => [],
    saveDraft: async () => 1,
    getLatestDraft: async () => null,
    saveRfeResponse: async () => 1,
    getLatestRfeResponse: async () => null,
    // Models the real gate: fail-closed on a null/empty email (that is exactly
    // what makes `email: null` resolve owner-only).
    isConfiguredAttorney: (email) => Boolean(email),
    storeConfigured: async () => true,
    ...over,
  };
}

test("owner-only resolve (email omitted): grants the actual owner", async () => {
  const a = new PetitionAdapter(deps({ getCaseForUser: async () => CASE }));
  const r = await a.resolveCase({ userId: "owner", email: null }, "c1");
  assert.deepEqual(r, { ok: true, value: CASE });
});

test("owner-only resolve (email null): denies a non-owning configured attorney", async () => {
  const a = new PetitionAdapter(deps());
  const r = await a.resolveCase({ userId: "attorney", email: null }, "c1");
  // email:null ⇒ isConfiguredAttorney(null) short-circuits the fallback ⇒ forbidden,
  // never the case under another owner. This is what keeps submitForReview owner-only.
  assert.deepEqual(r, { ok: false, error: { kind: "forbidden" } });
});

test("addReviewNote fallback: a configured attorney is admitted only with email present", async () => {
  const a = new PetitionAdapter(deps());
  // The note action's attorney branch passes the real email through the gate.
  const r = await a.resolveCase({ userId: "attorney", email: "atty@firm.com" }, "c1");
  assert.deepEqual(r, { ok: true, value: CASE });
});
