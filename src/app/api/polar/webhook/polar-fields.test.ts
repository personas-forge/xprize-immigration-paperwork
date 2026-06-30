import assert from "node:assert/strict";
import { test } from "node:test";

import { pickStr, productId, resolveUserId } from "./polar-fields";

// The webhook routes the refund dedupe key through pickStr(data, "order_id",
// "orderId") instead of a raw `order_id ?? orderId`. These tests pin the contract
// that the refactor relies on: IDENTICAL to the raw `??` for well-formed (string)
// payloads, but type-guarded so a malformed non-string can't become the key.

test("pickStr: first non-empty string among the keys wins (snake before camel)", () => {
  assert.equal(pickStr({ order_id: "o_1", orderId: "o_2" }, "order_id", "orderId"), "o_1");
});

test("pickStr: falls back to the next key when the first is absent (camel fallback)", () => {
  assert.equal(pickStr({ orderId: "o_2" }, "order_id", "orderId"), "o_2");
});

test("pickStr: byte-identical to `a ?? b` for a well-formed string payload", () => {
  const data = { order_id: "ord_well_formed" };
  const raw = (data.order_id as string | undefined) ?? (data as Record<string, unknown>).orderId;
  assert.equal(pickStr(data, "order_id", "orderId"), raw);
  assert.equal(pickStr(data, "order_id", "orderId"), "ord_well_formed");
});

test("pickStr: rejects a non-string (malformed) value the raw `??` would have kept", () => {
  // A numeric order_id passes the raw `order_id ?? orderId` (truthy) but must NOT
  // become a dedupe key — pickStr skips it and tries the next key, else undefined.
  assert.equal(pickStr({ order_id: 12345 } as Record<string, unknown>, "order_id", "orderId"), undefined);
  assert.equal(
    pickStr({ order_id: 12345, orderId: "o_camel" } as Record<string, unknown>, "order_id", "orderId"),
    "o_camel",
  );
});

test("pickStr: empty string is treated as absent (no key resolves → undefined)", () => {
  assert.equal(pickStr({ order_id: "" }, "order_id", "orderId"), undefined);
});

test("pickStr: undefined when none of the keys are present", () => {
  assert.equal(pickStr({}, "order_id", "orderId"), undefined);
});

test("productId / resolveUserId: still normalise the camel/snake duality via pickStr", () => {
  assert.equal(productId({ product_id: "prod_1" }), "prod_1");
  assert.equal(productId({ productId: "prod_2" }), "prod_2");
  // metadata.userId wins; else externalCustomerId; else customer.externalId.
  assert.equal(resolveUserId({ metadata: { userId: "u_meta" }, externalCustomerId: "u_ext" }), "u_meta");
  assert.equal(resolveUserId({ external_customer_id: "u_ext" }), "u_ext");
});
