import "server-only";

/**
 * Data layer — the attorney-review thread and case status transitions.
 *
 * `case_reviews` is an append-only log of workflow events (submitted, changes
 * requested, signed, filed, decision) and free-form notes; `transitionCase`
 * advances the case lifecycle (compare-and-set; the only sanctioned mutator). Delegates to the unified `Store` (Firestore in
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

/** The author-supplied fields for one review-thread event. The stored
 *  {@link ReviewEvent} additionally carries the generated `id` + `createdAt`. */
export interface ReviewEventInput {
  authorId: string | null;
  authorRole: "applicant" | "attorney";
  kind: ReviewKind;
  body?: string;
  metadata?: Record<string, unknown>;
}

/** Append one event to a case's review thread. No-op when no store. */
export async function addReviewEvent(
  input: ReviewEventInput & { caseId: string },
): Promise<void> {
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
 * Atomically advance a case's status AND append review events, but ONLY if the
 * current status is one of `fromStatuses` (compare-and-set). Returns true if it
 * applied, false if the precondition failed. The status guard + the same-
 * transaction event append fix both double-submits and audit-log desync. No
 * store → returns false: nothing was written, so the caller must NOT report
 * success (a phantom "filed" in a legal workflow is worse than a visible error).
 */
export async function transitionCase(input: {
  caseId: string;
  fromStatuses: readonly string[];
  toStatus: string;
  receiptNumber?: string;
  events: readonly ReviewEventInput[];
}): Promise<boolean> {
  const store = await getStore();
  if (!store) return false;
  return store.transitionCase(input);
}
