import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ageBucket, formatAge, sortOldestFirst } from "./queue-age.js";

const NOW = 1_700_000_000_000; // fixed epoch for determinism
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

const MIN = 60_000;
const H = 3_600_000;

describe("ageBucket", () => {
  it("returns null for null input", () => assert.equal(ageBucket(null, NOW), null));
  it("returns null for undefined input", () => assert.equal(ageBucket(undefined, NOW), null));
  it("returns null for bad ISO string", () => assert.equal(ageBucket("not-a-date", NOW), null));
  it("returns null for future timestamp", () => assert.equal(ageBucket(iso(-1 * H), NOW), null));

  it("fresh for age < 12h", () => {
    assert.equal(ageBucket(iso(0), NOW), "fresh");
    assert.equal(ageBucket(iso(11 * H + 59 * MIN), NOW), "fresh");
  });

  it("warning at exactly 12h", () => {
    assert.equal(ageBucket(iso(12 * H), NOW), "warning");
  });

  it("warning for 12h–24h range", () => {
    assert.equal(ageBucket(iso(18 * H), NOW), "warning");
  });

  it("warning at exactly 24h", () => {
    assert.equal(ageBucket(iso(24 * H), NOW), "warning");
  });

  it("overdue for age > 24h", () => {
    assert.equal(ageBucket(iso(24 * H + 1), NOW), "overdue");
    assert.equal(ageBucket(iso(48 * H), NOW), "overdue");
  });
});

describe("formatAge", () => {
  it("returns null for null input", () => assert.equal(formatAge(null, NOW), null));
  it("returns null for future timestamp", () => assert.equal(formatAge(iso(-5 * MIN), NOW), null));

  it("minutes for < 1h", () => {
    assert.equal(formatAge(iso(45 * MIN), NOW), "45m");
    assert.equal(formatAge(iso(59 * MIN), NOW), "59m");
  });

  it("floors to 1m for very recent", () => {
    assert.equal(formatAge(iso(30_000), NOW), "1m"); // 30s
  });

  it("hours for 1h–23h", () => {
    assert.equal(formatAge(iso(1 * H), NOW), "1h");
    assert.equal(formatAge(iso(13 * H), NOW), "13h");
  });

  it("days for 1d+", () => {
    assert.equal(formatAge(iso(24 * H), NOW), "1d"); // exactly 24h = 1 day
    assert.equal(formatAge(iso(25 * H), NOW), "1d 1h");
    assert.equal(formatAge(iso(48 * H), NOW), "2d");
    assert.equal(formatAge(iso(52 * H), NOW), "2d 4h");
  });
});

describe("sortOldestFirst", () => {
  it("sorts oldest first", () => {
    const items = [
      { submittedAt: iso(1 * H), id: "A" },
      { submittedAt: iso(3 * H), id: "B" },
      { submittedAt: iso(2 * H), id: "C" },
    ];
    const sorted = sortOldestFirst(items);
    assert.deepEqual(
      sorted.map((x) => x.id),
      ["B", "C", "A"],
    );
  });

  it("items with null submittedAt sort last", () => {
    const items = [
      { submittedAt: null, id: "X" },
      { submittedAt: iso(5 * H), id: "Y" },
    ];
    assert.equal(sortOldestFirst(items)[0].id, "Y");
  });

  it("is non-mutating", () => {
    const items = [
      { submittedAt: iso(1 * H), id: "A" },
      { submittedAt: iso(3 * H), id: "B" },
    ];
    const copy = [...items];
    sortOldestFirst(items);
    assert.deepEqual(items, copy);
  });
});
