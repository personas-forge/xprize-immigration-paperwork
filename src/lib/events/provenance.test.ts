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
