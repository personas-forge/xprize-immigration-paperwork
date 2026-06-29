import assert from "node:assert/strict";
import { test } from "node:test";

import {
  completeOnboarding,
  type OnboardingConsentFields,
  type OnboardingDeps,
} from "./onboarding";
import { CONSENT_VERSION } from "./consent";
import { FREE_SIGNUP_GRANT } from "@/lib/tokens/economy";

const FIELDS: OnboardingConsentFields = {
  userId: "u1",
  email: "u1@example.com",
  fullName: "Test User",
  avatarUrl: null,
  terms: true,
  privacy: true,
  marketing: false,
  ip: null,
  userAgent: "test",
};

function spyDeps(over?: Partial<OnboardingDeps>) {
  const calls = {
    consentVersions: [] as Array<string>,
    grants: [] as Array<[string, number]>,
  };
  const deps: OnboardingDeps = {
    upsertProfileWithConsent: async (input) => {
      calls.consentVersions.push(input.consentVersion);
    },
    grantSignupTokens: async (userId, amount) => {
      calls.grants.push([userId, amount]);
    },
    ...over,
  };
  return { calls, deps };
}

test("completeOnboarding persists at CONSENT_VERSION then grants FREE_SIGNUP_GRANT", async () => {
  const { calls, deps } = spyDeps();
  const r = await completeOnboarding(FIELDS, { persistConsent: true, grantTokens: true }, deps);
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(calls.consentVersions, [CONSENT_VERSION]);
  assert.deepEqual(calls.grants, [["u1", FREE_SIGNUP_GRANT]]);
});

test("completeOnboarding skips the consent write when persistConsent is false (dev re-seed)", async () => {
  const { calls, deps } = spyDeps();
  const r = await completeOnboarding(FIELDS, { persistConsent: false, grantTokens: true }, deps);
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(calls.consentVersions, []);
  assert.deepEqual(calls.grants, [["u1", FREE_SIGNUP_GRANT]]);
});

test("completeOnboarding skips the grant when grantTokens is false (unverified email)", async () => {
  const { calls, deps } = spyDeps();
  const r = await completeOnboarding(FIELDS, { persistConsent: true, grantTokens: false }, deps);
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(calls.consentVersions, [CONSENT_VERSION]);
  assert.deepEqual(calls.grants, []);
});

test("a consent failure is fatal and the grant is NOT attempted", async () => {
  const boom = new Error("db down");
  const grants: Array<[string, number]> = [];
  const { deps } = spyDeps({
    upsertProfileWithConsent: async () => {
      throw boom;
    },
    grantSignupTokens: async (userId, amount) => {
      grants.push([userId, amount]);
    },
  });
  const r = await completeOnboarding(FIELDS, { persistConsent: true, grantTokens: true }, deps);
  assert.deepEqual(r, { ok: false, step: "consent", cause: boom });
  assert.deepEqual(grants, []); // persist-before-grant: a failed consent blocks the grant
});

test("a grant failure is reported as step:grant (consent already succeeded)", async () => {
  const boom = new Error("ledger down");
  const { deps } = spyDeps({
    grantSignupTokens: async () => {
      throw boom;
    },
  });
  const r = await completeOnboarding(FIELDS, { persistConsent: true, grantTokens: true }, deps);
  assert.deepEqual(r, { ok: false, step: "grant", cause: boom });
});
