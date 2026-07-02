"use server";

/**
 * Server actions for managing the evidence vault: remove a document, restore a
 * soft-deleted one (undo), or re-file it under a different criterion. Each
 * re-derives the user and routes the
 * mutation through the {@link EvidenceAdapter} (ADR-0010), then revalidates the
 * case page. No-op without auth/DB (graceful degradation), matching the rest of
 * the app.
 *
 * ADR-0010 adoption: the owner-or-attorney gate is no longer hand-rolled here.
 * `EvidenceAdapter.removeDocument` / `refileDocument` gate through the single
 * fail-closed `resolveCase` seam before touching the vault, so the cross-tenant
 * `isConfiguredAttorney` check can never be forgotten at this call site (the
 * security invariant behind the prior HIGH findings on PII egress). Being a
 * server action — return type `void`, not an HTTP response — it consumes the
 * `AdapterResult` union directly (no `http.ts` mapping) and treats EVERY
 * non-`ok` outcome as a no-op: `unconfigured` (no backend), `forbidden` /
 * `not_found` (the access denial that previously short-circuited via
 * `canAccessCase`), and `store_error`. Behaviour nuance: a Store throw used to
 * propagate out of the action (an unhandled server-action error); it is now
 * caught by the adapter and degrades to a no-op (the page simply isn't
 * revalidated), matching the ADR's uniform error-handling contract.
 */

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth/session";
import { evidence } from "@/lib/data/adapters/evidence";
import { caseAccessFor } from "@/lib/data/adapters/access";
import { type StoredDocument } from "./types";

export async function removeDocument(
  caseId: string,
  documentId: string,
): Promise<void> {
  const user = await getUser();
  if (!user) return;
  // Full owner-or-attorney access context — these vault mutations DO honor the
  // configured-attorney-of-record fallback (unlike /api/draft, which is
  // owner-only), so the real email is passed for resolveCase to evaluate.
  const access = caseAccessFor(user);
  const result = await evidence.removeDocument(access, caseId, documentId);
  if (!result.ok) return;
  revalidatePath(`/dashboard/cases/${caseId}`);
}

/** Undo a removal: restore a soft-deleted document (it keeps its original exhibit
 *  ordinal). Same owner-or-attorney gate as removeDocument; no-op on any non-ok
 *  outcome (e.g. `not_found` when there's no matching deleted row). */
export async function restoreDocument(
  caseId: string,
  documentId: string,
): Promise<void> {
  const user = await getUser();
  if (!user) return;
  const access = caseAccessFor(user);
  const result = await evidence.restoreDocument(access, caseId, documentId);
  if (!result.ok) return;
  revalidatePath(`/dashboard/cases/${caseId}`);
}

export async function refileDocument(
  caseId: string,
  documentId: string,
  criterion: string,
): Promise<void> {
  const user = await getUser();
  if (!user) return;
  const access = caseAccessFor(user);
  const result = await evidence.refileDocument(
    access,
    caseId,
    documentId,
    criterion,
  );
  if (!result.ok) return;
  revalidatePath(`/dashboard/cases/${caseId}`);
}

/**
 * Free persistence-only rescue for a document that was categorized + charged
 * but failed to save (`saveFailed: true` from /api/evidence/categorize) — the
 * vault twin of /api/draft/save and /api/rfe/save. Never charges and never
 * re-categorizes: it re-attempts `addDocument` with the assessment the client
 * already holds. Returns the persisted document (fresh server-assigned exhibit
 * ordinal) or null — the caller keeps its optimistic entry on failure so the
 * user's charged work stays visible either way.
 */
export async function rescueDocument(
  caseId: string,
  doc: { name: string; criterion: string; facts: readonly string[]; source: string },
): Promise<{ ok: boolean; document: StoredDocument | null }> {
  const user = await getUser();
  if (!user) return { ok: false, document: null };
  const result = await evidence.addDocument(caseAccessFor(user), {
    caseId,
    name: doc.name,
    criterion: doc.criterion,
    facts: [...doc.facts],
    source: doc.source,
  });
  if (!result.ok) return { ok: false, document: null };
  revalidatePath(`/dashboard/cases/${caseId}`);
  return { ok: true, document: result.value };
}
