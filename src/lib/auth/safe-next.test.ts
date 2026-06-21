import assert from "node:assert/strict";
import { test } from "node:test";

import { safeNext } from "./safe-next";

test("safeNext accepts clean same-origin relative paths", () => {
  assert.equal(safeNext("/dashboard/cases/abc/draft"), "/dashboard/cases/abc/draft");
  assert.equal(safeNext("/billing?status=success"), "/billing?status=success");
});

test("safeNext rejects open-redirect vectors, defaulting to /dashboard", () => {
  for (const bad of [
    null,
    undefined,
    "",
    "https://evil.example/phish",
    "//evil.example",
    "/\\evil.example",
    "\\/\\/evil",
    "http://evil",
    "javascript:alert(1)",
    "/%2f%2fevil", // encoded protocol-relative
    "/ /spaces",
  ]) {
    assert.equal(safeNext(bad), "/dashboard", `must reject ${JSON.stringify(bad)}`);
  }
});
