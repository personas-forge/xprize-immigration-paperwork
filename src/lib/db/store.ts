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

/** Append-only consent/preference record (no profile mutation) — e.g. a later
 *  marketing opt-in/out, which is recorded as a NEW consent row so the audit
 *  trail of "what they agreed to, and when" is never edited in place. */
export interface RecordConsentInput {
  userId: string;
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

/** One row of a user's token ledger, for the billing activity read-out. */
export interface LedgerEntry {
  /** Signed token movement (debit negative, credit/grant/refund positive). */
  delta: number;
  /** purchase | reclaim | refund | adjustment | enterprise_grant | debit | signup_grant. */
  reason: string;
  /** The metered operation for a debit (e.g. "draft"), else null. */
  operation: string | null;
  /** Running balance after this entry. */
  balanceAfter: number;
  /** ISO timestamp, or null. */
  createdAt: string | null;
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
  /** ISO timestamp of case creation. */
  createdAt: string | null;
  /** ISO timestamp of the last mutation. For a case in Attorney Review this is
   *  when it entered the queue (the submit transition), so it — not created_at,
   *  which is wrong for an aged case — is the queue-age clock (UAT 2026-06-20 F3). */
  updatedAt: string | null;
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

// ── GDPR / data-portability bundle ───────────────────────────────────────────

/** One recorded consent event (terms/privacy/marketing), for the data export. */
export interface ConsentExport {
  consentVersion: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  marketingOptIn: boolean;
  ip: string | null;
  userAgent: string | null;
  createdAt: string | null;
}

export interface ExportedDraft extends StoredDraft {
  createdAt: string | null;
}
export interface ExportedRfe extends StoredRfe {
  createdAt: string | null;
}
/** A document in the export — includes SOFT-DELETED exhibits (still the user's
 *  data) with their deletion stamp. */
export interface ExportedDocument extends StoredDocument {
  deletedAt: string | null;
}

export interface ExportedCase {
  case: StoredCase;
  criteria: StoredCriterion[];
  /** All draft versions (non-destructive history), oldest first. */
  drafts: ExportedDraft[];
  /** All RFE response versions, oldest first. */
  rfeResponses: ExportedRfe[];
  /** All documents incl. soft-deleted. */
  documents: ExportedDocument[];
  reviews: ReviewEvent[];
}

/** The complete bundle of a user's data, for "download my data" (GDPR/CCPA). The
 *  route stamps `exportedAt`; the store gathers everything keyed to the user. */
export interface UserDataExport {
  userId: string;
  profile: Profile | null;
  consents: ConsentExport[];
  tokenBalance: number;
  tokenLedger: LedgerEntry[];
  cases: ExportedCase[];
}

export interface Store {
  getProfile(userId: string): Promise<Profile | null>;
  upsertProfileWithConsent(input: UpsertConsentInput): Promise<void>;
  /** Gather everything keyed to this user — profile, consents, balance + ledger,
   *  and every case with its criteria/drafts/RFEs/documents/reviews — for the
   *  "download my data" export (GDPR/CCPA). Read-only. */
  exportUserData(userId: string): Promise<UserDataExport>;
  /** PERMANENTLY delete every record keyed to this user (profile, consents, token
   *  account + ledger, and all cases + their cascaded children). Irreversible —
   *  the caller is responsible for the auth-account removal + confirmation. */
  deleteUserData(userId: string): Promise<void>;
  /** The `consent_version` of the user's most recent consent row, or null if
   *  they have never consented. Used to re-prompt when the terms version bumps. */
  getLatestConsentVersion(userId: string): Promise<string | null>;
  /** The user's full append-only consent history, NEWEST first — the data behind
   *  a "what you agreed to" receipt / consent log on the account page. */
  getConsentHistory(userId: string): Promise<ConsentExport[]>;
  /** Append a consent/preference row (no profile change). Used for a later
   *  marketing opt-in/out so the audit trail is preserved, not edited in place. */
  recordConsent(input: RecordConsentInput): Promise<void>;
  getBalance(userId: string): Promise<number>;
  /** A user's recent token-ledger entries, newest first (capped at `limit`) —
   *  for the billing "Recent activity" read-out. */
  getLedgerForUser(userId: string, limit: number): Promise<LedgerEntry[]>;
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
  /** SOFT-delete a document from a case's vault — marks it deleted (keeps the row
   *  + its never-reused exhibit ordinal) rather than hard-deleting, so an
   *  accidental/disputed removal of filed legal evidence is recoverable and
   *  auditable (`deletedBy`). Returns true iff a LIVE row was deleted (false = no
   *  matching live doc — already deleted or wrong case — so callers report
   *  not-found instead of a false success). */
  removeCaseDocument(
    caseId: string,
    documentId: string,
    deletedBy?: string | null,
  ): Promise<boolean>;
  /** Restore a soft-deleted document. Returns true iff a DELETED row was restored
   *  (false = no matching deleted doc). The exhibit ordinal is non-reused, so the
   *  restored document keeps its original `Ex. N`. */
  restoreCaseDocument(caseId: string, documentId: string): Promise<boolean>;
  /** Re-file a document under a different criterion bucket. Returns true iff a
   *  matching LIVE row was updated (a soft-deleted doc can't be refiled). */
  refileCaseDocument(
    caseId: string,
    documentId: string,
    criterion: string,
  ): Promise<boolean>;
}

let cached: Promise<Store | null> | undefined;

/** Resolve the active store, lazily importing only the chosen driver. */
export function getStore(): Promise<Store | null> {
  // Cache the in-flight PROMISE (set synchronously, before any await) so two
  // concurrent cold-start callers share ONE initialization. Caching the resolved
  // value instead let both race past the null check and each build a separate
  // Store — for the PGlite in-memory driver that means two divergent databases.
  if (cached !== undefined) return cached;
  cached = (async (): Promise<Store | null> => {
    const driver = dbDriver();
    let resolved: Store | null;
    if (driver === "firestore") {
      resolved = (await import("./firestore-store")).firestoreStore;
    } else if (driver === "pglite") {
      resolved = await (await import("./pglite-store")).getPgliteStore();
    } else {
      resolved = null;
    }
    // Wrap the driver so domain mutations publish typed events to the in-process
    // bus (ADR-0007). Lazily imported to keep the events subsystem + its
    // subscribers out of the bundle until a store is actually used.
    return resolved
      ? (await import("../events")).withDomainEvents(resolved)
      : null;
  })();
  // Don't pin a rejected init: clear the cache so a transient import/driver
  // failure can be retried on the next call (preserves the prior throw-and-retry
  // behavior).
  cached.catch(() => {
    cached = undefined;
  });
  return cached;
}
