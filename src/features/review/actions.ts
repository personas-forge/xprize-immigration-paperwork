"use server";

/**
 * Server actions for the attorney review & filing workflow.
 *
 * Each action re-derives the user, enforces the right gate (ownership for
 * applicant actions, attorney role for sign-off/filing), mutates the case +
 * appends a review event, then revalidates the affected pages. Every action is
 * a no-op without auth/DB, matching the rest of the app's graceful degradation.
 *
 * DocuSign e-signature and USCIS portal e-filing are recorded as events here
 * (stubs) — the same posture as the rest of the app until those integrations
 * are wired.
 */

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth/session";
import { isAttorney } from "@/lib/auth/roles";
import { getCaseAnyOwner, getCaseForUser } from "@/lib/data/petitions";
import { addReviewEvent, setCaseStatus } from "@/lib/data/reviews";

function revalidateCase(caseId: string): void {
  revalidatePath(`/dashboard/cases/${caseId}`);
  revalidatePath("/dashboard/review");
  revalidatePath("/dashboard");
}

/** USCIS-style receipt number (e.g. "EAC2412345678"). Stub for real filing. */
function newReceiptNumber(): string {
  return `EAC${Math.floor(1_000_000_000 + Math.random() * 9_000_000_000)}`;
}

/** Applicant submits a drafted case to the attorney of record for review. */
export async function submitForReview(caseId: string): Promise<void> {
  const user = await getUser();
  if (!user) return;
  const owned = await getCaseForUser(user.id, caseId);
  if (!owned) return; // only the owner may submit their case
  await addReviewEvent({
    caseId,
    authorId: user.id,
    authorRole: "applicant",
    kind: "submitted",
    body: "Submitted to the attorney of record for review.",
  });
  await setCaseStatus(caseId, "Attorney Review");
  revalidateCase(caseId);
}

/** Owner OR attorney adds a free-form note to the review thread. */
export async function addReviewNote(
  caseId: string,
  formData: FormData,
): Promise<void> {
  const user = await getUser();
  if (!user) return;
  const body = String(formData.get("body") ?? "").trim().slice(0, 4000);
  if (!body) return;
  const owned = await getCaseForUser(user.id, caseId);
  const attorney = isAttorney(user.email);
  if (!owned && !attorney) return;
  await addReviewEvent({
    caseId,
    authorId: user.id,
    authorRole: owned ? "applicant" : "attorney",
    kind: "note",
    body,
  });
  revalidateCase(caseId);
}

/** Attorney returns the case to the applicant with required changes. */
export async function attorneyRequestChanges(
  caseId: string,
  formData: FormData,
): Promise<void> {
  const user = await getUser();
  if (!user || !isAttorney(user.email)) return;
  const c = await getCaseAnyOwner(caseId);
  if (!c) return;
  const body =
    String(formData.get("feedback") ?? "").trim().slice(0, 4000) ||
    "Please revise and resubmit.";
  await addReviewEvent({
    caseId,
    authorId: user.id,
    authorRole: "attorney",
    kind: "changes_requested",
    body,
  });
  await setCaseStatus(caseId, "Drafting");
  revalidateCase(caseId);
}

/** Attorney signs the petition (e-sign stub) and files it with USCIS (stub),
 *  recording a receipt number and advancing the case to "Filed". */
export async function attorneySignAndFile(caseId: string): Promise<void> {
  const user = await getUser();
  if (!user || !isAttorney(user.email)) return;
  const c = await getCaseAnyOwner(caseId);
  if (!c) return;
  const receipt = newReceiptNumber();
  await addReviewEvent({
    caseId,
    authorId: user.id,
    authorRole: "attorney",
    kind: "signed",
    body: "Petition signed by the attorney of record.",
  });
  await addReviewEvent({
    caseId,
    authorId: user.id,
    authorRole: "attorney",
    kind: "filed",
    body: "Filed with USCIS.",
    metadata: { receipt },
  });
  await setCaseStatus(caseId, "Filed", { receiptNumber: receipt });
  revalidateCase(caseId);
}

/** Attorney records the USCIS decision once it comes back. */
export async function attorneyRecordDecision(
  caseId: string,
  formData: FormData,
): Promise<void> {
  const user = await getUser();
  if (!user || !isAttorney(user.email)) return;
  const c = await getCaseAnyOwner(caseId);
  if (!c) return;
  const decision = String(formData.get("decision") ?? "Approved");
  await addReviewEvent({
    caseId,
    authorId: user.id,
    authorRole: "attorney",
    kind: "decision",
    body: `USCIS decision recorded: ${decision}.`,
  });
  // Approved advances to the terminal "Approved" state; anything else stays
  // "Filed" (the record of the decision is in the thread).
  await setCaseStatus(caseId, decision === "Approved" ? "Approved" : "Filed");
  revalidateCase(caseId);
}
