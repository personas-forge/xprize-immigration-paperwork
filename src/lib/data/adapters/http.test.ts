import assert from "node:assert/strict";
import { test } from "node:test";

import {
  adapterErrorBody,
  httpStatusForError,
  toErrorResponse,
} from "./http";
import type { AdapterErrorKind } from "./result";

const CASES: Array<[AdapterErrorKind, number]> = [
  ["unconfigured", 503],
  ["forbidden", 403],
  ["not_found", 404],
  ["store_error", 500],
];

test("httpStatusForError: maps every kind to its status", () => {
  for (const [kind, status] of CASES) {
    assert.equal(httpStatusForError(kind), status);
  }
});

test("adapterErrorBody: returns a client-safe message + code, never the cause", () => {
  const body = adapterErrorBody({ kind: "store_error", cause: new Error("secret pg dsn") });
  assert.equal(body.code, "store_error");
  assert.equal(typeof body.error, "string");
  assert.ok(!JSON.stringify(body).includes("secret pg dsn"));
});

test("toErrorResponse: builds a NextResponse with the mapped status + body", async () => {
  const res = toErrorResponse({ kind: "forbidden" });
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), {
    error: "You do not have access to this case.",
    code: "forbidden",
  });
});
