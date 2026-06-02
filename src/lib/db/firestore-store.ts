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
  };
}

function toDraftSections(v: unknown): DraftSection[] {
  if (!Array.isArray(v)) return [];
  return v.map((s) => {
    const o = (s ?? {}) as Record<string, unknown>;
    return { heading: String(o.heading ?? ""), body: String(o.body ?? "") };
  });
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

  async getBalance(userId) {
    const snap = await adminDb()
      .collection(col("token_accounts"))
      .doc(userId)
      .get();
    return snap.exists ? Number(snap.get("balance") ?? 0) : 0;
  },

  async charge(userId, cost, operation, ref) {
    const fs = adminDb();
    const accRef = fs.collection(col("token_accounts")).doc(userId);
    return fs.runTransaction(async (t) => {
      const snap = await t.get(accRef);
      const balance = snap.exists ? Number(snap.get("balance") ?? 0) : 0;
      if (balance < cost) return { ok: false, balance };
      const next = balance - cost;
      t.set(
        accRef,
        { user_id: userId, balance: next, updated_at: FieldValue.serverTimestamp() },
        { merge: true },
      );
      t.set(fs.collection(col("token_ledger")).doc(), {
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
          return accSnap.exists ? Number(accSnap.get("balance") ?? 0) : 0;
        }
      }
      const cur = accSnap.exists ? Number(accSnap.get("balance") ?? 0) : 0;
      const next = cur + amount;
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
      const cur = accSnap.exists ? Number(accSnap.get("balance") ?? 0) : 0;
      const next = cur + amount;
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
      .orderBy("created_at", "asc")
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
      const exhibit = `Ex. ${ord}`;
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
    return q.docs.map((d): StoredDocument => {
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

  async removeCaseDocument(caseId, documentId): Promise<void> {
    const fs = adminDb();
    const ref = fs.collection(col("case_documents")).doc(documentId);
    const snap = await ref.get();
    // Scope by case_id (mirrors the SQL `where id = $1 and case_id = $2`).
    if (snap.exists && snap.get("case_id") === caseId) await ref.delete();
  },

  async refileCaseDocument(caseId, documentId, criterion): Promise<void> {
    const fs = adminDb();
    const ref = fs.collection(col("case_documents")).doc(documentId);
    const snap = await ref.get();
    if (snap.exists && snap.get("case_id") === caseId) {
      await ref.set({ criterion }, { merge: true });
    }
  },
};
