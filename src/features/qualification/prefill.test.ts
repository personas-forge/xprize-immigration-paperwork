import { test } from "node:test";
import assert from "node:assert/strict";

import {
  QUALIFY_PREFILL_KEY,
  readQualifyPrefill,
  writeQualifyPrefill,
  type QualifyPrefill,
} from "./prefill";

/** Minimal in-memory Storage stand-in (no DOM under the node test runner). */
function fakeStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage;
}

const PREFILL: QualifyPrefill = {
  name: "Dr. Anya Krishnan",
  profile: "Senior research engineer with awards and publications.",
  classification: "EB-1A",
};

test("write then read round-trips the prefill", () => {
  const store = fakeStorage();
  writeQualifyPrefill(PREFILL, store);
  assert.deepEqual(readQualifyPrefill(store), PREFILL);
});

test("read is one-shot — it clears the stash so a refresh starts blank", () => {
  const store = fakeStorage();
  writeQualifyPrefill(PREFILL, store);
  assert.ok(readQualifyPrefill(store));
  assert.equal(store.getItem(QUALIFY_PREFILL_KEY), null);
  assert.equal(readQualifyPrefill(store), null);
});

test("read returns null on absent / malformed / profile-less payloads", () => {
  assert.equal(readQualifyPrefill(fakeStorage()), null);
  assert.equal(readQualifyPrefill(fakeStorage({ [QUALIFY_PREFILL_KEY]: "not json" })), null);
  assert.equal(
    readQualifyPrefill(fakeStorage({ [QUALIFY_PREFILL_KEY]: JSON.stringify({ name: "x" }) })),
    null,
    "no profile → null",
  );
});

test("read defaults name/classification when only a profile is present", () => {
  const store = fakeStorage({
    [QUALIFY_PREFILL_KEY]: JSON.stringify({ profile: "x".repeat(50) }),
  });
  assert.deepEqual(readQualifyPrefill(store), {
    name: "",
    profile: "x".repeat(50),
    classification: "O-1A",
  });
});
