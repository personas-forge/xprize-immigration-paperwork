import { test } from "node:test";
import assert from "node:assert/strict";

import { EventBus } from "./bus";
import {
  createProvenanceChain,
  hashAuditRecord,
  registerProvenanceLedger,
  verifyChain,
  type ChainedAuditRecord,
  type HashFn,
} from "./provenance";
import { type AuditRecord } from "./subscribers/audit-log";
import { type DraftGenerated } from "./types";

function rec(caseId: string, version: number): AuditRecord {
  return {
    event: "DraftGenerated",
    caseId,
    at: "2026-06-14T00:00:00.000Z",
    detail: { version, source: "gemini", sectionCount: 3 },
  };
}

test("createProvenanceChain: anchors null then chains prevHash → selfHash", () => {
  const chain = createProvenanceChain();
  const a = chain.append(rec("c1", 1));
  const b = chain.append(rec("c1", 2));
  assert.equal(a.prevHash, null, "first record anchors at null");
  assert.equal(b.prevHash, a.selfHash, "each record points at the prior hash");
  assert.equal(chain.head(), b.selfHash);
  assert.notEqual(a.selfHash, b.selfHash);
});

test("createProvenanceChain: stamps a strictly-increasing seq and flags `at` regression", () => {
  const chain = createProvenanceChain();
  const a = chain.append({ ...rec("c1", 1), at: "2026-06-14T00:00:02.000Z" });
  // A concurrent publish whose `at` precedes the head's `at` (clock/order inversion).
  const b = chain.append({ ...rec("c1", 2), at: "2026-06-14T00:00:01.000Z" });
  const c = chain.append({ ...rec("c1", 3), at: "2026-06-14T00:00:03.000Z" });
  assert.deepEqual([a.seq, b.seq, c.seq], [0, 1, 2], "seq is strictly increasing");
  assert.equal(a.atRegression, false, "first record can't regress");
  assert.equal(b.atRegression, true, "an earlier `at` than the head is flagged");
  assert.equal(c.atRegression, false, "a later `at` is fine");
  // seq/atRegression are metadata, NOT hashed, so the chain still verifies.
  assert.deepEqual(verifyChain(chain.records()), { ok: true });
});

test("createProvenanceChain: bounds the in-memory window at maxRecords", () => {
  const chain = createProvenanceChain(undefined, 3);
  for (let i = 0; i < 10; i++) chain.append(rec("c1", i));
  const recs = chain.records();
  assert.equal(recs.length, 3, "window never exceeds the cap");
  assert.deepEqual(recs.map((r) => r.seq), [7, 8, 9], "keeps the most-recent records");
  assert.notEqual(chain.head(), null, "head hash is retained across eviction");
});

test("hashAuditRecord: stable regardless of detail key order (canonical)", () => {
  const h1 = hashAuditRecord(
    { event: "DraftGenerated", caseId: "c", at: "t", detail: { a: 1, b: 2 } },
    null,
  );
  const h2 = hashAuditRecord(
    { event: "DraftGenerated", caseId: "c", at: "t", detail: { b: 2, a: 1 } },
    null,
  );
  assert.equal(h1, h2, "key order doesn't change the hash");
});

test("verifyChain: an intact chain verifies", () => {
  const chain = createProvenanceChain();
  chain.append(rec("c1", 1));
  chain.append(rec("c1", 2));
  chain.append(rec("c1", 3));
  assert.deepEqual(verifyChain(chain.records()), { ok: true });
});

test("verifyChain: ANY mutation breaks the chain at that record", () => {
  const chain = createProvenanceChain();
  chain.append(rec("c1", 1));
  chain.append(rec("c1", 2));
  chain.append(rec("c1", 3));
  const records = chain.records();

  // Tamper with the detail of record 1 (leave its hashes untouched).
  const tampered: ChainedAuditRecord[] = records.map((r, i) =>
    i === 1 ? { ...r, detail: { ...r.detail, version: 99 } } : r,
  );
  const v = verifyChain(tampered);
  assert.equal(v.ok, false);
  if (!v.ok) assert.equal(v.brokenAt, 1, "the tampered record is flagged");
});

test("verifyChain: deleting a record breaks the chain", () => {
  const chain = createProvenanceChain();
  chain.append(rec("c1", 1));
  chain.append(rec("c1", 2));
  chain.append(rec("c1", 3));
  const records = chain.records();
  const withHole = [records[0], records[2]]; // drop the middle
  const v = verifyChain(withHole);
  assert.equal(v.ok, false);
  if (!v.ok) assert.equal(v.brokenAt, 1);
});

test("verifyChain: injectable hash fn — verify uses the same fn that built it", () => {
  // A trivial fake hash: length-prefixed content. Deterministic + collision-free
  // enough for the test.
  const fake: HashFn = (input) => `h${input.length}:${input.slice(0, 8)}`;
  const chain = createProvenanceChain(fake);
  chain.append(rec("c1", 1));
  chain.append(rec("c1", 2));
  assert.deepEqual(verifyChain(chain.records(), fake), { ok: true });
  // The default SHA-256 verifier rejects a fake-hashed chain (hash mismatch).
  assert.equal(verifyChain(chain.records()).ok, false);
});

test("registerProvenanceLedger: chains real bus events; the sink gets chained records", async () => {
  const bus = new EventBus();
  const seen: ChainedAuditRecord[] = [];
  const { chain } = registerProvenanceLedger(bus, (r) => seen.push(r));

  const e1: DraftGenerated = {
    type: "DraftGenerated",
    caseId: "c1",
    at: "2026-06-14T00:00:00.000Z",
    version: 1,
    source: "gemini",
    sectionCount: 3,
  };
  await bus.publish(e1);
  await bus.publish({ ...e1, version: 2 });

  assert.equal(seen.length, 2);
  assert.equal(seen[0].prevHash, null);
  assert.equal(seen[1].prevHash, seen[0].selfHash);
  assert.deepEqual(verifyChain(chain.records()), { ok: true });
});
