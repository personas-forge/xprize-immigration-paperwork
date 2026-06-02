import assert from "node:assert/strict";
import { test } from "node:test";

import { attorneyAllowlist, isAttorney, isConfiguredAttorney } from "./roles";

test("attorneyAllowlist: parses, trims, lowercases, drops blanks", () => {
  assert.deepEqual(
    attorneyAllowlist({ ATTORNEY_EMAILS: " A@x.com, B@Y.com ,, " }),
    ["a@x.com", "b@y.com"],
  );
  assert.deepEqual(attorneyAllowlist({}), []);
});

test("isAttorney: empty allowlist unlocks everyone (demo default)", () => {
  assert.equal(isAttorney("anyone@example.com", {}), true);
  assert.equal(isAttorney(null, { ATTORNEY_EMAILS: "" }), true);
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
