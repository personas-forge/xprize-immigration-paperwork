/**
 * The persistence boundary. Auth (`@/lib/auth/db`), the token ledger
 * (`@/lib/tokens/ledger`), and the domain data layer (`@/lib/data/*`) talk ONLY
 * to this `Store` interface; the concrete driver (Firestore in prod, PGlite
 * locally) is chosen by `@/lib/db/config` and loaded lazily here so neither
 * module enters the bundle unless it's used.
 *
 * To add a backend, implement `Store` and wire it into `getStore()` — no
 * call-site changes. To add per-app DOMAIN data, extend this interface with new
 * methods and implement them in both firestore-store.ts and pglite-store.ts.
 */

import { dbDriver } from "./config";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  onboarded_at: string | null;
}

export interface UpsertConsentInput {
  userId: string;
  email: string | null;
  fullName: string;
  avatarUrl: string | null;
  consentVersion: string;
  terms: boolean;
  privacy: boolean;
  marketing: boolean;
  ip: string | null;
  userAgent: string | null;
}

export type CreditReason =
  | "purchase"
  | "reclaim"
  | "refund"
  | "adjustment"
  | "enterprise_grant";

export interface ChargeOutcome {
  ok: boolean;
  balance: number;
}

// ── Domain: immigration petition pipeline ────────────────────────────────────

/** A criterion row to persist alongside a case (denormalized in Firestore). */
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

export interface StoredCriterion {
  id: string;
  name: string;
  status: string;
  evidence: string;
  rationale: string;
  exhibit: string;
}

export interface CreateCaseInput {
  userId: string;
  fileNumber: string;
  petitioner: string;
  classification: string;
  approvalLikelihood: number;
  criteria: readonly CriterionInput[];
}

export interface DraftSection {
  heading: string;
  body: string;
}

export interface StoredDraft {
  version: number;
  sections: DraftSection[];
  source: string;
}

export interface StoredRfe {
  version: number;
  rfeText: string;
  sections: DraftSection[];
  source: string;
}

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

export interface AddReviewEventInput {
  caseId: string;
  authorId: string | null;
  authorRole: "applicant" | "attorney";
  kind: ReviewKind;
  body?: string;
  metadata?: Record<string, unknown>;
}

/** A review event appended atomically as part of a guarded status transition. */
export interface TransitionEvent {
  authorId: string | null;
  authorRole: "applicant" | "attorney";
  kind: ReviewKind;
  body?: string;
  metadata?: Record<string, unknown>;
}

/** A compare-and-set case-status transition that also appends review events,
 *  all as one atomic unit (see Store.transitionCase). */
export interface TransitionCaseInput {
  caseId: string;
  /** Allowed current statuses — the transition only applies if status is one. */
  fromStatuses: readonly string[];
  toStatus: string;
  receiptNumber?: string;
  events: readonly TransitionEvent[];
}

export interface StoredDocument {
  id: string;
  name: string;
  criterion: string;
  exhibit: string;
  status: string;
  facts: string[];
  source: string;
}

export interface AddDocumentInput {
  caseId: string;
  name: string;
  criterion: string;
  facts: readonly string[];
  source: string;
  status?: string;
}

export interface Store {
  getProfile(userId: string): Promise<Profile | null>;
  upsertProfileWithConsent(input: UpsertConsentInput): Promise<void>;
  getBalance(userId: string): Promise<number>;
  /** Atomic debit. Refuses (ok:false) when the balance is insufficient. */
  charge(
    userId: string,
    cost: number,
    operation: string,
    ref: string,
  ): Promise<ChargeOutcome>;
  /** Idempotent credit (de-duped by ref+reason). Returns the new balance. */
  credit(
    userId: string,
    amount: number,
    reason: CreditReason,
    ref: string | null,
    metadata: Record<string, unknown>,
  ): Promise<number>;
  /** One-time signup grant, idempotent per user. */
  grantSignupTokens(userId: string, amount: number): Promise<void>;

  // ── Domain: cases + criteria ──────────────────────────────────────────────
  /** Persist a new case + its scored criteria (atomic single write). */
  createCaseWithCriteria(input: CreateCaseInput): Promise<CreatedCase>;
  /** Every case the user owns, newest first. */
  getCasesForUser(userId: string): Promise<StoredCase[]>;
  /** A single case scoped to its owner, or null. */
  getCaseForUser(userId: string, caseId: string): Promise<StoredCase | null>;
  /** A single case by id regardless of owner (attorney path), or null. */
  getCaseAnyOwner(caseId: string): Promise<StoredCase | null>;
  /** All cases awaiting attorney review. */
  getCasesInReview(): Promise<StoredCase[]>;
  /** The scored criteria for a case, in canonical order. */
  getCriteriaForCase(caseId: string): Promise<StoredCriterion[]>;
  /** Advance a case's lifecycle status, optionally recording the receipt. */
  setCaseStatus(
    caseId: string,
    status: string,
    receiptNumber?: string,
  ): Promise<void>;
  /**
   * Atomically advance a case's status AND append review events, but ONLY when
   * the current status is one of `fromStatuses` (compare-and-set). Returns true
   * if the transition applied, false if the precondition was not met (or the
   * case is gone). Prevents double-submits / illegal transitions and keeps the
   * append-only review log in sync with case status.
   */
  transitionCase(input: TransitionCaseInput): Promise<boolean>;

  // ── Domain: petition drafts (versioned) ───────────────────────────────────
  /** Persist a draft as a NEW version + advance Intake→Drafting. Returns version. */
  saveDraft(
    caseId: string,
    sections: readonly DraftSection[],
    source: string,
  ): Promise<number>;
  /** The latest draft version for a case, or null. */
  getLatestDraft(caseId: string): Promise<StoredDraft | null>;

  // ── Domain: RFE responses (versioned) ─────────────────────────────────────
  /** Persist an RFE response as a NEW version. Returns the new version. */
  saveRfeResponse(
    caseId: string,
    rfeText: string,
    sections: readonly DraftSection[],
    source: string,
  ): Promise<number>;
  /** The latest RFE response for a case, or null. */
  getLatestRfeResponse(caseId: string): Promise<StoredRfe | null>;

  // ── Domain: attorney review thread (append-only) ──────────────────────────
  /** Append one event to a case's review thread. */
  addReviewEvent(input: AddReviewEventInput): Promise<void>;
  /** The review thread for a case, oldest first. */
  getReviewEvents(caseId: string): Promise<ReviewEvent[]>;

  // ── Domain: evidence vault ────────────────────────────────────────────────
  /** Add a document to a case's vault, assigning the next exhibit number. */
  addCaseDocument(input: AddDocumentInput): Promise<StoredDocument>;
  /** Every document in a case's vault, by exhibit order. */
  getCaseDocuments(caseId: string): Promise<StoredDocument[]>;
  /** Remove a document from a case's vault. */
  removeCaseDocument(caseId: string, documentId: string): Promise<void>;
  /** Re-file a document under a different criterion bucket. */
  refileCaseDocument(
    caseId: string,
    documentId: string,
    criterion: string,
  ): Promise<void>;
}

let cached: Store | null | undefined;

/** Resolve the active store, lazily importing only the chosen driver. */
export async function getStore(): Promise<Store | null> {
  if (cached !== undefined) return cached;
  const driver = dbDriver();
  if (driver === "firestore") {
    cached = (await import("./firestore-store")).firestoreStore;
  } else if (driver === "pglite") {
    cached = await (await import("./pglite-store")).getPgliteStore();
  } else {
    cached = null;
  }
  return cached;
}
