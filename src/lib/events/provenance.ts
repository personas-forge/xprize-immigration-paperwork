/**
 * Tamper-evident Provenance Ledger (moonshot #2).
 *
 * The audit-log subscriber already projects every domain event into a structured
 * AuditRecord, but the trail is ephemeral and unverifiable. This turns that
 * stream into a cryptographically hash-chained, append-only ledger: each record
 * carries the prior record's hash plus a hash of its own canonical content, so
 * the entire history of what the AI did to a case is tamper-evident — any
 * mutation, insertion, deletion, or reorder breaks the chain.
 *
 * Pure + injectable: the hash function is a parameter (defaults to SHA-256 via
 * node:crypto), so `createProvenanceChain` / `verifyChain` are unit-tested with
 * a trivial fake hash. The ledger is the SAME projection the audit log uses
 * (`toAuditRecord`), so provenance can't drift from the audit trail.
 *
 * Server-side only (node:crypto); never imported into a client bundle.
 */

import { createHash } from "node:crypto";
import type { EventBus } from "./bus";
import { type AuditRecord, toAuditRecord } from "./subscribers/audit-log";

/** A hash-chained audit record: the base projection + the chain columns. */
export interface ChainedAuditRecord extends AuditRecord {
  /** The prior record's selfHash, or null for the chain anchor (first record). */
  prevHash: string | null;
  /** SHA-256 over the canonical {event, caseId, at, detail, prevHash}. */
  selfHash: string;
}

/** Injectable digest — `(input) => hex`. Default is SHA-256. */
export type HashFn = (input: string) => string;

const sha256: HashFn = (input) => createHash("sha256").update(input).digest("hex");

/** Recursively key-sorted JSON, so the hash is stable regardless of key order. */
function canonical(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(obj)
        .sort()
        .map((k) => [k, sortKeys(obj[k])]),
    );
  }
  return value;
}

/** Hash one record's content against the prior hash — the chain link. */
export function hashAuditRecord(
  record: AuditRecord,
  prevHash: string | null,
  hashFn: HashFn = sha256,
): string {
  return hashFn(
    canonical({
      event: record.event,
      caseId: record.caseId,
      at: record.at,
      detail: record.detail,
      prevHash,
    }),
  );
}

export interface ProvenanceChain {
  /** Append a record, computing its chain links from the running head. */
  append(record: AuditRecord): ChainedAuditRecord;
  /** The current head hash (last selfHash), or null when empty. */
  head(): string | null;
  /** A copy of the ledger so far. */
  records(): ChainedAuditRecord[];
}

/** A stateful, append-only hash chain over audit records. */
export function createProvenanceChain(hashFn: HashFn = sha256): ProvenanceChain {
  let head: string | null = null;
  const records: ChainedAuditRecord[] = [];
  return {
    append(record: AuditRecord): ChainedAuditRecord {
      const prevHash = head;
      const selfHash = hashAuditRecord(record, prevHash, hashFn);
      const chained: ChainedAuditRecord = { ...record, prevHash, selfHash };
      records.push(chained);
      head = selfHash;
      return chained;
    },
    head: () => head,
    records: () => [...records],
  };
}

export type ChainVerification =
  | { ok: true }
  | { ok: false; brokenAt: number; reason: string };

/**
 * Re-walk a chain and return the FIRST broken link (or intact). Recomputes each
 * selfHash and checks each prevHash points at the prior selfHash, so any
 * mutation, insertion, deletion, or reorder is caught.
 */
export function verifyChain(
  records: readonly ChainedAuditRecord[],
  hashFn: HashFn = sha256,
): ChainVerification {
  let prev: string | null = null;
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (r.prevHash !== prev) {
      return { ok: false, brokenAt: i, reason: "prevHash does not match the prior record" };
    }
    if (r.selfHash !== hashAuditRecord(r, prev, hashFn)) {
      return { ok: false, brokenAt: i, reason: "selfHash does not match the record content" };
    }
    prev = r.selfHash;
  }
  return { ok: true };
}

/** Sink for chained records (durable store, log, …). */
export type ChainedAuditSink = (record: ChainedAuditRecord) => void;

const defaultChainSink: ChainedAuditSink = (record) =>
  console.info(`[provenance] ${JSON.stringify(record)}`);

/**
 * Attach the provenance ledger to a bus: every event is projected
 * (`toAuditRecord`), hash-chained, and handed to `sink`. Returns the
 * unsubscribe fn plus the live chain (for verification / export).
 */
export function registerProvenanceLedger(
  bus: EventBus,
  sink: ChainedAuditSink = defaultChainSink,
  hashFn: HashFn = sha256,
): { unsubscribe: () => void; chain: ProvenanceChain } {
  const chain = createProvenanceChain(hashFn);
  const unsubscribe = bus.onAny((event) => {
    sink(chain.append(toAuditRecord(event)));
  });
  return { unsubscribe, chain };
}
