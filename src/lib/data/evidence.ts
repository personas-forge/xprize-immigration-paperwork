import "server-only";

/**
 * Data layer — the evidence vault (per-case documents).
 *
 * Each document is AI-categorized into an O-1A criterion (or 'Unsorted') and
 * gets a monotonic exhibit number on insert (never reused, so deleting a
 * document doesn't renumber the surviving exhibits). Delegates to the unified
 * `Store` (Firestore in prod, PGlite locally — see @/lib/db/store). Same
 * graceful-degradation contract as the rest of the data layer: every function
 * no-ops without a store.
 *
 * Ownership is NOT enforced here — the route / server actions apply the
 * owner-or-attorney gate before calling in.
 */
import { getStore } from "@/lib/db/store";
import { type StoredDocument } from "@/features/evidence/types";

// Re-exported so existing `@/lib/data/evidence` importers (the EvidenceAdapter)
// keep resolving StoredDocument unchanged; the shape lives in the server-free
// types module so the client EvidenceVault can share it.
export type { StoredDocument };

/**
 * Add a document to a case's vault, assigning the next exhibit number. Returns
 * the stored document, or `null` when no store.
 */
export async function addCaseDocument(input: {
  caseId: string;
  name: string;
  criterion: string;
  facts: readonly string[];
  source: string;
  status?: string;
}): Promise<StoredDocument | null> {
  const store = await getStore();
  if (!store) return null;
  return store.addCaseDocument(input);
}

/** Every document in a case's vault, by exhibit order. Empty when no store. */
export async function getCaseDocuments(
  caseId: string,
): Promise<readonly StoredDocument[]> {
  const store = await getStore();
  if (!store) return [];
  return store.getCaseDocuments(caseId);
}

/** SOFT-delete a document from a case's vault (recoverable; keeps the ordinal).
 *  No-op when no store. `deletedBy` records who removed it for the audit trail. */
export async function removeCaseDocument(
  caseId: string,
  documentId: string,
  deletedBy?: string | null,
): Promise<boolean> {
  const store = await getStore();
  if (!store) return false;
  return store.removeCaseDocument(caseId, documentId, deletedBy);
}

/** Restore a soft-deleted document. False when no store or no matching deleted
 *  document. */
export async function restoreCaseDocument(
  caseId: string,
  documentId: string,
): Promise<boolean> {
  const store = await getStore();
  if (!store) return false;
  return store.restoreCaseDocument(caseId, documentId);
}

/** Re-file a document under a different criterion bucket. False when no store or
 *  no matching document. */
export async function refileCaseDocument(
  caseId: string,
  documentId: string,
  criterion: string,
): Promise<boolean> {
  const store = await getStore();
  if (!store) return false;
  return store.refileCaseDocument(caseId, documentId, criterion);
}
