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

/** Attach the audit subscriber to a bus. Returns its unsubscribe fn. */
export function registerAuditLog(bus: EventBus, sink: AuditSink = defaultSink) {
  return bus.onAny((event) => sink(toAuditRecord(event)));
}
