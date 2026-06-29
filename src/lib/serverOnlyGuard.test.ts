import { test } from "node:test";
import assert from "node:assert/strict";

import { assertServerOnly } from "@/lib/serverOnlyGuard";

test("assertServerOnly is a no-op on the server (no window)", () => {
  assert.equal(typeof window, "undefined");
  assert.doesNotThrow(() => assertServerOnly("@/lib/example"));
});

test("assertServerOnly throws with the module name when window is defined", () => {
  const g = globalThis as { window?: unknown };
  g.window = {};
  try {
    assert.throws(
      () => assertServerOnly("@/lib/example"),
      /@\/lib\/example must not be imported on the client\./,
    );
  } finally {
    delete g.window;
  }
});
