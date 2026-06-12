import assert from "node:assert/strict";
import { test } from "node:test";

import { EventBus } from "./bus";
import type { CaseStatusChanged, DraftGenerated } from "./types";

function statusEvent(caseId = "c1"): CaseStatusChanged {
  return {
    type: "CaseStatusChanged",
    at: "2026-01-01T00:00:00.000Z",
    caseId,
    status: "Filed",
    guarded: false,
  };
}

function draftEvent(caseId = "c1"): DraftGenerated {
  return {
    type: "DraftGenerated",
    at: "2026-01-01T00:00:00.000Z",
    caseId,
    version: 1,
    source: "mock",
    sectionCount: 3,
  };
}

test("on() delivers only the matching event type", async () => {
  const bus = new EventBus();
  const seen: string[] = [];
  bus.on("CaseStatusChanged", (e) => {
    seen.push(e.status);
  });

  await bus.publish(statusEvent());
  await bus.publish(draftEvent()); // different type — must NOT be delivered

  assert.deepEqual(seen, ["Filed"]);
});

test("onAny() receives every event type", async () => {
  const bus = new EventBus();
  const types: string[] = [];
  bus.onAny((e) => {
    types.push(e.type);
  });

  await bus.publish(statusEvent());
  await bus.publish(draftEvent());

  assert.deepEqual(types, ["CaseStatusChanged", "DraftGenerated"]);
});

test("unsubscribe stops further delivery", async () => {
  const bus = new EventBus();
  let count = 0;
  const off = bus.on("CaseStatusChanged", () => {
    count += 1;
  });

  await bus.publish(statusEvent());
  off();
  await bus.publish(statusEvent());

  assert.equal(count, 1);
});

test("a throwing handler is isolated and routed to onError", async () => {
  const errors: { type: string }[] = [];
  const bus = new EventBus({
    onError: (_err, event) => errors.push({ type: event.type }),
  });
  let siblingRan = false;

  bus.on("CaseStatusChanged", () => {
    throw new Error("boom");
  });
  bus.on("CaseStatusChanged", () => {
    siblingRan = true;
  });

  // publish must resolve (not reject) despite the throwing handler
  await bus.publish(statusEvent());

  assert.equal(siblingRan, true, "sibling handler still ran");
  assert.deepEqual(errors, [{ type: "CaseStatusChanged" }]);
});

test("a rejecting async handler is isolated too", async () => {
  let captured = false;
  const bus = new EventBus({ onError: () => (captured = true) });
  bus.onAny(async () => {
    await Promise.resolve();
    throw new Error("async boom");
  });

  await assert.doesNotReject(() => bus.publish(draftEvent()));
  assert.equal(captured, true);
});

test("publish awaits async handlers (back-pressure)", async () => {
  const bus = new EventBus();
  let done = false;
  bus.onAny(async () => {
    await new Promise((r) => setTimeout(r, 5));
    done = true;
  });

  await bus.publish(statusEvent());
  assert.equal(done, true, "publish resolved only after the handler settled");
});

test("clear() removes all subscribers", async () => {
  const bus = new EventBus();
  let count = 0;
  bus.on("CaseStatusChanged", () => {
    count += 1;
  });
  bus.onAny(() => {
    count += 1;
  });

  bus.clear();
  await bus.publish(statusEvent());

  assert.equal(count, 0);
});
