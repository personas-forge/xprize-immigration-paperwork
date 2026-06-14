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

/** Read a free-text form field from untrusted FormData: coerce to string, trim,
 *  and cap length. The cap lives here so every review-note/feedback field shares it. */
function formField(formData: FormData, name: string, max = 4000): string {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

/** Resolve the caller and require the CONFIGURED-attorney role (fail-closed —
 *  see the module note; NOT `isAttorney`). Returns the user for the privileged
 *  sign-off/filing actions, or null. The single gate those three actions share,
 *  so a future change (rate-limit, audit) lands here once, not in three copies. */
async function requireAttorney(): Promise<Awaited<ReturnType<typeof getUser>>> {
  const user = await getUser();
  if (!user || !isConfiguredAttorney(user.email)) return null;
  return user;
}

/** Run an atomic status transition and revalidate the case views ONLY when it
 *  actually applied — a no-op compare-and-set (stale tab / double-submit) must
 *  not trigger a revalidation. The shared tail of every status-changing action. */
async function applyTransition(
  input: Parameters<typeof transitionCase>[0],
): Promise<void> {
  const applied = await transitionCase(input);
  if (applied) revalidateCase(input.caseId);
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
  await applyTransition({
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
}

/** Owner OR a configured attorney adds a free-form note to the review thread. */
export async function addReviewNote(
  caseId: string,
  formData: FormData,
): Promise<void> {
  const user = await getUser();
  if (!user) return;
  const body = formField(formData, "body");
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
  const user = await requireAttorney();
  if (!user) return;
  const body = formField(formData, "feedback") || "Please revise and resubmit.";
  // Only from Attorney Review — can't bounce an already-Filed case to Drafting.
  await applyTransition({
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
}

/** Attorney signs the petition (e-sign stub) and files it with USCIS (stub),
 *  recording a receipt number and advancing the case to "Filed". */
export async function attorneySignAndFile(caseId: string): Promise<void> {
  const user = await requireAttorney();
  if (!user) return;
  const receipt = newReceiptNumber();
  // Compare-and-set from Attorney Review → a second (double-click / stale tab)
  // call finds status already Filed, does NOT apply, and mints no second receipt.
  await applyTransition({
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
}

/** Attorney records the USCIS decision once it comes back. */
export async function attorneyRecordDecision(
  caseId: string,
  formData: FormData,
): Promise<void> {
  const user = await requireAttorney();
  if (!user) return;
  const decision = String(formData.get("decision") ?? "Approved");
  // Server-side allowlist: the ReviewPanel <select> only offers these three, but
  // a crafted POST could otherwise write an arbitrary string into the append-only
  // review log (and only "Approved" is terminal). Reject anything else.
  if (!["Approved", "RFE issued", "Denied"].includes(decision)) return;
  // Only a Filed case can receive a decision. "Approved" is terminal; any other
  // decision keeps the case "Filed" (the decision is recorded in the thread).
  await applyTransition({
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
}
