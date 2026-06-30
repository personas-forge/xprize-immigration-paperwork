"use client";

import { useState } from "react";
import { Badge, Button, Card, CardBody, CardHeader, type BadgeTone } from "@/components/ui";
import { SubmitButton } from "./SubmitButton";
import { ReviewActionForm } from "./ReviewActionForm";
import {
  addReviewNote,
  attorneyRecordDecision,
  attorneyRequestChanges,
  attorneySignAndFile,
  submitForReview,
} from "../actions";
import { USCIS_DECISIONS } from "../decisions";
import { caseStatusTone } from "@/features/case-file/caseStatusTone";

// — Review & filing panel ─────────────────────────────────────────────────────
// The attorney-review thread plus the role-appropriate workflow actions, driven
// by the case status. Applicant submits a drafted case; the attorney of record
// requests changes, signs & files (e-sign / USCIS filing are recorded stubs),
// and records the decision. Every action is a server action; the thread is the
// audit trail.

export interface ReviewEventView {
  id: string;
  authorRole: string;
  kind: string;
  body: string;
  when: string;
  /** Authoritative demo-vs-genuine flag for a `filed` event, taken from the
   *  stored `metadata.demo` boolean — threaded through instead of re-detected
   *  from the body prose (which an edit/i18n change could silently flip). */
  demo: boolean;
}

const KIND_LABEL: Record<string, string> = {
  submitted: "Submitted for review",
  changes_requested: "Changes requested",
  signed: "Signed by attorney",
  filed: "Filed with USCIS",
  decision: "Decision recorded",
  note: "Note",
};

const KIND_TONE: Record<string, BadgeTone> = {
  submitted: "accent",
  changes_requested: "warning",
  signed: "accent",
  filed: "success",
  decision: "success",
  note: "neutral",
};

export function ReviewPanel({
  caseId,
  status,
  receiptNumber,
  isAttorney,
  isOwner,
  hasDraft,
  events,
}: {
  caseId: string;
  status: string;
  receiptNumber: string | null;
  isAttorney: boolean;
  isOwner: boolean;
  hasDraft: boolean;
  events: readonly ReviewEventView[];
}) {
  const inDrafting = status === "Intake" || status === "Drafting";
  const inReview = status === "Attorney Review";
  const filed = status === "Filed";
  const approved = status === "Approved";
  // A receipt recorded WITHOUT a real USCIS filing integration is a demo receipt.
  // Read the authoritative `demo` flag the filed event persisted — never re-derive
  // it from the body prose, which an i18n/reword could flip to "genuine".
  const receiptIsDemo = events.some((ev) => ev.kind === "filed" && ev.demo);

  return (
    <Card>
      <CardHeader>
        <div className="microprint" style={{ color: "var(--accent-dark)" }}>
          § IV — Attorney review &amp; filing
        </div>
        <Badge tone={caseStatusTone(status)}>{status}</Badge>
      </CardHeader>
      <CardBody className="space-y-5">
        {receiptNumber ? (
          <div
            className={
              receiptIsDemo
                ? "rounded-control border border-warning/50 bg-warning-soft/40 px-4 py-3"
                : "rounded-control border border-success/40 bg-success-soft/40 px-4 py-3"
            }
          >
            <div className="flex items-center justify-between">
              <span className="microprint" style={{ color: "var(--accent-dark)" }}>
                {receiptIsDemo ? "Demo receipt" : "USCIS receipt"}
              </span>
              <span className="doc-number text-[16px] text-foreground">{receiptNumber}</span>
            </div>
            {receiptIsDemo ? (
              <p className="mt-1.5 font-sans text-[13.5px] leading-snug text-warning">
                Not a genuine USCIS receipt — this case was recorded as filed for
                demonstration; no petition was submitted to USCIS.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* — Action zone, by status ─────────────────────────────────────── */}
        {approved ? (
          <div className="rounded-control border-2 border-double border-success/50 bg-success-soft/40 px-5 py-4">
            <div className="microprint" style={{ color: "var(--accent-dark)" }}>
              Outcome
            </div>
            <p className="mt-1 font-sans text-[16px] text-foreground-soft">
              This petition has been approved. 🎉
            </p>
          </div>
        ) : null}

        {inDrafting && isOwner ? (
          <ReviewActionForm action={submitForReview.bind(null, caseId)} className="space-y-2">
            <SubmitButton variant="seal" pendingLabel="Submitting…">
              Submit for attorney review
            </SubmitButton>
            <p className="microprint" style={{ color: "var(--muted)" }}>
              {hasDraft
                ? "Sends your drafted petition to the attorney of record."
                : "Tip: generate a petition draft above before submitting."}
            </p>
          </ReviewActionForm>
        ) : null}

        {inReview && !isAttorney ? (
          <div className="rounded-control border border-accent/30 bg-accent-soft/30 px-5 py-4">
            <p className="font-sans text-[16px] text-foreground-soft">
              Awaiting attorney review. You&apos;ll see feedback or a filing
              confirmation here.
            </p>
          </div>
        ) : null}

        {inReview && isAttorney ? (
          <div className="space-y-4 rounded-control border border-seal/30 bg-seal-soft/20 px-5 py-4">
            <div className="microprint" style={{ color: "var(--seal)" }}>
              Attorney of record · console
            </div>
            <SignAndFileAction caseId={caseId} />
            <ReviewActionForm action={attorneyRequestChanges.bind(null, caseId)} className="space-y-2">
              <textarea
                name="feedback"
                rows={3}
                placeholder="Required changes for the applicant…"
                className="w-full resize-y rounded-control border border-border-strong bg-surface px-3 py-2 font-sans text-[15.5px] leading-relaxed text-foreground placeholder:text-muted focus-ring"
              />
              <SubmitButton variant="secondary" pendingLabel="Returning…">
                Return with changes
              </SubmitButton>
            </ReviewActionForm>
          </div>
        ) : null}

        {filed && isAttorney ? (
          <ReviewActionForm
            action={attorneyRecordDecision.bind(null, caseId)}
            className="flex flex-wrap items-end gap-3 rounded-control border border-seal/30 bg-seal-soft/20 px-5 py-4"
          >
            <label className="block">
              <span className="microprint">USCIS decision</span>
              <select
                name="decision"
                className="mt-1.5 rounded-control border border-border-strong bg-surface px-3 py-2 font-sans text-[16px] text-foreground focus-ring"
              >
                {USCIS_DECISIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <SubmitButton variant="secondary" pendingLabel="Recording…">
              Record decision
            </SubmitButton>
          </ReviewActionForm>
        ) : null}

        {/* — Review thread ──────────────────────────────────────────────── */}
        <div>
          <div className="microprint mb-2" style={{ color: "var(--accent-dark)" }}>
            Review thread
          </div>
          {events.length === 0 ? (
            <p className="font-sans text-[15.5px] italic text-muted-strong">
              No activity yet.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {events.map((ev) => (
                <li
                  key={ev.id}
                  className="border-b border-dotted border-rule pb-2.5 last:border-b-0"
                >
                  <div className="flex items-center gap-2">
                    <Badge tone={KIND_TONE[ev.kind] ?? "neutral"}>
                      {KIND_LABEL[ev.kind] ?? ev.kind}
                    </Badge>
                    <span className="microprint" style={{ color: "var(--muted)" }}>
                      {ev.authorRole} · {ev.when}
                    </span>
                  </div>
                  {ev.body ? (
                    <p className="mt-1.5 font-sans text-[15.5px] leading-relaxed text-foreground-soft">
                      {ev.body}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* — Add note (owner or attorney) ───────────────────────────────── */}
        {isOwner || isAttorney ? (
          <ReviewActionForm action={addReviewNote.bind(null, caseId)} className="space-y-2">
            <textarea
              name="body"
              rows={2}
              placeholder="Add a note to the thread…"
              className="w-full resize-y rounded-control border border-border-strong bg-surface px-3 py-2 font-sans text-[15.5px] leading-relaxed text-foreground placeholder:text-muted focus-ring"
            />
            <SubmitButton variant="ghost" size="sm" pendingLabel="Adding…">
              Add note
            </SubmitButton>
          </ReviewActionForm>
        ) : null}
      </CardBody>
    </Card>
  );
}

/**
 * Sign & file — the single most consequential action under the attorney's bar
 * license, so it is deliberately a TWO-STEP gesture: the first click reveals a
 * statement of effect (what it signs, what it files, where the case moves) and a
 * Confirm before the server action runs. No bare one-click submit, no surprise.
 */
function SignAndFileAction({ caseId }: { caseId: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className="space-y-2">
        <Button type="button" variant="seal" onClick={() => setConfirming(true)}>
          Sign &amp; file with USCIS
        </Button>
        <p className="microprint" style={{ color: "var(--muted)" }}>
          Signs the petition under your name and files it with USCIS — you&apos;ll
          confirm first.
        </p>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Confirm sign and file"
      className="space-y-3 rounded-control border-2 border-double border-seal/50 bg-seal-soft/40 px-4 py-3"
    >
      <div className="microprint" style={{ color: "var(--seal)" }}>
        Confirm — attorney of record
      </div>
      <p className="font-sans text-[15.5px] leading-snug text-foreground-soft">
        You are about to <strong>sign this petition under your name and file it
        with USCIS</strong>. The case moves to <strong>Filed</strong> and receives
        a receipt number. Confirm only after you have reviewed the full draft and
        exhibits — this is your attorney-of-record action.
      </p>
      <ReviewActionForm action={attorneySignAndFile.bind(null, caseId)} className="space-y-3">
        <label className="block">
          <span className="microprint">USCIS receipt number (optional)</span>
          <input
            name="receiptNumber"
            type="text"
            inputMode="text"
            placeholder="e.g. EAC2412345678 — leave blank to record a demo receipt"
            className="mt-1.5 w-full rounded-control border border-border-strong bg-surface px-3 py-2 font-mono text-[15px] tracking-document text-foreground placeholder:text-muted focus-ring"
          />
          <span className="microprint mt-1 block" style={{ color: "var(--muted)" }}>
            Real USCIS filing isn&apos;t wired yet — enter the actual receipt if you
            filed outside the app, or leave blank for a clearly-labelled demo.
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton variant="seal" pendingLabel="Recording filing…">
            Confirm — sign &amp; file
          </SubmitButton>
          <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      </ReviewActionForm>
    </div>
  );
}
