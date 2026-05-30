import "server-only";

/**
 * Data layer — the attorney-review thread and case status transitions.
 *
 * `case_reviews` is an append-only log of workflow events (submitted, changes
 * requested, signed, filed, decision) and free-form notes; `setCaseStatus`
 * advances the case lifecycle. Same graceful-degradation contract as the rest
 * of the data layer: every function no-ops when DATABASE_URL is unset.
 *
 * These functions do NOT enforce who may call them — the server actions in
 * `features/review/actions.ts` apply the ownership / attorney-role gates.
 */
import { appPool, S } from "@/lib/db/pool";

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

/** Append one event to a case's review thread. No-op when no DB. */
export async function addReviewEvent(input: {
  caseId: string;
  authorId: string | null;
  authorRole: "applicant" | "attorney";
  kind: ReviewKind;
  body?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const p = appPool();
  if (!p) return;
  await p.query(
    `insert into ${S}.case_reviews
       (case_id, author_id, author_role, kind, body, metadata)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      input.caseId,
      input.authorId,
      input.authorRole,
      input.kind,
      input.body ?? "",
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}

/** The review thread for a case, oldest first. Empty when no DB. */
export async function getReviewEvents(
  caseId: string,
): Promise<readonly ReviewEvent[]> {
  const p = appPool();
  if (!p) return [];
  const r = await p.query<{
    id: string;
    author_role: string;
    kind: ReviewKind;
    body: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }>(
    `select id, author_role, kind, body, metadata, created_at
       from ${S}.case_reviews
      where case_id = $1
      order by created_at asc`,
    [caseId],
  );
  return r.rows.map((row) => ({
    id: row.id,
    authorRole: row.author_role,
    kind: row.kind,
    body: row.body,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }));
}

/**
 * Advance a case's lifecycle status, optionally recording the USCIS receipt
 * number (set when the attorney signs and files). No-op when no DB.
 */
export async function setCaseStatus(
  caseId: string,
  status: string,
  opts: { receiptNumber?: string } = {},
): Promise<void> {
  const p = appPool();
  if (!p) return;
  if (opts.receiptNumber !== undefined) {
    await p.query(
      `update ${S}.cases
          set status = $2, receipt_number = $3, updated_at = now()
        where id = $1`,
      [caseId, status, opts.receiptNumber],
    );
  } else {
    await p.query(
      `update ${S}.cases set status = $2, updated_at = now() where id = $1`,
      [caseId, status],
    );
  }
}
