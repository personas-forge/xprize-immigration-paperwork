"use server";

/**
 * Server actions for the attorney review & filing workflow.
 *
 * Each action re-derives the user and enforces the right gate (ownership for
 * applicant actions, CONFIGURED-attorney role for sign-off/filing). Status
 * changes go through `transitionCase`, which compare-and-sets the status and
 * appends the review events atomically — so a stale tab / double-submit / direct
 * invocation can't double-file, record a decision on an unfiled case, or reopen
 * a filed one, and the append-only log never desyncs from the case status.
 *
 * Authorization note: the privileged actions gate on `isConfiguredAttorney`
 * (fail-closed), NOT `isAttorney` (which is true for every signed-in user when
 * ATTORNEY_EMAILS is unset). Set ATTORNEY_EMAILS to exercise sign/file — even in
 * dev — so cross-tenant filing is never open by default.
 *
 * DocuSign e-signature and USCIS portal e-filing are recorded as events here
 * (stubs) — the same posture as the rest of the app until those are wired.
 */

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth/session";
import { isConfiguredAttorney } from "@/lib/auth/roles";
import { petitions } from "@/lib/data/adapters/petition";
import { addReviewEvent, transitionCase } from "@/lib/data/reviews";

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
  // Owner-only gate via the PetitionAdapter (ADR-0010). `email` is omitted so the
  // adapter's single resolveCase resolves owner-only (the configured-attorney
  // cross-tenant fallback never fires) — preserving the prior owner-only
  // `getCaseForUser` semantics while the adapter owns null/store-error handling.
  const gate = await petitions.resolveCase({ userId: user.id, email: null }, caseId);
  if (!gate.ok) return; // only the owner may submit their case
  const applied = await transitionCase({
    caseId,
    fromStatuses: ["Intake", "Drafting"],
    toStatus: "Attorney Review",
    events: [
      {
        authorId: user.id,
        authorRole: "applicant",
        kind: "submitted",
        body: "Submitted to the attorney of record for review.",
      },
    ],
  });
  if (applied) revalidateCase(caseId);
}

/** Owner OR a configured attorney adds a free-form note to the review thread. */
export async function addReviewNote(
  caseId: string,
  formData: FormData,
): Promise<void> {
  const user = await getUser();
  if (!user) return;
  const body = String(formData.get("body") ?? "").trim().slice(0, 4000);
  if (!body) return;
  // Owner-or-attorney note gate. Ownership resolves through the adapter
  // (email omitted ⇒ owner-only, fail-closed) so it gets the centralized
  // null/store-error handling; a non-owning configured attorney is the
  // fallback. Mirrors the prior `owned`/`attorney` split byte-for-byte, and
  // `owned` still drives the author-role attribution (StoredCase carries no
  // owner field, so the role can't be read off the resolved case).
  const owned = (await petitions.resolveCase({ userId: user.id, email: null }, caseId)).ok;
  const attorney = isConfiguredAttorney(user.email);
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
  if (!user || !isConfiguredAttorney(user.email)) return;
  const body =
    String(formData.get("feedback") ?? "").trim().slice(0, 4000) ||
    "Please revise and resubmit.";
  // Only from Attorney Review — can't bounce an already-Filed case to Drafting.
  const applied = await transitionCase({
    caseId,
    fromStatuses: ["Attorney Review"],
    toStatus: "Drafting",
    events: [
      {
        authorId: user.id,
        authorRole: "attorney",
        kind: "changes_requested",
        body,
      },
    ],
  });
  if (applied) revalidateCase(caseId);
}

/** Attorney signs the petition (e-sign stub) and files it with USCIS (stub),
 *  recording a receipt number and advancing the case to "Filed". */
export async function attorneySignAndFile(caseId: string): Promise<void> {
  const user = await getUser();
  if (!user || !isConfiguredAttorney(user.email)) return;
  const receipt = newReceiptNumber();
  // Compare-and-set from Attorney Review → a second (double-click / stale tab)
  // call finds status already Filed, does NOT apply, and mints no second receipt.
  const applied = await transitionCase({
    caseId,
    fromStatuses: ["Attorney Review"],
    toStatus: "Filed",
    receiptNumber: receipt,
    events: [
      {
        authorId: user.id,
        authorRole: "attorney",
        kind: "signed",
        body: "Petition signed by the attorney of record.",
      },
      {
        authorId: user.id,
        authorRole: "attorney",
        kind: "filed",
        body: "Filed with USCIS.",
        metadata: { receipt },
      },
    ],
  });
  if (applied) revalidateCase(caseId);
}

/** Attorney records the USCIS decision once it comes back. */
export async function attorneyRecordDecision(
  caseId: string,
  formData: FormData,
): Promise<void> {
  const user = await getUser();
  if (!user || !isConfiguredAttorney(user.email)) return;
  const decision = String(formData.get("decision") ?? "Approved");
  // Only a Filed case can receive a decision. "Approved" is terminal; any other
  // decision keeps the case "Filed" (the decision is recorded in the thread).
  const applied = await transitionCase({
    caseId,
    fromStatuses: ["Filed"],
    toStatus: decision === "Approved" ? "Approved" : "Filed",
    events: [
      {
        authorId: user.id,
        authorRole: "attorney",
        kind: "decision",
        body: `USCIS decision recorded: ${decision}.`,
      },
    ],
  });
  if (applied) revalidateCase(caseId);
}
