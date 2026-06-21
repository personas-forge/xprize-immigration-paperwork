import assert from "node:assert/strict";
import { test } from "node:test";

import {
  attorneyAllowlist,
  isAttorney,
  isConfiguredAttorney,
  isConfiguredOps,
  canReviewQueue,
} from "./roles";

test("attorneyAllowlist: parses, trims, lowercases, drops blanks", () => {
  assert.deepEqual(
    attorneyAllowlist({ ATTORNEY_EMAILS: " A@x.com, B@Y.com ,, " }),
    ["a@x.com", "b@y.com"],
  );
  assert.deepEqual(attorneyAllowlist({}), []);
});

test("isAttorney: empty allowlist unlocks everyone OUTSIDE production (demo default)", () => {
  assert.equal(isAttorney("anyone@example.com", {}), true);
  assert.equal(isAttorney(null, { ATTORNEY_EMAILS: "" }), true);
});

test("isAttorney: empty allowlist in PRODUCTION fails closed (no demo unlock)", () => {
  assert.equal(isAttorney("anyone@example.com", { NODE_ENV: "production" }), false);
  assert.equal(
    isAttorney("anyone@example.com", { NODE_ENV: "production", ATTORNEY_EMAILS: "" }),
    false,
  );
  // …but a configured allowlist still works in production.
  assert.equal(
    isAttorney("counsel@firm.com", { NODE_ENV: "production", ATTORNEY_EMAILS: "counsel@firm.com" }),
    true,
  );
});

test("isAttorney: configured allowlist restricts to listed emails (case-insensitive)", () => {
  const env = { ATTORNEY_EMAILS: "counsel@firm.com" };
  assert.equal(isAttorney("Counsel@Firm.com", env), true);
  assert.equal(isAttorney("someone@else.com", env), false);
  assert.equal(isAttorney(null, env), false);
  assert.equal(isAttorney(undefined, env), false);
});

test("isConfiguredAttorney: fails CLOSED — empty allowlist denies everyone", () => {
  // The whole point: no demo unlock for cross-tenant data access.
  assert.equal(isConfiguredAttorney("anyone@example.com", {}), false);
  assert.equal(isConfiguredAttorney("anyone@example.com", { ATTORNEY_EMAILS: "" }), false);
});

test("isConfiguredAttorney: configured allowlist still restricts to listed emails", () => {
  const env = { ATTORNEY_EMAILS: "counsel@firm.com" };
  assert.equal(isConfiguredAttorney("Counsel@Firm.com", env), true);
  assert.equal(isConfiguredAttorney("someone@else.com", env), false);
  assert.equal(isConfiguredAttorney(null, env), false);
});

test("isConfiguredOps: fails CLOSED — empty OPS_EMAILS denies everyone (cross-tenant read)", () => {
  assert.equal(isConfiguredOps("anyone@example.com", {}), false);
  assert.equal(isConfiguredOps("ops@firm.com", { OPS_EMAILS: "" }), false);
  const env = { OPS_EMAILS: "ops@firm.com" };
  assert.equal(isConfiguredOps("Ops@Firm.com", env), true);
  assert.equal(isConfiguredOps("someone@else.com", env), false);
  assert.equal(isConfiguredOps(null, env), false);
});

test("canReviewQueue: attorney OR ops may view; neither → denied (fail-closed)", () => {
  assert.equal(canReviewQueue("c@firm.com", { ATTORNEY_EMAILS: "c@firm.com" }), true);
  assert.equal(canReviewQueue("o@firm.com", { OPS_EMAILS: "o@firm.com" }), true);
  assert.equal(
    canReviewQueue("o@firm.com", { ATTORNEY_EMAILS: "c@firm.com", OPS_EMAILS: "o@firm.com" }),
    true,
  );
  assert.equal(canReviewQueue("anyone@example.com", {}), false); // no demo unlock
  assert.equal(
    canReviewQueue("x@y.com", { ATTORNEY_EMAILS: "c@firm.com", OPS_EMAILS: "o@firm.com" }),
    false,
  );
});
