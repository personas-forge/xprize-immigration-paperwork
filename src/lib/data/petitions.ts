import "server-only";

/**
 * Data layer — real, user-scoped petition cases.
 *
 * Unlike `cases.ts` (the in-memory demo portfolio the dashboard renders), this
 * module persists cases the user actually creates through the Qualify -> Draft
 * flow. It delegates to the unified `Store` (Firestore in prod, PGlite locally
 * — see @/lib/db/store) and follows the same graceful-degradation contract as
 * the token ledger: when no store is configured every function no-ops (returns
 * null / empty), so the keyless build still runs and the result is simply not
 * saved.
 */
import { getStore } from "@/lib/db/store";

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
  /** ISO timestamp of case creation — exposed as queue age proxy. */
  createdAt: string | null;
}

export interface StoredCriterion {
  id: string;
  name: string;
  status: string;
  evidence: string;
  rationale: string;
  exhibit: string;
}

/** Prefix the file number by classification so a non-O-1 case doesn't read
 *  "O1-…" (UAT 2026-06-20 F6): O-1A/O-1B → "O1", EB-1A → "EB1", UK → "GT". */
function filePrefix(classification: string): string {
  if (classification.startsWith("EB-1A")) return "EB1";
  if (classification.startsWith("UK")) return "GT";
  return "O1"; // O-1A / O-1B
}

/** Short human file number, e.g. "O1-4821" / "EB1-7233". Random suffix is fine
 *  for a demo; uniqueness is not load-bearing (the case id is the key). */
function newFileNumber(classification: string): string {
  return `${filePrefix(classification)}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * Persist a qualification assessment as a new case plus its scored criteria, in
 * one atomic write. Returns the new case id (so the caller can deep-link to the
 * draft view), or `null` when no store is configured.
 */
export async function createCaseWithCriteria(input: {
  userId: string;
  petitioner: string;
  classification?: string;
  approvalLikelihood: number;
  criteria: readonly CriterionInput[];
}): Promise<CreatedCase | null> {
  const store = await getStore();
  if (!store) return null;
  return store.createCaseWithCriteria({
    userId: input.userId,
    fileNumber: newFileNumber(input.classification ?? "O-1A"),
    petitioner: input.petitioner,
    classification: input.classification ?? "O-1A",
    approvalLikelihood: input.approvalLikelihood,
    criteria: input.criteria,
  });
}

/** Every case the user owns, newest first. Empty when no store. */
export async function getCasesForUser(
  userId: string,
): Promise<readonly StoredCase[]> {
  const store = await getStore();
  if (!store) return [];
  return store.getCasesForUser(userId);
}

/** A single case scoped to its owner, or `null` (also when no store / wrong owner). */
export async function getCaseForUser(
  userId: string,
  caseId: string,
): Promise<StoredCase | null> {
  const store = await getStore();
  if (!store) return null;
  return store.getCaseForUser(userId, caseId);
}

/**
 * A single case by id REGARDLESS of owner — for the attorney of record, who
 * does not own the petitioner's case. Callers MUST gate this behind an attorney
 * role check (see `isAttorney`); the owner-scoped `getCaseForUser` is the
 * default. Returns `null` when no store or the case doesn't exist.
 */
export async function getCaseAnyOwner(caseId: string): Promise<StoredCase | null> {
  const store = await getStore();
  if (!store) return null;
  return store.getCaseAnyOwner(caseId);
}

/** All cases awaiting attorney review (the review queue). Attorney-gated. */
export async function getCasesInReview(): Promise<readonly StoredCase[]> {
  const store = await getStore();
  if (!store) return [];
  return store.getCasesInReview();
}

/** The scored criteria for a case, in canonical order. Empty when no store. */
export async function getCriteriaForCase(
  caseId: string,
): Promise<readonly StoredCriterion[]> {
  const store = await getStore();
  if (!store) return [];
  return store.getCriteriaForCase(caseId);
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
 * no store is configured. Caller is responsible for case ownership.
 */
export async function saveDraft(
  caseId: string,
  sections: readonly DraftSectionRow[],
  source: string,
): Promise<number | null> {
  const store = await getStore();
  if (!store) return null;
  return store.saveDraft(caseId, sections, source);
}

/** The latest draft version for a case, or `null` (also when no store / none yet). */
export async function getLatestDraft(caseId: string): Promise<StoredDraft | null> {
  const store = await getStore();
  if (!store) return null;
  return store.getLatestDraft(caseId);
}

export interface StoredRfe {
  version: number;
  rfeText: string;
  sections: DraftSectionRow[];
  source: string;
}

/** Persist an RFE response as a NEW version (non-destructive). Returns the new
 *  version number, or `null` when no store. */
export async function saveRfeResponse(
  caseId: string,
  rfeText: string,
  sections: readonly DraftSectionRow[],
  source: string,
): Promise<number | null> {
  const store = await getStore();
  if (!store) return null;
  return store.saveRfeResponse(caseId, rfeText, sections, source);
}

/** The latest RFE response for a case, or `null` (also when no store / none yet). */
export async function getLatestRfeResponse(
  caseId: string,
): Promise<StoredRfe | null> {
  const store = await getStore();
  if (!store) return null;
  return store.getLatestRfeResponse(caseId);
}
