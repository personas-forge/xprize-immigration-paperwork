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

/** Result every review action returns so the form (via useActionState) can show
 *  a visible error instead of silently doing nothing — on a legal filing flow a
 *  swallowed action must never look identical to success. */
export interface ReviewActionState {
  ok: boolean;
  error?: string;
}
const OK: ReviewActionState = { ok: true };
const fail = (error: string): ReviewActionState => ({ ok: false, error });

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

/** Run an atomic status transition and revalidate ONLY when it actually applied.
 *  Returns a visible result: applied → ok; a no-op compare-and-set (stale tab /
 *  already-moved / no store) → a "verify" message (we can't distinguish benign
 *  from failed, so we tell the user rather than silently doing nothing); a thrown
 *  store fault → a logged error. The shared tail of every status-changing action. */
async function applyTransition(
  input: Parameters<typeof transitionCase>[0],
): Promise<ReviewActionState> {
  try {
    const applied = await transitionCase(input);
    if (applied) {
      revalidateCase(input.caseId);
      return OK;
    }
    return fail(
      "No change was applied — the case may have already moved, or the service is busy. Refresh to check.",
    );
  } catch (err) {
    console.error("[review] transition failed", { caseId: input.caseId, err });
    return fail("We couldn't complete that action. Please try again in a moment.");
  }
}

/** Applicant submits a drafted case to the attorney of record for review.
 *  Signature matches useActionState (caseId is bound at the call site). */
export async function submitForReview(
  caseId: string,
  _prev: ReviewActionState,
  _formData: FormData,
): Promise<ReviewActionState> {
  const user = await getUser();
  if (!user) return fail("Sign in to submit your case.");
  // Owner-only gate via the PetitionAdapter (ADR-0010). `email` is omitted so the
  // adapter's single resolveCase resolves owner-only (the configured-attorney
  // cross-tenant fallback never fires) — preserving the prior owner-only
  // `getCaseForUser` semantics while the adapter owns null/store-error handling.
  const gate = await petitions.resolveCase({ userId: user.id, email: null }, caseId);
  if (!gate.ok) return fail("Only the case owner can submit it for review.");
  return applyTransition({
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
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const user = await getUser();
  if (!user) return fail("Sign in to add a note.");
  const body = formField(formData, "body");
  if (!body) return fail("Enter a note before submitting.");
  // Owner-or-attorney gate. Owner resolves through the adapter (email omitted ⇒
  // owner-only, fail-closed). `owned` also drives the author-role attribution.
  const owned = (await petitions.resolveCase({ userId: user.id, email: null }, caseId)).ok;
  if (!owned) {
    if (!isConfiguredAttorney(user.email)) {
      return fail("You don't have access to this case.");
    }
    // Attorney branch: RESOLVE the case (email leg) before appending so a note
    // can't be written against a non-existent / garbage caseId, which would
    // append an orphan audit row that desyncs from the real cases.
    const gate = await petitions.resolveCase(
      { userId: user.id, email: user.email ?? null },
      caseId,
    );
    if (!gate.ok) return fail("That case could not be found.");
  }
  try {
    await addReviewEvent({
      caseId,
      authorId: user.id,
      authorRole: owned ? "applicant" : "attorney",
      kind: "note",
      body,
    });
    revalidateCase(caseId);
    return OK;
  } catch (err) {
    console.error("[review] addReviewNote failed", { caseId, err });
    return fail("We couldn't save your note. Please try again.");
  }
}

/** Attorney returns the case to the applicant with required changes. */
export async function attorneyRequestChanges(
  caseId: string,
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const user = await requireAttorney();
  if (!user) return fail("Attorney-of-record access is required.");
  const body = formField(formData, "feedback") || "Please revise and resubmit.";
  // Only from Attorney Review — can't bounce an already-Filed case to Drafting.
  return applyTransition({
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
export async function attorneySignAndFile(
  caseId: string,
  _prev: ReviewActionState,
  _formData: FormData,
): Promise<ReviewActionState> {
  const user = await requireAttorney();
  if (!user) return fail("Attorney-of-record access is required to sign & file.");
  const receipt = newReceiptNumber();
  // Compare-and-set from Attorney Review → a second (double-click / stale tab)
  // call finds status already Filed, does NOT apply, and mints no second receipt.
  return applyTransition({
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
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  const user = await requireAttorney();
  if (!user) return fail("Attorney-of-record access is required.");
  const decision = String(formData.get("decision") ?? "Approved");
  // Server-side allowlist: the ReviewPanel <select> only offers these three, but
  // a crafted POST could otherwise write an arbitrary string into the append-only
  // review log (and only "Approved" is terminal). Reject anything else.
  if (!["Approved", "RFE issued", "Denied"].includes(decision)) {
    return fail("Unrecognized decision.");
  }
  // Only a Filed case can receive a decision. "Approved" is terminal; any other
  // decision keeps the case "Filed" (the decision is recorded in the thread).
  return applyTransition({
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
