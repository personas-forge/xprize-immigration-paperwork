import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  AddDocumentInput,
  Store,
  StoredDocument,
  TransitionCaseInput,
} from "../db/store";
import { EventBus } from "./bus";
import { withEvents } from "./store-events";
import type { DomainEvent } from "./types";

const FIXED = "2026-06-04T12:00:00.000Z";

/**
 * A spy Store: every method throws unless the test overrides it, so a decorator
 * that forwards an unexpected call is caught. Calls are recorded for delegation
 * assertions.
 */
function spyStore(overrides: Partial<Store>): {
  store: Store;
  calls: string[];
} {
  const calls: string[] = [];
  const handler: ProxyHandler<Store> = {
    get(_t, prop: string) {
      if (prop in overrides) {
        return (...args: unknown[]) => {
          calls.push(prop);
          // @ts-expect-error indexed access on the partial override
          return overrides[prop](...args);
        };
      }
      return () => {
        throw new Error(`unexpected Store.${String(prop)} call`);
      };
    },
  };
  return { store: new Proxy({} as Store, handler), calls };
}

function busCapturing(): { bus: EventBus; events: DomainEvent[] } {
  const bus = new EventBus();
  const events: DomainEvent[] = [];
  bus.onAny((e) => {
    events.push(e);
  });
  return { bus, events };
}

test("transitionCase emits ONLY when the transition applied", async () => {
  const { bus, events } = busCapturing();

  const applied = withEvents(
    spyStore({ transitionCase: async () => true }).store,
    bus,
    () => FIXED,
  );
  const input: TransitionCaseInput = {
    caseId: "case-2",
    fromStatuses: ["Intake"],
    toStatus: "Drafting",
    events: [],
  };
  const result = await applied.transitionCase(input);

  assert.equal(result, true);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "CaseStatusChanged");
  assert.equal((events[0] as { guarded: boolean }).guarded, true);
});

test("transitionCase stays silent on a failed compare-and-set", async () => {
  const { bus, events } = busCapturing();
  const noop = withEvents(
    spyStore({ transitionCase: async () => false }).store,
    bus,
  );

  const result = await noop.transitionCase({
    caseId: "case-3",
    fromStatuses: ["Filed"],
    toStatus: "Approved",
    events: [],
  });

  assert.equal(result, false);
  assert.deepEqual(events, []);
});

test("saveDraft emits DraftGenerated with the persisted version", async () => {
  const { store } = spyStore({ saveDraft: async () => 4 });
  const { bus, events } = busCapturing();
  const wrapped = withEvents(store, bus, () => FIXED);

  const version = await wrapped.saveDraft(
    "case-4",
    [
      { heading: "A", body: "..." },
      { heading: "B", body: "..." },
    ],
    "gemini",
  );

  assert.equal(version, 4);
  assert.deepEqual(events, [
    {
      type: "DraftGenerated",
      at: FIXED,
      caseId: "case-4",
      version: 4,
      source: "gemini",
      sectionCount: 2,
    },
  ]);
});

test("addCaseDocument emits EvidenceUploaded from the stored doc", async () => {
  const stored: StoredDocument = {
    id: "doc-9",
    name: "passport.pdf",
    criterion: "Awards",
    exhibit: "Exhibit 3",
    status: "attached",
    facts: ["fact"],
    source: "mock",
  };
  const { store } = spyStore({ addCaseDocument: async () => stored });
  const { bus, events } = busCapturing();
  const wrapped = withEvents(store, bus, () => FIXED);

  const input: AddDocumentInput = {
    caseId: "case-5",
    name: "passport.pdf",
    criterion: "Awards",
    facts: ["fact"],
    source: "mock",
  };
  const doc = await wrapped.addCaseDocument(input);

  assert.equal(doc, stored);
  assert.deepEqual(events, [
    {
      type: "EvidenceUploaded",
      at: FIXED,
      caseId: "case-5",
      documentId: "doc-9",
      criterion: "Awards",
      exhibit: "Exhibit 3",
      source: "mock",
    },
  ]);
});

test("read methods pass through untouched and publish nothing", async () => {
  const cases = [{ id: "c1" }];
  const { store, calls } = spyStore({
    // @ts-expect-error minimal stub shape for the test
    getCasesForUser: async () => cases,
  });
  const { bus, events } = busCapturing();
  const wrapped = withEvents(store, bus);

  const result = await wrapped.getCasesForUser("user-1");

  assert.equal(result, cases);
  assert.deepEqual(calls, ["getCasesForUser"]);
  assert.deepEqual(events, []);
});

test("a failed mutation does NOT emit (write rejects, no event)", async () => {
  const { bus, events } = busCapturing();
  const wrapped = withEvents(
    spyStore({
      transitionCase: async () => {
        throw new Error("db down");
      },
    }).store,
    bus,
  );

  await assert.rejects(() =>
    wrapped.transitionCase({
      caseId: "c",
      fromStatuses: ["Filed"],
      toStatus: "Approved",
      events: [],
    }),
  );
  assert.deepEqual(events, []);
});
