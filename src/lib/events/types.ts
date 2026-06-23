/**
 * Typed domain events for the in-process event bus (ADR-0007).
 *
 * These describe meaningful state changes in the petition pipeline so that
 * side-effects (attorney notification, audit logging, analytics) can subscribe
 * WITHOUT the persistence boundary (`@/lib/db/store`) knowing they exist. The
 * Store emits; subscribers react. Adding a side-effect means adding a
 * subscriber, never editing the Store.
 *
 * Every event carries `type` (discriminant), `at` (ISO-8601 emit time), and a
 * `caseId` so subscribers can correlate without re-reading the store.
 */

/** A case advanced its lifecycle status (setCaseStatus / transitionCase). */
export interface CaseStatusChanged {
  type: "CaseStatusChanged";
  at: string;
  caseId: string;
  status: string;
  /** USCIS receipt recorded with the transition, when present. */
  receiptNumber?: string;
  /** True when emitted from a guarded compare-and-set transition. */
  guarded: boolean;
}

/** A petition draft version was persisted (saveDraft). */
export interface DraftGenerated {
  type: "DraftGenerated";
  at: string;
  caseId: string;
  version: number;
  /** Engine label that produced the draft (e.g. "gemini" | "mock"). */
  source: string;
  sectionCount: number;
}

/** A document was added to a case's evidence vault (addCaseDocument). */
export interface EvidenceUploaded {
  type: "EvidenceUploaded";
  at: string;
  caseId: string;
  documentId: string;
  criterion: string;
  exhibit: string;
  source: string;
}

/** The discriminated union every subscriber matches on. */
export type DomainEvent = CaseStatusChanged | DraftGenerated | EvidenceUploaded;

/** Literal union of all event type tags — handy for `subscribe(type, ...)`. */
export type DomainEventType = DomainEvent["type"];

/** Narrow a DomainEvent to the variant carrying `type`. */
export type EventOf<T extends DomainEventType> = Extract<DomainEvent, { type: T }>;
