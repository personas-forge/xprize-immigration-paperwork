import assert from "node:assert/strict";
import { test } from "node:test";

import {
  type CaseFileDataDeps,
  clearCaseFileDataCache,
  fetchCaseFileData,
} from "./caseFileData";
import { type CaseFact, type CaseTask } from "./types";

const FACTS: readonly CaseFact[] = [{ label: "Classification", value: "O-1A" }];
const TASKS: readonly CaseTask[] = [{ id: "t1", label: "Sign G-28", owner: "Attorney" }];
const EXCERPT = "The petitioner is a person of extraordinary ability…";

/** A deps stub that records call counts and resolves the fixtures above. */
function makeDeps(): CaseFileDataDeps & { calls: Record<string, number> } {
  const calls = { facts: 0, tasks: 0, excerpt: 0 };
  return {
    calls,
    getCaseFacts: async () => {
      calls.facts++;
      return FACTS;
    },
    getOutstandingTasks: async () => {
      calls.tasks++;
      return TASKS;
    },
    getPetitionExcerpt: async () => {
      calls.excerpt++;
      return EXCERPT;
    },
  };
}

test("fetchCaseFileData composes the three sources into one snapshot", async () => {
  clearCaseFileDataCache();
  const deps = makeDeps();
  const data = await fetchCaseFileData(deps);

  assert.deepEqual(data.caseFacts, FACTS);
  assert.deepEqual(data.tasks, TASKS);
  assert.equal(data.petitionExcerpt, EXCERPT);
  assert.equal(deps.calls.facts, 1);
  assert.equal(deps.calls.tasks, 1);
  assert.equal(deps.calls.excerpt, 1);
});

test("the three reads run concurrently (Promise.all, not sequential)", async () => {
  clearCaseFileDataCache();
  let inFlight = 0;
  let maxConcurrent = 0;
  const gate = (result: unknown) => async () => {
    inFlight++;
    maxConcurrent = Math.max(maxConcurrent, inFlight);
    await Promise.resolve(); // yield so all three overlap before any resolves
    inFlight--;
    return result as never;
  };
  await fetchCaseFileData({
    getCaseFacts: gate(FACTS),
    getOutstandingTasks: gate(TASKS),
    getPetitionExcerpt: gate(EXCERPT),
  });
  assert.equal(maxConcurrent, 3, "all three fetches should be in flight at once");
});

test("repeated calls for the same case share one cached in-flight promise", async () => {
  clearCaseFileDataCache();
  const deps = makeDeps();
  const [a, b] = await Promise.all([fetchCaseFileData(deps), fetchCaseFileData(deps)]);

  assert.equal(a, b, "same case id returns the identical resolved snapshot");
  assert.equal(deps.calls.facts, 1, "each source fetched exactly once despite two callers");
  assert.equal(deps.calls.tasks, 1);
  assert.equal(deps.calls.excerpt, 1);
});

test("distinct case ids do not share a cache entry", async () => {
  clearCaseFileDataCache();
  const deps = makeDeps();
  await fetchCaseFileData(deps, "case-A");
  await fetchCaseFileData(deps, "case-B");
  assert.equal(deps.calls.facts, 2, "a different case id triggers a fresh fetch");
});

test("a rejected fetch is evicted so a later call can retry", async () => {
  clearCaseFileDataCache();
  let attempt = 0;
  const flaky: CaseFileDataDeps = {
    getCaseFacts: async () => {
      attempt++;
      if (attempt === 1) throw new Error("transient");
      return FACTS;
    },
    getOutstandingTasks: async () => TASKS,
    getPetitionExcerpt: async () => EXCERPT,
  };

  await assert.rejects(() => fetchCaseFileData(flaky), /transient/);
  // Cache must NOT have pinned the rejection — a retry succeeds.
  const data = await fetchCaseFileData(flaky);
  assert.deepEqual(data.caseFacts, FACTS);
  assert.equal(attempt, 2);
});
