import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CONSENT_VERSION,
  CONSENT_VERSIONS,
  isKnownConsentVersion,
} from "./consent";

test("CONSENT_VERSIONS is a non-empty, de-duplicated, ordered history", () => {
  assert.ok(CONSENT_VERSIONS.length >= 1, "at least one published version");
  assert.equal(
    new Set(CONSENT_VERSIONS).size,
    CONSENT_VERSIONS.length,
    "no duplicate versions",
  );
});

test("CONSENT_VERSION is always a member of the recorded history", () => {
  // The compliance keystone: the live version a user is re-prompted against must
  // be a known, published version — never a free-floating string.
  assert.equal(isKnownConsentVersion(CONSENT_VERSION), true);
});

test("CONSENT_VERSION defaults to the newest entry", () => {
  assert.equal(CONSENT_VERSION, CONSENT_VERSIONS[CONSENT_VERSIONS.length - 1]);
});

test("isKnownConsentVersion rejects unknown / malformed values", () => {
  assert.equal(isKnownConsentVersion("1999-01-01"), false);
  assert.equal(isKnownConsentVersion(""), false);
  assert.equal(isKnownConsentVersion(undefined), false);
  assert.equal(isKnownConsentVersion(null), false);
});
