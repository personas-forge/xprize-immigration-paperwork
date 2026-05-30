"use client";

import { Badge, Button, Card, CardBody, CardHeader, type BadgeTone } from "@/components/ui";
import {
  addReviewNote,
  attorneyRecordDecision,
  attorneyRequestChanges,
  attorneySignAndFile,
  submitForReview,
} from "../actions";

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

function statusTone(status: string): BadgeTone {
  if (status === "Approved" || status === "Filed") return "success";
  if (status === "Attorney Review") return "accent";
  return "neutral";
}

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

  return (
    <Card>
      <CardHeader>
        <div className="microprint" style={{ color: "var(--accent-dark)" }}>
          § IV — Attorney review &amp; filing
        </div>
        <Badge tone={statusTone(status)}>{status}</Badge>
      </CardHeader>
      <CardBody className="space-y-5">
        {receiptNumber ? (
          <div className="flex items-center justify-between rounded-control border border-success/40 bg-success-soft/40 px-4 py-3">
            <span className="microprint" style={{ color: "var(--accent-dark)" }}>
              USCIS receipt
            </span>
            <span className="doc-number text-[14px] text-foreground">{receiptNumber}</span>
          </div>
        ) : null}

        {/* — Action zone, by status ─────────────────────────────────────── */}
        {approved ? (
          <div className="rounded-control border-2 border-double border-success/50 bg-success-soft/40 px-5 py-4">
            <div className="microprint" style={{ color: "var(--accent-dark)" }}>
              Outcome
            </div>
            <p className="mt-1 font-sans text-[14px] text-foreground-soft">
              This petition has been approved. 🎉
            </p>
          </div>
        ) : null}

        {inDrafting && isOwner ? (
          <form action={submitForReview.bind(null, caseId)} className="space-y-2">
            <Button type="submit" variant="seal">
              Submit for attorney review
            </Button>
            <p className="microprint" style={{ color: "var(--muted)" }}>
              {hasDraft
                ? "Sends your drafted petition to the attorney of record."
                : "Tip: generate a petition draft above before submitting."}
            </p>
          </form>
        ) : null}

        {inReview && !isAttorney ? (
          <div className="rounded-control border border-accent/30 bg-accent-soft/30 px-5 py-4">
            <p className="font-sans text-[14px] text-foreground-soft">
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
            <form action={attorneySignAndFile.bind(null, caseId)}>
              <Button type="submit" variant="seal">
                Sign &amp; file with USCIS
              </Button>
            </form>
            <form action={attorneyRequestChanges.bind(null, caseId)} className="space-y-2">
              <textarea
                name="feedback"
                rows={3}
                placeholder="Required changes for the applicant…"
                className="w-full resize-y rounded-control border border-border-strong bg-surface px-3 py-2 font-sans text-[13.5px] leading-relaxed text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
              />
              <Button type="submit" variant="secondary">
                Return with changes
              </Button>
            </form>
          </div>
        ) : null}

        {filed && isAttorney ? (
          <form
            action={attorneyRecordDecision.bind(null, caseId)}
            className="flex flex-wrap items-end gap-3 rounded-control border border-seal/30 bg-seal-soft/20 px-5 py-4"
          >
            <label className="block">
              <span className="microprint">USCIS decision</span>
              <select
                name="decision"
                className="mt-1.5 rounded-control border border-border-strong bg-surface px-3 py-2 font-sans text-[14px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
              >
                <option value="Approved">Approved</option>
                <option value="RFE issued">RFE issued</option>
                <option value="Denied">Denied</option>
              </select>
            </label>
            <Button type="submit" variant="secondary">
              Record decision
            </Button>
          </form>
        ) : null}

        {/* — Review thread ──────────────────────────────────────────────── */}
        <div>
          <div className="microprint mb-2" style={{ color: "var(--accent-dark)" }}>
            Review thread
          </div>
          {events.length === 0 ? (
            <p className="font-sans text-[13.5px] italic text-muted-strong">
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
                    <p className="mt-1.5 font-sans text-[13.5px] leading-relaxed text-foreground-soft">
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
          <form action={addReviewNote.bind(null, caseId)} className="space-y-2">
            <textarea
              name="body"
              rows={2}
              placeholder="Add a note to the thread…"
              className="w-full resize-y rounded-control border border-border-strong bg-surface px-3 py-2 font-sans text-[13.5px] leading-relaxed text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
            />
            <Button type="submit" variant="ghost" size="sm">
              Add note
            </Button>
          </form>
        ) : null}
      </CardBody>
    </Card>
  );
}
