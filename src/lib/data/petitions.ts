import "server-only";

/**
 * Data layer — real, user-scoped petition cases.
 *
 * Unlike `cases.ts` (the in-memory demo portfolio the dashboard renders), this
 * module persists cases the user actually creates through the Qualify -> Draft
 * flow. It is the first DB-backed accessor in the app and follows the same
 * graceful-degradation contract as the token ledger: when DATABASE_URL is unset
 * every function no-ops (returns null / empty), so the keyless build still runs
 * and the qualification result is simply not saved.
 */
import { appPool, S } from "@/lib/db/pool";

/** A criterion row to persist. Structural (not imported from the feature) so the
 *  data layer stays decoupled from the qualification module. */
export interface CriterionInput {
  name: string;
  status: string; // Met | Strong | Partial | None — validated in app code
  evidence: string;
  rationale: string;
  exhibit?: string;
}

export interface CreatedCase {
  id: string;
  fileNumber: string;
}

export interface StoredCase {
  id: string;
  fileNumber: string;
  petitioner: string;
  classification: string;
  status: string;
  approvalLikelihood: number;
  receiptNumber: string | null;
}

// Columns selected for a StoredCase. Kept in one place so the owner-scoped,
// attorney-scoped, and in-review queries can't drift apart.
const CASE_COLUMNS =
  "id, file_number, petitioner, classification, status, approval_likelihood, receipt_number";

interface CaseRow {
  id: string;
  file_number: string;
  petitioner: string;
  classification: string;
  status: string;
  approval_likelihood: number;
  receipt_number: string | null;
}

function toStoredCase(row: CaseRow): StoredCase {
  return {
    id: row.id,
    fileNumber: row.file_number,
    petitioner: row.petitioner,
    classification: row.classification,
    status: row.status,
    approvalLikelihood: row.approval_likelihood,
    receiptNumber: row.receipt_number,
  };
}

export interface StoredCriterion {
  id: string;
  name: string;
  status: string;
  evidence: string;
  rationale: string;
  exhibit: string;
}

/** Short human file number, e.g. "O1-4821". Random suffix is fine for a demo;
 *  uniqueness is not load-bearing (the uuid id is the key). */
function newFileNumber(): string {
  return `O1-${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * Persist a qualification assessment as a new case plus its scored criteria, in
 * one transaction. Returns the new case id (so the caller can deep-link to the
 * draft view), or `null` when no database is configured.
 */
export async function createCaseWithCriteria(input: {
  userId: string;
  petitioner: string;
  classification?: string;
  approvalLikelihood: number;
  criteria: readonly CriterionInput[];
}): Promise<CreatedCase | null> {
  const p = appPool();
  if (!p) return null;
  const fileNumber = newFileNumber();
  const c = await p.connect();
  try {
    await c.query("begin");
    const r = await c.query<{ id: string }>(
      `insert into ${S}.cases
         (user_id, file_number, petitioner, classification, status, approval_likelihood)
       values ($1, $2, $3, $4, 'Intake', $5)
       returning id`,
      [
        input.userId,
        fileNumber,
        input.petitioner,
        input.classification ?? "O-1A",
        Math.round(input.approvalLikelihood),
      ],
    );
    const caseId = r.rows[0].id;
    let ord = 0;
    for (const cr of input.criteria) {
      await c.query(
        `insert into ${S}.criteria
           (case_id, name, status, evidence, rationale, exhibit, ord)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [caseId, cr.name, cr.status, cr.evidence, cr.rationale, cr.exhibit ?? "", ord++],
      );
    }
    await c.query("commit");
    return { id: caseId, fileNumber };
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}

/** Every case the user owns, newest first. Empty when no DB. */
export async function getCasesForUser(
  userId: string,
): Promise<readonly StoredCase[]> {
  const p = appPool();
  if (!p) return [];
  const r = await p.query<CaseRow>(
    `select ${CASE_COLUMNS}
       from ${S}.cases
      where user_id = $1
      order by created_at desc
      limit 100`,
    [userId],
  );
  return r.rows.map(toStoredCase);
}

/** A single case scoped to its owner, or `null` (also when no DB / wrong owner). */
export async function getCaseForUser(
  userId: string,
  caseId: string,
): Promise<StoredCase | null> {
  const p = appPool();
  if (!p) return null;
  const r = await p.query<CaseRow>(
    `select ${CASE_COLUMNS} from ${S}.cases where id = $1 and user_id = $2`,
    [caseId, userId],
  );
  return r.rows[0] ? toStoredCase(r.rows[0]) : null;
}

/**
 * A single case by id REGARDLESS of owner — for the attorney of record, who
 * does not own the petitioner's case. Callers MUST gate this behind an attorney
 * role check (see `isAttorney`); the owner-scoped `getCaseForUser` is the
 * default. Returns `null` when no DB or the case doesn't exist.
 */
export async function getCaseAnyOwner(caseId: string): Promise<StoredCase | null> {
  const p = appPool();
  if (!p) return null;
  const r = await p.query<CaseRow>(
    `select ${CASE_COLUMNS} from ${S}.cases where id = $1`,
    [caseId],
  );
  return r.rows[0] ? toStoredCase(r.rows[0]) : null;
}

/** All cases awaiting attorney review (the review queue). Attorney-gated. */
export async function getCasesInReview(): Promise<readonly StoredCase[]> {
  const p = appPool();
  if (!p) return [];
  const r = await p.query<CaseRow>(
    `select ${CASE_COLUMNS}
       from ${S}.cases
      where status = 'Attorney Review'
      order by created_at asc
      limit 200`,
  );
  return r.rows.map(toStoredCase);
}

/** The scored criteria for a case, in canonical order. Empty when no DB. */
export async function getCriteriaForCase(
  caseId: string,
): Promise<readonly StoredCriterion[]> {
  const p = appPool();
  if (!p) return [];
  const r = await p.query<{
    id: string;
    name: string;
    status: string;
    evidence: string;
    rationale: string;
    exhibit: string;
  }>(
    `select id, name, status, evidence, rationale, exhibit
       from ${S}.criteria
      where case_id = $1
      order by ord asc`,
    [caseId],
  );
  return r.rows;
}

export interface DraftSectionRow {
  heading: string;
  body: string;
}

export interface StoredDraft {
  version: number;
  sections: DraftSectionRow[];
  source: string;
}

/**
 * Persist a petition draft as a NEW version (never overwrites prior text), so a
 * regenerate is non-destructive. Returns the new version number, or `null` when
 * no database is configured. Caller is responsible for case ownership.
 */
export async function saveDraft(
  caseId: string,
  sections: readonly DraftSectionRow[],
  source: string,
): Promise<number | null> {
  const p = appPool();
  if (!p) return null;
  const c = await p.connect();
  try {
    await c.query("begin");
    const v = await c.query<{ next: number }>(
      `select coalesce(max(version), 0) + 1 as next
         from ${S}.petition_drafts where case_id = $1`,
      [caseId],
    );
    const version = v.rows[0]?.next ?? 1;
    await c.query(
      `insert into ${S}.petition_drafts (case_id, version, sections, source)
       values ($1, $2, $3, $4)`,
      [caseId, version, JSON.stringify(sections), source],
    );
    // Advancing past Intake — a draft now exists for this case.
    await c.query(
      `update ${S}.cases set status = 'Drafting', updated_at = now()
        where id = $1 and status = 'Intake'`,
      [caseId],
    );
    await c.query("commit");
    return version;
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}

/** The latest draft version for a case, or `null` (also when no DB / none yet).
 *  `sections` is stored as jsonb and returned already parsed by node-pg. */
export async function getLatestDraft(caseId: string): Promise<StoredDraft | null> {
  const p = appPool();
  if (!p) return null;
  const r = await p.query<{
    version: number;
    sections: DraftSectionRow[];
    source: string;
  }>(
    `select version, sections, source
       from ${S}.petition_drafts
      where case_id = $1
      order by version desc
      limit 1`,
    [caseId],
  );
  return r.rows[0] ?? null;
}

export interface StoredRfe {
  version: number;
  rfeText: string;
  sections: DraftSectionRow[];
  source: string;
}

/** Persist an RFE response as a NEW version (non-destructive). Returns the new
 *  version number, or `null` when no DB. */
export async function saveRfeResponse(
  caseId: string,
  rfeText: string,
  sections: readonly DraftSectionRow[],
  source: string,
): Promise<number | null> {
  const p = appPool();
  if (!p) return null;
  const c = await p.connect();
  try {
    await c.query("begin");
    const v = await c.query<{ next: number }>(
      `select coalesce(max(version), 0) + 1 as next
         from ${S}.rfe_responses where case_id = $1`,
      [caseId],
    );
    const version = v.rows[0]?.next ?? 1;
    await c.query(
      `insert into ${S}.rfe_responses (case_id, version, rfe_text, sections, source)
       values ($1, $2, $3, $4, $5)`,
      [caseId, version, rfeText, JSON.stringify(sections), source],
    );
    await c.query("commit");
    return version;
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}

/** The latest RFE response for a case, or `null` (also when no DB / none yet). */
export async function getLatestRfeResponse(
  caseId: string,
): Promise<StoredRfe | null> {
  const p = appPool();
  if (!p) return null;
  const r = await p.query<{
    version: number;
    rfe_text: string;
    sections: DraftSectionRow[];
    source: string;
  }>(
    `select version, rfe_text, sections, source
       from ${S}.rfe_responses
      where case_id = $1
      order by version desc
      limit 1`,
    [caseId],
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    version: row.version,
    rfeText: row.rfe_text,
    sections: row.sections,
    source: row.source,
  };
}
