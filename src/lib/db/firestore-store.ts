// Server-only. Firestore implementation of the Store (production). Loaded lazily
// by getStore() only when the firestore driver is selected, so firebase-admin
// never reaches the client/edge bundle. All data lives in flat, per-app prefixed
// collections (`${COLLECTION_PREFIX}_<entity>`) in the shared DB; access is
// server-only via the Admin SDK (security rules deny every client).
//
// SQL uniqueness/ON CONFLICT is replaced by DETERMINISTIC doc IDs:
//   token_ledger/signup_<uid>        — one signup grant per user
//   token_ledger/<reason>_<ref>      — one idempotent credit per external ref
//   petition_drafts/<caseId>_v<n>    — one draft per (case, version)
//   rfe_responses/<caseId>_v<n>      — one RFE response per (case, version)
// and atomic debit / version bumps use a Firestore transaction (read-then-write)
// in place of SELECT ... FOR UPDATE.
//
// Domain modeling:
//   cases             — one doc per case (auto-id), criteria DENORMALIZED as an
//                       array field so createCaseWithCriteria is a single write.
//   petition_drafts   — flat, versioned children (case_id + version), counter on
//   rfe_responses       the case doc bumped inside runTransaction.
//   case_documents    — flat collection (case_id), monotonic exhibit ord.
//   case_reviews      — flat, append-only collection (case_id), auto-id.
if (typeof window !== "undefined") {
  throw new Error("@/lib/db/firestore-store must not be imported on the client.");
}

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firestore/admin";
import { COLLECTION_PREFIX } from "./config";
import { formatExhibit } from "@/lib/exhibits";
import type {
  AddDocumentInput,
  AddReviewEventInput,
  CreateCaseInput,
  CreatedCase,
  DraftSection,
  ReviewEvent,
  ReviewKind,
  Store,
  StoredCase,
  StoredCriterion,
  StoredDocument,
  StoredDraft,
  StoredRfe,
} from "./store";

const col = (entity: string) => `${COLLECTION_PREFIX}_${entity}`;

function tsToIso(v: unknown): string | null {
  return v instanceof Timestamp ? v.toDate().toISOString() : null;
}

function tsMs(v: unknown): number {
  return v instanceof Timestamp ? v.toMillis() : 0;
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)) : [];
}

interface CaseDoc {
  user_id?: string;
  file_number?: string;
  petitioner?: string;
  classification?: string;
  status?: string;
  approval_likelihood?: number;
  receipt_number?: string | null;
  created_at?: unknown;
  updated_at?: unknown;
}

function toStoredCase(id: string, d: CaseDoc): StoredCase {
  return {
    id,
    fileNumber: d.file_number ?? "",
    petitioner: d.petitioner ?? "",
    classification: d.classification ?? "O-1A",
    status: d.status ?? "Intake",
    approvalLikelihood: Number(d.approval_likelihood ?? 0),
    receiptNumber: (d.receipt_number as string | null) ?? null,
    createdAt: tsToIso(d.created_at),
    updatedAt: tsToIso(d.updated_at),
  };
}

function toDraftSections(v: unknown): DraftSection[] {
  if (!Array.isArray(v)) return [];
  return v.map((s) => {
    const o = (s ?? {}) as Record<string, unknown>;
    return { heading: String(o.heading ?? ""), body: String(o.body ?? "") };
  });
}

// Firestore is schemaless, so unlike the PGlite driver (integer column +
// `check (balance >= 0)`) it has no DB-level backstop on the token balance. A
// single non-numeric/NaN value (bad merge, console edit, out-of-band writer)
// would make `balance < cost` → `NaN < cost` → false, letting every debit
// "succeed" while writing NaN back — unbounded free spend forever. Coerce every
// balance read to a finite non-negative integer (fail-CLOSED to 0, which can't
// spend), and log when a stored value was actually corrupt so it's observable.
function safeBalance(raw: unknown, userId: string): number {
  if (raw === undefined || raw === null) return 0;
  const n = Number(raw);
  if (Number.isFinite(n) && Number.isInteger(n) && n >= 0) return n;
  console.error(
    `[firestore] corrupt token balance for ${userId}: ${JSON.stringify(raw)} — treating as 0`,
  );
  return 0;
}

export const firestoreStore: Store = {
  async getProfile(userId) {
    const snap = await adminDb().collection(col("profiles")).doc(userId).get();
    if (!snap.exists) return null;
    const d = snap.data() ?? {};
    return {
      id: userId,
      email: (d.email as string | null) ?? null,
      full_name: (d.full_name as string | null) ?? null,
      avatar_url: (d.avatar_url as string | null) ?? null,
      onboarded_at: tsToIso(d.onboarded_at),
    };
  },

  async upsertProfileWithConsent(input) {
    const fs = adminDb();
    const profileRef = fs.collection(col("profiles")).doc(input.userId);
    await fs.runTransaction(async (t) => {
      const snap = await t.get(profileRef);
      // Coalesce: keep the first onboarded_at / created_at if the row exists.
      const onboardedAt =
        (snap.exists && snap.get("onboarded_at")) || FieldValue.serverTimestamp();
      const createdAt =
        (snap.exists && snap.get("created_at")) || FieldValue.serverTimestamp();
      t.set(
        profileRef,
        {
          id: input.userId,
          email: input.email,
          full_name: input.fullName,
          avatar_url: input.avatarUrl,
          onboarded_at: onboardedAt,
          created_at: createdAt,
          updated_at: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      // consents are append-only → auto-id doc.
      t.set(fs.collection(col("consents")).doc(), {
        user_id: input.userId,
        consent_version: input.consentVersion,
        terms_accepted: input.terms,
        privacy_accepted: input.privacy,
        marketing_opt_in: input.marketing,
        ip: input.ip,
        user_agent: input.userAgent,
        created_at: FieldValue.serverTimestamp(),
      });
    });
  },

  async getLatestConsentVersion(userId) {
    // Query by user_id only (single-field, auto-indexed) and pick the latest in
    // memory — a user has at most a handful of consent rows (one per version
    // bump), so this avoids requiring a composite (user_id, created_at) index.
    const snap = await adminDb()
      .collection(col("consents"))
      .where("user_id", "==", userId)
      .get();
    let latest: { version: string; at: number } | null = null;
    for (const doc of snap.docs) {
      const version = doc.get("consent_version");
      if (typeof version !== "string") continue;
      const ts = doc.get("created_at");
      const at = ts && typeof ts.toMillis === "function" ? ts.toMillis() : 0;
      // DETERMINISTIC "latest accepted version": order by the version STRING
      // (consent versions are chronological yyyy-mm-dd dates, and a user only ever
      // accepts the CURRENT — newest — version, so the max version string is the
      // latest accepted), with `created_at` only breaking an exact version tie.
      // This is immune to an un-materialized `serverTimestamp()` reading as 0 —
      // the prior `at >= latest.at` could pick an OLDER version when the newest
      // row's timestamp hadn't committed yet (at=0 losing to an older at>0 row).
      if (
        !latest ||
        version > latest.version ||
        (version === latest.version && at >= latest.at)
      ) {
        latest = { version, at };
      }
    }
    return latest?.version ?? null;
  },

  async getConsentHistory(userId) {
    const snap = await adminDb()
      .collection(col("consents"))
      .where("user_id", "==", userId)
      .get();
    return snap.docs
      .map((d) => d.data())
      .sort((a, b) => tsMs(b.created_at) - tsMs(a.created_at))
      .map((v) => ({
        consentVersion: String(v.consent_version ?? ""),
        termsAccepted: Boolean(v.terms_accepted),
        privacyAccepted: Boolean(v.privacy_accepted),
        marketingOptIn: Boolean(v.marketing_opt_in),
        ip: (v.ip as string | undefined) ?? null,
        userAgent: (v.user_agent as string | undefined) ?? null,
        createdAt: tsToIso(v.created_at),
      }));
  },

  async recordConsent(input) {
    // Append-only auto-id doc — same shape as upsertProfileWithConsent's consent
    // write, but WITHOUT the profile mutation.
    await adminDb().collection(col("consents")).doc().set({
      user_id: input.userId,
      consent_version: input.consentVersion,
      terms_accepted: input.terms,
      privacy_accepted: input.privacy,
      marketing_opt_in: input.marketing,
      ip: input.ip,
      user_agent: input.userAgent,
      created_at: FieldValue.serverTimestamp(),
    });
  },

  async getBalance(userId) {
    const snap = await adminDb()
      .collection(col("token_accounts"))
      .doc(userId)
      .get();
    return snap.exists ? safeBalance(snap.get("balance"), userId) : 0;
  },

  async getLedgerForUser(userId, limit) {
    // Query by user_id only (single-field auto-index) then sort + slice in memory
    // — avoids requiring a composite (user_id, created_at) index, same convention
    // as getLatestConsentVersion. A user's ledger is bounded (purchases + ops).
    const q = await adminDb()
      .collection(col("token_ledger"))
      .where("user_id", "==", userId)
      .get();
    const ms = (v: unknown): number => (v instanceof Timestamp ? v.toMillis() : 0);
    return q.docs
      .map((d) => d.data())
      .sort((a, b) => ms(b.created_at) - ms(a.created_at))
      .slice(0, Math.max(0, Math.floor(limit)))
      .map((v) => ({
        delta: Number(v.delta ?? 0),
        reason: String(v.reason ?? ""),
        operation: v.operation == null ? null : String(v.operation),
        balanceAfter: Number(v.balance_after ?? 0),
        createdAt: tsToIso(v.created_at),
      }));
  },

  async charge(userId, cost, operation, ref) {
    const fs = adminDb();
    const accRef = fs.collection(col("token_accounts")).doc(userId);
    // Key the debit row DETERMINISTICALLY on the requestId (ref) — like credit's
    // `${reason}_${ref}` — so an app-level retry of the same logical charge can't
    // debit twice (the previous auto-id `.doc()` was the only ledger mutation
    // without idempotency).
    const debitRef = fs.collection(col("token_ledger")).doc(`debit_${ref}`);
    return fs.runTransaction(async (t) => {
      const snap = await t.get(accRef);
      const balance = snap.exists ? safeBalance(snap.get("balance"), userId) : 0;
      const seen = await t.get(debitRef);
      if (seen.exists) return { ok: true, balance }; // already debited (idempotent)
      if (balance < cost) return { ok: false, balance };
      const next = balance - cost;
      t.set(
        accRef,
        { user_id: userId, balance: next, updated_at: FieldValue.serverTimestamp() },
        { merge: true },
      );
      t.set(debitRef, {
        user_id: userId,
        delta: -cost,
        reason: "debit",
        operation,
        ref,
        balance_after: next,
        metadata: {},
        created_at: FieldValue.serverTimestamp(),
      });
      return { ok: true, balance: next };
    });
  },

  async credit(userId, amount, reason, ref, metadata = {}) {
    const fs = adminDb();
    const accRef = fs.collection(col("token_accounts")).doc(userId);
    const ledgerCol = fs.collection(col("token_ledger"));
    const ledgerRef = ref ? ledgerCol.doc(`${reason}_${ref}`) : ledgerCol.doc();
    return fs.runTransaction(async (t) => {
      const accSnap = await t.get(accRef);
      if (ref) {
        const seen = await t.get(ledgerRef);
        if (seen.exists) {
          return accSnap.exists ? safeBalance(accSnap.get("balance"), userId) : 0;
        }
      }
      const cur = accSnap.exists ? safeBalance(accSnap.get("balance"), userId) : 0;
      // Floor at 0: a refund clawback (negative amount) on an already-spent
      // balance must not drive the account NEGATIVE (locking the user out behind
      // an invisible debt). Positive credits/grants are unaffected.
      const next = Math.max(0, cur + amount);
      t.set(
        accRef,
        { user_id: userId, balance: next, updated_at: FieldValue.serverTimestamp() },
        { merge: true },
      );
      t.set(ledgerRef, {
        user_id: userId,
        delta: amount,
        reason,
        ref: ref ?? null,
        balance_after: next,
        metadata,
        created_at: FieldValue.serverTimestamp(),
      });
      return next;
    });
  },

  async grantSignupTokens(userId, amount) {
    const fs = adminDb();
    const accRef = fs.collection(col("token_accounts")).doc(userId);
    const ledgerRef = fs.collection(col("token_ledger")).doc(`signup_${userId}`);
    await fs.runTransaction(async (t) => {
      const accSnap = await t.get(accRef);
      const seen = await t.get(ledgerRef);
      if (seen.exists) return; // already granted
      const cur = accSnap.exists ? safeBalance(accSnap.get("balance"), userId) : 0;
      // Floor at 0: a refund clawback (negative amount) on an already-spent
      // balance must not drive the account NEGATIVE (locking the user out behind
      // an invisible debt). Positive credits/grants are unaffected.
      const next = Math.max(0, cur + amount);
      t.set(
        accRef,
        { user_id: userId, balance: next, updated_at: FieldValue.serverTimestamp() },
        { merge: true },
      );
      t.set(ledgerRef, {
        user_id: userId,
        delta: amount,
        reason: "signup_grant",
        balance_after: next,
        created_at: FieldValue.serverTimestamp(),
      });
    });
  },

  // ── Domain: cases + criteria ──────────────────────────────────────────────
  async createCaseWithCriteria(input: CreateCaseInput): Promise<CreatedCase> {
    const fs = adminDb();
    const ref = fs.collection(col("cases")).doc(); // auto-id case id
    // Criteria DENORMALIZED on the case doc → atomic single-doc write.
    const criteria = input.criteria.map((cr, ord) => ({
      name: cr.name,
      status: cr.status,
      evidence: cr.evidence,
      rationale: cr.rationale,
      exhibit: cr.exhibit ?? "",
      ord,
    }));
    await ref.set({
      user_id: input.userId,
      file_number: input.fileNumber,
      petitioner: input.petitioner,
      classification: input.classification,
      status: "Intake",
      approval_likelihood: Math.round(input.approvalLikelihood),
      receipt_number: null,
      criteria,
      draft_version: 0,
      rfe_version: 0,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });
    return { id: ref.id, fileNumber: input.fileNumber };
  },

  async getCasesForUser(userId): Promise<StoredCase[]> {
    const q = await adminDb()
      .collection(col("cases"))
      .where("user_id", "==", userId)
      .orderBy("created_at", "desc")
      .limit(100)
      .get();
    return q.docs.map((d) => toStoredCase(d.id, d.data() as CaseDoc));
  },

  async getCaseForUser(userId, caseId): Promise<StoredCase | null> {
    const snap = await adminDb().collection(col("cases")).doc(caseId).get();
    if (!snap.exists) return null;
    const d = snap.data() as CaseDoc;
    if (d.user_id !== userId) return null;
    return toStoredCase(snap.id, d);
  },

  async getCaseAnyOwner(caseId): Promise<StoredCase | null> {
    const snap = await adminDb().collection(col("cases")).doc(caseId).get();
    if (!snap.exists) return null;
    return toStoredCase(snap.id, snap.data() as CaseDoc);
  },

  async getCasesInReview(): Promise<StoredCase[]> {
    const q = await adminDb()
      .collection(col("cases"))
      .where("status", "==", "Attorney Review")
      .orderBy("updated_at", "asc")
      .limit(200)
      .get();
    return q.docs.map((d) => toStoredCase(d.id, d.data() as CaseDoc));
  },

  async getCriteriaForCase(caseId): Promise<StoredCriterion[]> {
    const snap = await adminDb().collection(col("cases")).doc(caseId).get();
    if (!snap.exists) return [];
    const raw = snap.get("criteria");
    if (!Array.isArray(raw)) return [];
    return [...raw]
      .map((c, i) => {
        const o = (c ?? {}) as Record<string, unknown>;
        return { o, ord: Number(o.ord ?? i) };
      })
      .sort((a, b) => a.ord - b.ord)
      .map(({ o }, i): StoredCriterion => ({
        id: `${caseId}_c${i}`,
        name: String(o.name ?? ""),
        status: String(o.status ?? ""),
        evidence: String(o.evidence ?? ""),
        rationale: String(o.rationale ?? ""),
        exhibit: String(o.exhibit ?? ""),
      }));
  },

  async setCaseStatus(caseId, status, receiptNumber): Promise<void> {
    const update: Record<string, unknown> = {
      status,
      updated_at: FieldValue.serverTimestamp(),
    };
    if (receiptNumber !== undefined) update.receipt_number = receiptNumber;
    await adminDb()
      .collection(col("cases"))
      .doc(caseId)
      .set(update, { merge: true });
  },

  async transitionCase(input): Promise<boolean> {
    const fs = adminDb();
    const caseRef = fs.collection(col("cases")).doc(input.caseId);
    return fs.runTransaction(async (t) => {
      const snap = await t.get(caseRef);
      if (!snap.exists) return false;
      // Compare-and-set inside the transaction: bail unless the current status
      // is allowed, so concurrent double-submits / illegal transitions lose.
      const current = String(snap.get("status") ?? "Intake");
      if (!input.fromStatuses.includes(current)) return false;
      const update: Record<string, unknown> = {
        status: input.toStatus,
        updated_at: FieldValue.serverTimestamp(),
      };
      if (input.receiptNumber !== undefined) {
        update.receipt_number = input.receiptNumber;
      }
      t.set(caseRef, update, { merge: true });
      // Append events in the SAME transaction → status + audit log stay in sync.
      for (const ev of input.events) {
        t.set(fs.collection(col("case_reviews")).doc(), {
          case_id: input.caseId,
          author_id: ev.authorId,
          author_role: ev.authorRole,
          kind: ev.kind,
          body: ev.body ?? "",
          metadata: ev.metadata ?? {},
          created_at: FieldValue.serverTimestamp(),
        });
      }
      return true;
    });
  },

  // ── Domain: petition drafts (versioned) ───────────────────────────────────
  async saveDraft(caseId, sections, source): Promise<number> {
    const fs = adminDb();
    const caseRef = fs.collection(col("cases")).doc(caseId);
    return fs.runTransaction(async (t) => {
      const caseSnap = await t.get(caseRef);
      const cur = caseSnap.exists ? Number(caseSnap.get("draft_version") ?? 0) : 0;
      const version = cur + 1;
      const draftRef = fs
        .collection(col("petition_drafts"))
        .doc(`${caseId}_v${version}`);
      t.set(draftRef, {
        case_id: caseId,
        version,
        sections: sections.map((s) => ({ heading: s.heading, body: s.body })),
        source,
        created_at: FieldValue.serverTimestamp(),
      });
      // Bump the counter and advance Intake→Drafting (a draft now exists).
      const update: Record<string, unknown> = {
        draft_version: version,
        updated_at: FieldValue.serverTimestamp(),
      };
      if (caseSnap.exists && caseSnap.get("status") === "Intake") {
        update.status = "Drafting";
      }
      t.set(caseRef, update, { merge: true });
      return version;
    });
  },

  async getLatestDraft(caseId): Promise<StoredDraft | null> {
    const q = await adminDb()
      .collection(col("petition_drafts"))
      .where("case_id", "==", caseId)
      .orderBy("version", "desc")
      .limit(1)
      .get();
    const doc = q.docs[0];
    if (!doc) return null;
    return {
      version: Number(doc.get("version") ?? 1),
      sections: toDraftSections(doc.get("sections")),
      source: String(doc.get("source") ?? "mock"),
    };
  },

  // ── Domain: RFE responses (versioned) ─────────────────────────────────────
  async saveRfeResponse(caseId, rfeText, sections, source): Promise<number> {
    const fs = adminDb();
    const caseRef = fs.collection(col("cases")).doc(caseId);
    return fs.runTransaction(async (t) => {
      const caseSnap = await t.get(caseRef);
      const cur = caseSnap.exists ? Number(caseSnap.get("rfe_version") ?? 0) : 0;
      const version = cur + 1;
      const rfeRef = fs
        .collection(col("rfe_responses"))
        .doc(`${caseId}_v${version}`);
      t.set(rfeRef, {
        case_id: caseId,
        version,
        rfe_text: rfeText,
        sections: sections.map((s) => ({ heading: s.heading, body: s.body })),
        source,
        created_at: FieldValue.serverTimestamp(),
      });
      t.set(
        caseRef,
        { rfe_version: version, updated_at: FieldValue.serverTimestamp() },
        { merge: true },
      );
      return version;
    });
  },

  async getLatestRfeResponse(caseId): Promise<StoredRfe | null> {
    const q = await adminDb()
      .collection(col("rfe_responses"))
      .where("case_id", "==", caseId)
      .orderBy("version", "desc")
      .limit(1)
      .get();
    const doc = q.docs[0];
    if (!doc) return null;
    return {
      version: Number(doc.get("version") ?? 1),
      rfeText: String(doc.get("rfe_text") ?? ""),
      sections: toDraftSections(doc.get("sections")),
      source: String(doc.get("source") ?? "mock"),
    };
  },

  // ── Domain: attorney review thread (append-only) ──────────────────────────
  async addReviewEvent(input: AddReviewEventInput): Promise<void> {
    await adminDb()
      .collection(col("case_reviews"))
      .doc()
      .set({
        case_id: input.caseId,
        author_id: input.authorId,
        author_role: input.authorRole,
        kind: input.kind,
        body: input.body ?? "",
        metadata: input.metadata ?? {},
        created_at: FieldValue.serverTimestamp(),
      });
  },

  async getReviewEvents(caseId): Promise<ReviewEvent[]> {
    const q = await adminDb()
      .collection(col("case_reviews"))
      .where("case_id", "==", caseId)
      .orderBy("created_at", "asc")
      .get();
    return q.docs.map((d): ReviewEvent => {
      const v = d.data();
      return {
        id: d.id,
        authorRole: String(v.author_role ?? "applicant"),
        kind: (v.kind as ReviewKind) ?? "note",
        body: String(v.body ?? ""),
        metadata: (v.metadata as Record<string, unknown>) ?? {},
        createdAt: tsToIso(v.created_at) ?? "",
      };
    });
  },

  // ── Domain: evidence vault ────────────────────────────────────────────────
  async addCaseDocument(input: AddDocumentInput): Promise<StoredDocument> {
    const fs = adminDb();
    const caseRef = fs.collection(col("cases")).doc(input.caseId);
    const docRef = fs.collection(col("case_documents")).doc();
    // Monotonic exhibit ordinal lives on the case doc so deletes never renumber
    // surviving exhibits. Bump it + create the document in one transaction.
    return fs.runTransaction(async (t) => {
      const caseSnap = await t.get(caseRef);
      const ord = (caseSnap.exists ? Number(caseSnap.get("doc_ord") ?? 0) : 0) + 1;
      const exhibit = formatExhibit(ord);
      const status = input.status ?? "Received";
      const facts = [...input.facts].map((f) => String(f));
      t.set(docRef, {
        case_id: input.caseId,
        name: input.name,
        criterion: input.criterion,
        ord,
        exhibit,
        status,
        facts,
        source: input.source,
        created_at: FieldValue.serverTimestamp(),
      });
      t.set(
        caseRef,
        { doc_ord: ord, updated_at: FieldValue.serverTimestamp() },
        { merge: true },
      );
      return {
        id: docRef.id,
        name: input.name,
        criterion: input.criterion,
        exhibit,
        status,
        facts,
        source: input.source,
      };
    });
  },

  async getCaseDocuments(caseId): Promise<StoredDocument[]> {
    const q = await adminDb()
      .collection(col("case_documents"))
      .where("case_id", "==", caseId)
      .orderBy("ord", "asc")
      .get();
    return q.docs
      // Exclude soft-deleted exhibits (deleted_at present). Filtered in memory so
      // no composite (case_id, deleted_at, ord) index is required.
      .filter((d) => !d.get("deleted_at"))
      .map((d): StoredDocument => {
        const v = d.data();
        return {
          id: d.id,
          name: String(v.name ?? ""),
          criterion: String(v.criterion ?? "Unsorted"),
          exhibit: String(v.exhibit ?? ""),
          status: String(v.status ?? "Received"),
          facts: strArr(v.facts),
          source: String(v.source ?? "mock"),
        };
      });
  },

  async removeCaseDocument(caseId, documentId, deletedBy = null): Promise<boolean> {
    const fs = adminDb();
    const ref = fs.collection(col("case_documents")).doc(documentId);
    const snap = await ref.get();
    // Scope by case_id (mirrors the SQL `where id = $1 and case_id = $2`) and
    // only delete a LIVE doc — re-deleting an already-deleted one is not_found.
    const matched = snap.exists && snap.get("case_id") === caseId && !snap.get("deleted_at");
    if (matched) {
      await ref.set(
        { deleted_at: FieldValue.serverTimestamp(), deleted_by: deletedBy },
        { merge: true },
      );
    }
    return matched;
  },

  async restoreCaseDocument(caseId, documentId): Promise<boolean> {
    const fs = adminDb();
    const ref = fs.collection(col("case_documents")).doc(documentId);
    const snap = await ref.get();
    const matched = snap.exists && snap.get("case_id") === caseId && Boolean(snap.get("deleted_at"));
    if (matched) {
      await ref.set(
        { deleted_at: FieldValue.delete(), deleted_by: FieldValue.delete() },
        { merge: true },
      );
    }
    return matched;
  },

  async refileCaseDocument(caseId, documentId, criterion): Promise<boolean> {
    const fs = adminDb();
    const ref = fs.collection(col("case_documents")).doc(documentId);
    const snap = await ref.get();
    const matched = snap.exists && snap.get("case_id") === caseId && !snap.get("deleted_at");
    if (matched) await ref.set({ criterion }, { merge: true });
    return matched;
  },

  async exportUserData(userId) {
    const fs = adminDb();

    const pSnap = await fs.collection(col("profiles")).doc(userId).get();
    const profile = pSnap.exists
      ? {
          id: userId,
          email: (pSnap.get("email") as string | undefined) ?? null,
          full_name: (pSnap.get("full_name") as string | undefined) ?? null,
          avatar_url: (pSnap.get("avatar_url") as string | undefined) ?? null,
          onboarded_at: tsToIso(pSnap.get("onboarded_at")),
        }
      : null;

    const cSnap = await fs.collection(col("consents")).where("user_id", "==", userId).get();
    const consents = cSnap.docs
      .map((d) => d.data())
      .sort((a, b) => tsMs(a.created_at) - tsMs(b.created_at))
      .map((v) => ({
        consentVersion: String(v.consent_version ?? ""),
        termsAccepted: Boolean(v.terms_accepted),
        privacyAccepted: Boolean(v.privacy_accepted),
        marketingOptIn: Boolean(v.marketing_opt_in),
        ip: (v.ip as string | undefined) ?? null,
        userAgent: (v.user_agent as string | undefined) ?? null,
        createdAt: tsToIso(v.created_at),
      }));

    const balSnap = await fs.collection(col("token_accounts")).doc(userId).get();
    const tokenBalance = balSnap.exists ? safeBalance(balSnap.get("balance"), userId) : 0;

    const lSnap = await fs.collection(col("token_ledger")).where("user_id", "==", userId).get();
    const tokenLedger = lSnap.docs
      .map((d) => d.data())
      .sort((a, b) => tsMs(b.created_at) - tsMs(a.created_at))
      .map((v) => ({
        delta: Number(v.delta ?? 0),
        reason: String(v.reason ?? ""),
        operation: v.operation == null ? null : String(v.operation),
        balanceAfter: Number(v.balance_after ?? 0),
        createdAt: tsToIso(v.created_at),
      }));

    const casesSnap = await fs.collection(col("cases")).where("user_id", "==", userId).get();
    const cases = await Promise.all(
      casesSnap.docs.map(async (cd) => {
        const caseId = cd.id;
        const c = toStoredCase(caseId, cd.data() as CaseDoc);
        const rawCrit = cd.get("criteria");
        const criteria = (Array.isArray(rawCrit) ? rawCrit : [])
          .map((x, i) => ({ o: (x ?? {}) as Record<string, unknown>, ord: Number((x as Record<string, unknown>)?.ord ?? i) }))
          .sort((a, b) => a.ord - b.ord)
          .map(({ o }, i) => ({
            id: `${caseId}_c${i}`,
            name: String(o.name ?? ""),
            status: String(o.status ?? ""),
            evidence: String(o.evidence ?? ""),
            rationale: String(o.rationale ?? ""),
            exhibit: String(o.exhibit ?? ""),
          }));
        const [draftsSnap, rfeSnap, docsSnap, revSnap] = await Promise.all([
          fs.collection(col("petition_drafts")).where("case_id", "==", caseId).get(),
          fs.collection(col("rfe_responses")).where("case_id", "==", caseId).get(),
          fs.collection(col("case_documents")).where("case_id", "==", caseId).get(),
          fs.collection(col("case_reviews")).where("case_id", "==", caseId).get(),
        ]);
        const drafts = draftsSnap.docs
          .map((d) => d.data())
          .sort((a, b) => Number(a.version ?? 0) - Number(b.version ?? 0))
          .map((v) => ({ version: Number(v.version ?? 1), sections: Array.isArray(v.sections) ? (v.sections as DraftSection[]) : [], source: String(v.source ?? "mock"), createdAt: tsToIso(v.created_at) }));
        const rfeResponses = rfeSnap.docs
          .map((d) => d.data())
          .sort((a, b) => Number(a.version ?? 0) - Number(b.version ?? 0))
          .map((v) => ({ version: Number(v.version ?? 1), rfeText: String(v.rfe_text ?? ""), sections: Array.isArray(v.sections) ? (v.sections as DraftSection[]) : [], source: String(v.source ?? "mock"), createdAt: tsToIso(v.created_at) }));
        const documents = docsSnap.docs.map((d) => ({
          id: d.id,
          name: String(d.get("name") ?? ""),
          criterion: String(d.get("criterion") ?? "Unsorted"),
          exhibit: String(d.get("exhibit") ?? ""),
          status: String(d.get("status") ?? "Received"),
          facts: strArr(d.get("facts")),
          source: String(d.get("source") ?? "mock"),
          deletedAt: tsToIso(d.get("deleted_at")),
        }));
        const reviews = revSnap.docs
          .map((d) => ({ d, ms: tsMs(d.get("created_at")) }))
          .sort((a, b) => a.ms - b.ms)
          .map(({ d }) => ({
            id: d.id,
            authorRole: String(d.get("author_role") ?? "applicant"),
            kind: String(d.get("kind") ?? "note") as ReviewEvent["kind"],
            body: String(d.get("body") ?? ""),
            metadata: (d.get("metadata") ?? {}) as Record<string, unknown>,
            createdAt: tsToIso(d.get("created_at")) ?? "",
          }));
        return { case: c, criteria, drafts, rfeResponses, documents, reviews };
      }),
    );

    return { userId, profile, consents, tokenBalance, tokenLedger, cases };
  },

  async deleteUserData(userId) {
    const fs = adminDb();
    const casesSnap = await fs.collection(col("cases")).where("user_id", "==", userId).get();
    const refs: FirebaseFirestore.DocumentReference[] = [
      fs.collection(col("profiles")).doc(userId),
      fs.collection(col("token_accounts")).doc(userId),
    ];
    const byUser = await Promise.all([
      fs.collection(col("consents")).where("user_id", "==", userId).get(),
      fs.collection(col("token_ledger")).where("user_id", "==", userId).get(),
    ]);
    for (const snap of byUser) for (const d of snap.docs) refs.push(d.ref);
    // Per case: the cascaded children (Firestore has no FK cascade) + the case doc.
    for (const cd of casesSnap.docs) {
      const caseId = cd.id;
      const children = await Promise.all([
        fs.collection(col("petition_drafts")).where("case_id", "==", caseId).get(),
        fs.collection(col("rfe_responses")).where("case_id", "==", caseId).get(),
        fs.collection(col("case_documents")).where("case_id", "==", caseId).get(),
        fs.collection(col("case_reviews")).where("case_id", "==", caseId).get(),
      ]);
      for (const snap of children) for (const d of snap.docs) refs.push(d.ref);
      refs.push(cd.ref);
    }
    // Commit in batches (Firestore caps a batch at 500). delete() is idempotent,
    // so a missing profile/account doc is a harmless no-op.
    for (let i = 0; i < refs.length; i += 450) {
      const batch = fs.batch();
      for (const ref of refs.slice(i, i + 450)) batch.delete(ref);
      await batch.commit();
    }
  },
};
