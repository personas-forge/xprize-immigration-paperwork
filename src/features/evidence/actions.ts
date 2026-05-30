"use server";

/**
 * Server actions for managing the evidence vault: remove a document, or re-file
 * it under a different criterion. Each re-derives the user and enforces the
 * owner-or-attorney gate before mutating, then revalidates the case page. No-op
 * without auth/DB (graceful degradation), matching the rest of the app.
 */

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth/session";
import { isAttorney } from "@/lib/auth/roles";
import { getCaseAnyOwner, getCaseForUser } from "@/lib/data/petitions";
import { refileCaseDocument, removeCaseDocument } from "@/lib/data/evidence";

/** True when the user owns the case or is an attorney of record. */
async function canAccessCase(
  userId: string,
  email: string | null | undefined,
  caseId: string,
): Promise<boolean> {
  const owned = await getCaseForUser(userId, caseId);
  if (owned) return true;
  return isAttorney(email) && Boolean(await getCaseAnyOwner(caseId));
}

export async function removeDocument(
  caseId: string,
  documentId: string,
): Promise<void> {
  const user = await getUser();
  if (!user) return;
  if (!(await canAccessCase(user.id, user.email, caseId))) return;
  await removeCaseDocument(caseId, documentId);
  revalidatePath(`/dashboard/cases/${caseId}`);
}

export async function refileDocument(
  caseId: string,
  documentId: string,
  criterion: string,
): Promise<void> {
  const user = await getUser();
  if (!user) return;
  if (!(await canAccessCase(user.id, user.email, caseId))) return;
  await refileCaseDocument(caseId, documentId, criterion);
  revalidatePath(`/dashboard/cases/${caseId}`);
}
