import assert from "node:assert/strict";
import { test } from "node:test";

import { attorneyAllowlist, isAttorney } from "./roles";

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
