import assert from "node:assert/strict";
import { test } from "node:test";

import {
  fetchCaseFileData,
  clearCaseFileDataCache,
  type CaseFileDataSources,
} from "./caseFileData";
import { type CaseFact, type CaseTask } from "./types";

// These pin the parallel-fetch + per-caseId cache contract of `fetchCaseFileData`
// — the testable core behind `useCaseFileData` (ADR-0009). Pure node:test, no
// jsdom/RTL: the hook itself isn't rendered, only its fetch logic is exercised
// via an injected `sources` stub.

const FACTS: readonly CaseFact[] = [{ label: "Classification", value: "O-1A" }];
const TASKS: readonly CaseTask[] = [
  { id: "t1", label: "Collect recommendation letters", owner: "Attorney" },
];
const EXCERPT = "The petitioner is among the small percentage at the top…";

/** A sources stub that records how many times each fn was called. */
function stubSources(): { sources: CaseFileDataSources; calls: () => number } {
  let calls = 0;
  return {
    calls: () => calls,
    sources: {
      getCaseFacts: async () => {
        calls++;
        return FACTS;
      },
      getOutstandingTasks: async () => {
        calls++;
        return TASKS;
      },
      getPetitionExcerpt: async () => {
        calls++;
        return EXCERPT;
      },
    },
  };
}

test("fetchCaseFileData: combines the three sources into one object", async () => {
  clearCaseFileDataCache();
  const { sources } = stubSources();

  const data = await fetchCaseFileData("case-1", sources);

  assert.deepEqual(data.caseFacts, FACTS);
  assert.deepEqual(data.tasks, TASKS);
  assert.equal(data.excerpt, EXCERPT);
});

test("fetchCaseFileData: fires all three sources concurrently (Promise.all, not sequential)", async () => {
  clearCaseFileDataCache();

  // Deferred sources that never resolve on their own — we resolve them by hand
  // AFTER asserting all three were already invoked. If the fetch were
  // sequential it would be parked awaiting the first source and the other two
  // would not have been called yet.
  const started: string[] = [];
  const release: Array<() => void> = [];
  const defer = <T,>(name: string, value: T) => () =>
    new Promise<T>((resolve) => {
      started.push(name);
      release.push(() => resolve(value));
    });

  const sources: CaseFileDataSources = {
    getCaseFacts: defer("facts", FACTS),
    getOutstandingTasks: defer("tasks", TASKS),
    getPetitionExcerpt: defer("excerpt", EXCERPT),
  };

  const pending = fetchCaseFileData("case-concurrent", sources);
  // Let microtasks flush so all three synchronous-start fns have run.
  await Promise.resolve();

  assert.deepEqual(started.sort(), ["excerpt", "facts", "tasks"]);

  release.forEach((fn) => fn());
  const data = await pending;
  assert.equal(data.excerpt, EXCERPT);
});

test("fetchCaseFileData: memoises per caseId — same key shares one in-flight request", async () => {
  clearCaseFileDataCache();
  const { sources, calls } = stubSources();

  const a = fetchCaseFileData("case-x", sources);
  const b = fetchCaseFileData("case-x", sources);

  assert.equal(a, b, "same caseId must return the identical cached promise");
  await Promise.all([a, b]);
  assert.equal(calls(), 3, "three source fns invoked exactly once across both calls");
});

test("fetchCaseFileData: different caseId → separate cache entries", async () => {
  clearCaseFileDataCache();
  const { sources, calls } = stubSources();

  const a = fetchCaseFileData("case-a", sources);
  const b = fetchCaseFileData("case-b", sources);

  assert.notEqual(a, b);
  await Promise.all([a, b]);
  assert.equal(calls(), 6, "each caseId fetches its own three sources");
});

test("fetchCaseFileData: undefined caseId is cached under a stable default key", async () => {
  clearCaseFileDataCache();
  const { sources } = stubSources();

  const a = fetchCaseFileData(undefined, sources);
  const b = fetchCaseFileData(undefined, sources);

  assert.equal(a, b, "undefined caseId must hit the same default cache slot");
  await Promise.all([a, b]);
});

test("fetchCaseFileData: a rejected fetch is evicted so the next call retries", async () => {
  clearCaseFileDataCache();
  let attempt = 0;
  const sources: CaseFileDataSources = {
    getCaseFacts: async () => {
      attempt++;
      if (attempt === 1) throw new Error("transient");
      return FACTS;
    },
    getOutstandingTasks: async () => TASKS,
    getPetitionExcerpt: async () => EXCERPT,
  };

  await assert.rejects(fetchCaseFileData("case-retry", sources), /transient/);
  // Cache evicted on rejection → second call re-runs and succeeds.
  const data = await fetchCaseFileData("case-retry", sources);
  assert.deepEqual(data.caseFacts, FACTS);
  assert.equal(attempt, 2);
});
