/**
 * Audit-log subscriber (ADR-0007).
 *
 * Listens to EVERY domain event and appends an immutable, structured audit
 * line — the compliance trail of who/what changed a case. The sink is injected
 * so production can route to a real log/store while tests capture in memory;
 * the default writes one JSON line to stdout.
 */

import type { EventBus } from "../bus";
import type { DomainEvent } from "../types";

export interface AuditRecord {
  event: DomainEvent["type"];
  caseId: string;
  at: string;
  detail: Record<string, unknown>;
}

export type AuditSink = (record: AuditRecord) => void;

const defaultSink: AuditSink = (record) =>
  console.info(`[audit] ${JSON.stringify(record)}`);

/** Project a domain event onto the audit-relevant fields for its type. */
export function toAuditRecord(event: DomainEvent): AuditRecord {
  const base = { event: event.type, caseId: event.caseId, at: event.at };
  switch (event.type) {
    case "CaseStatusChanged":
      return {
        ...base,
        detail: {
          status: event.status,
          guarded: event.guarded,
          receiptNumber: event.receiptNumber ?? null,
        },
      };
    case "DraftGenerated":
      return {
        ...base,
        detail: {
          version: event.version,
          source: event.source,
          sectionCount: event.sectionCount,
        },
      };
    case "EvidenceUploaded":
      return {
        ...base,
        detail: {
          documentId: event.documentId,
          exhibit: event.exhibit,
          criterion: event.criterion,
          source: event.source,
        },
      };
  }
}

/**
 * Attach the audit subscriber to a bus. Returns its unsubscribe fn.
 *
 * NOT WIRED into the production bus by default (see `getDomainBus`): the
 * provenance ledger is the LIVE audit projection and reuses this module's
 * `toAuditRecord`, so registering this too with the default `console.info` sink
 * would only double-log. This stays as the seam to wire WHEN a durable
 * `AuditSink` (a Store ledger table) exists — call `registerAuditLog(bus,
 * durableSink)` then. Do not assume a second, durable trail is live until it is.
 */
export function registerAuditLog(bus: EventBus, sink: AuditSink = defaultSink) {
  return bus.onAny((event) => sink(toAuditRecord(event)));
}
