import "server-only";

/**
 * Data layer — the attorney-review thread and case status transitions.
 *
 * `case_reviews` is an append-only log of workflow events (submitted, changes
 * requested, signed, filed, decision) and free-form notes; `setCaseStatus`
 * advances the case lifecycle. Delegates to the unified `Store` (Firestore in
 * prod, PGlite locally — see @/lib/db/store). Same graceful-degradation
 * contract as the rest of the data layer: every function no-ops without a store.
 *
 * These functions do NOT enforce who may call them — the server actions in
 * `features/review/actions.ts` apply the ownership / attorney-role gates.
 */
import { getStore } from "@/lib/db/store";

export type ReviewKind =
  | "note"
  | "submitted"
  | "changes_requested"
  | "signed"
  | "filed"
  | "decision";

export interface ReviewEvent {
  id: string;
  authorRole: string; // applicant | attorney
  kind: ReviewKind;
  body: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/** Append one event to a case's review thread. No-op when no store. */
export async function addReviewEvent(input: {
  caseId: string;
  authorId: string | null;
  authorRole: "applicant" | "attorney";
  kind: ReviewKind;
  body?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const store = await getStore();
  if (!store) return;
  await store.addReviewEvent(input);
}

/** The review thread for a case, oldest first. Empty when no store. */
export async function getReviewEvents(
  caseId: string,
): Promise<readonly ReviewEvent[]> {
  const store = await getStore();
  if (!store) return [];
  return store.getReviewEvents(caseId);
}

/**
 * Advance a case's lifecycle status, optionally recording the USCIS receipt
 * number (set when the attorney signs and files). No-op when no store.
 */
export async function setCaseStatus(
  caseId: string,
  status: string,
  opts: { receiptNumber?: string } = {},
): Promise<void> {
  const store = await getStore();
  if (!store) return;
  await store.setCaseStatus(caseId, status, opts.receiptNumber);
}
