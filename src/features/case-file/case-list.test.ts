import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_CASE_QUERY,
  filterCases,
  queryCases,
  sortCases,
  type CaseQuery,
} from "./case-list";
import { type PetitionCase } from "./types";

const sample: PetitionCase[] = [
  {
    id: "a",
    fileNumber: "O1-241",
    petitioner: "Anya Krishnan",
    classification: "O-1A",
    status: "Drafting",
    approvalLikelihood: 92,
    targetFileDate: "2026-06-12",
    attorney: "J. Park, Esq.",
  },
  {
    id: "b",
    fileNumber: "EB1-104",
    petitioner: "Wei Chen",
    classification: "EB-1A",
    status: "Intake",
    approvalLikelihood: 71,
    targetFileDate: "2026-07-20",
    attorney: "R. Osei, Esq.",
  },
  {
    id: "c",
    fileNumber: "O1-219",
    petitioner: "Tomás Becker",
    classification: "O-1B",
    status: "Approved",
    approvalLikelihood: 96,
    targetFileDate: "2026-03-28",
    attorney: "J. Park, Esq.",
  },
];

const q = (patch: Partial<CaseQuery> = {}): CaseQuery => ({
  ...DEFAULT_CASE_QUERY,
  ...patch,
});

test("filterCases: empty query returns everything", () => {
  assert.equal(filterCases(sample, q()).length, 3);
});

test("filterCases: search matches petitioner, file number, and attorney, case-insensitively", () => {
  assert.deepEqual(
    filterCases(sample, q({ search: "wei" })).map((c) => c.id),
    ["b"],
  );
  assert.deepEqual(
    filterCases(sample, q({ search: "o1-2" })).map((c) => c.id).sort(),
    ["a", "c"],
  );
  assert.deepEqual(
    filterCases(sample, q({ search: "osei" })).map((c) => c.id),
    ["b"],
  );
});

test("filterCases: classification and status filters combine (AND)", () => {
  assert.deepEqual(
    filterCases(sample, q({ classification: "O-1A" })).map((c) => c.id),
    ["a"],
  );
  assert.deepEqual(
    filterCases(sample, q({ status: "Approved" })).map((c) => c.id),
    ["c"],
  );
  assert.equal(
    filterCases(sample, q({ classification: "O-1A", status: "Approved" })).length,
    0,
  );
});

test("filterCases: does not mutate input", () => {
  const before = sample.map((c) => c.id);
  filterCases(sample, q({ search: "wei" }));
  assert.deepEqual(
    sample.map((c) => c.id),
    before,
  );
});

test("sortCases: targetDate ascending vs descending", () => {
  assert.deepEqual(
    sortCases(sample, "targetDate", "asc").map((c) => c.id),
    ["c", "a", "b"],
  );
  assert.deepEqual(
    sortCases(sample, "targetDate", "desc").map((c) => c.id),
    ["b", "a", "c"],
  );
});

test("sortCases: likelihood and status use their intended ordering", () => {
  assert.deepEqual(
    sortCases(sample, "likelihood", "desc").map((c) => c.approvalLikelihood),
    [96, 92, 71],
  );
  // Status order is lifecycle, not alphabetical: Intake < Drafting < Approved.
  assert.deepEqual(
    sortCases(sample, "status", "asc").map((c) => c.status),
    ["Intake", "Drafting", "Approved"],
  );
});

test("queryCases: filter then sort, in one pass", () => {
  // "park" matches only the two J. Park cases (a, c); likelihood desc → c, a.
  const result = queryCases(
    sample,
    q({ search: "park", sortKey: "likelihood", sortDir: "desc" }),
  );
  assert.deepEqual(
    result.map((c) => c.id),
    ["c", "a"],
  );
});

test("queryCases: robust against non-array input", () => {
  // @ts-expect-error — exercising untrusted input
  assert.deepEqual(queryCases(null, q()), []);
});
