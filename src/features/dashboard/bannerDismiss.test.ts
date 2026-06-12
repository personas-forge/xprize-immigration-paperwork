import { test } from "node:test";
import assert from "node:assert/strict";

import { DISMISS_KEY, readDismissed, writeDismissed } from "./bannerDismiss";

// Tests for the token-economy explainer banner dismiss persistence.
// Covers: first-visit display (not yet dismissed) and dismiss write behaviour.
// Uses an injectable in-memory storage stub — no DOM, no window required.

function makeStorage(initial: Record<string, string> = {}): Pick<Storage, "getItem" | "setItem"> {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
  };
}

test("DISMISS_KEY is a stable, namespaced string (regression guard)", () => {
  assert.equal(DISMISS_KEY, "atelier-token-banner-dismissed");
});

test("readDismissed: returns false on first visit (key absent)", () => {
  const storage = makeStorage();
  assert.equal(readDismissed(storage), false);
});

test("readDismissed: returns false when key is present with a value other than '1'", () => {
  const storage = makeStorage({ [DISMISS_KEY]: "true" });
  assert.equal(readDismissed(storage), false);
});

test("readDismissed: returns true when key is '1' (already dismissed)", () => {
  const storage = makeStorage({ [DISMISS_KEY]: "1" });
  assert.equal(readDismissed(storage), true);
});

test("writeDismissed: sets DISMISS_KEY to '1'", () => {
  const storage = makeStorage();
  assert.equal(readDismissed(storage), false, "precondition: not yet dismissed");
  writeDismissed(storage);
  assert.equal(readDismissed(storage), true, "dismissed after write");
});

test("writeDismissed: is idempotent (calling twice is safe)", () => {
  const storage = makeStorage();
  writeDismissed(storage);
  writeDismissed(storage);
  assert.equal(readDismissed(storage), true);
});

test("readDismissed: gracefully returns false when storage.getItem throws", () => {
  const broken: Pick<Storage, "getItem" | "setItem"> = {
    getItem: () => { throw new Error("storage unavailable"); },
    setItem: () => {},
  };
  assert.equal(readDismissed(broken), false);
});
