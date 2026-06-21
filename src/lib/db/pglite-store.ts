// Server-only. PGlite (embedded Postgres, WASM) implementation of the Store for
// zero-infra local dev. Loaded lazily by getStore() only when the pglite driver
// is selected; the ~3 MB WASM is dynamically imported so it never reaches the
// client/edge bundle. Real Postgres dialect → the SQL here mirrors the Firestore
// store's semantics exactly (atomic debit via FOR UPDATE, idempotent
// credit/grant via the same ledger checks, version select-max-then-insert).
// Ids are TEXT (Firebase UIDs / gen_random_uuid()).
if (typeof window !== "undefined") {
  throw new Error("@/lib/db/pglite-store must not be imported on the client.");
}

import { pglitePath } from "./config";
import type {
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

const CORE_DDL = `
create extension if not exists pgcrypto;
create table if not exists profiles (
  id           text primary key,
  email        text,
  full_name    text,
  avatar_url   text,
  onboarded_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create table if not exists consents (
  id               bigserial primary key,
  user_id          text not null,
  consent_version  text not null,
  terms_accepted   boolean not null,
  privacy_accepted boolean not null,
  marketing_opt_in boolean not null,
  ip               text,
  user_agent       text,
  created_at       timestamptz not null default now()
);
create table if not exists token_accounts (
  user_id    text primary key,
  balance    integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint balance_non_negative check (balance >= 0)
);
create table if not exists token_ledger (
  id            bigserial primary key,
  user_id       text not null,
  delta         integer not null,
  reason        text not null,
  operation     text,
  ref           text,
  balance_after integer not null,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create unique index if not exists token_ledger_signup_once
  on token_ledger(user_id) where reason = 'signup_grant';
create unique index if not exists token_ledger_ref_once
  on token_ledger(ref, reason) where ref is not null;
create index if not exists token_ledger_user on token_ledger(user_id);

-- ── Domain: immigration petition pipeline (ids TEXT) ─────────────────────────
create table if not exists cases (
  id                  text primary key default gen_random_uuid()::text,
  user_id             text not null,
  file_number         text not null,
  petitioner          text not null,
  classification      text not null default 'O-1A',
  status              text not null default 'Intake',
  approval_likelihood int  not null default 0,
  receipt_number      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists cases_user_idx on cases (user_id);
-- Monotonic, never-reused exhibit ordinal (mirrors the Firestore doc_ord
-- counter). Lives on the case so deleting a document never renumbers survivors.
alter table cases add column if not exists doc_seq int not null default 0;

create table if not exists criteria (
  id        text primary key default gen_random_uuid()::text,
  case_id   text not null references cases (id) on delete cascade,
  name      text not null,
  status    text not null,
  evidence  text not null default '',
  rationale text not null default '',
  exhibit   text not null default '',
  ord       int  not null default 0
);
create index if not exists criteria_case_idx on criteria (case_id);

create table if not exists petition_drafts (
  id         text primary key default gen_random_uuid()::text,
  case_id    text not null references cases (id) on delete cascade,
  version    int  not null default 1,
  sections   jsonb not null default '[]'::jsonb,
  source     text not null default 'mock',
  created_at timestamptz not null default now()
);
create index if not exists drafts_case_idx on petition_drafts (case_id);

create table if not exists case_documents (
  id         text primary key default gen_random_uuid()::text,
  case_id    text not null references cases (id) on delete cascade,
  name       text not null,
  criterion  text not null default 'Unsorted',
  ord        int  not null default 0,
  exhibit    text not null default '',
  status     text not null default 'Received',
  facts      jsonb not null default '[]'::jsonb,
  source     text not null default 'mock',
  created_at timestamptz not null default now()
);
create index if not exists case_documents_case_idx on case_documents (case_id);

create table if not exists rfe_responses (
  id         text primary key default gen_random_uuid()::text,
  case_id    text not null references cases (id) on delete cascade,
  version    int  not null default 1,
  rfe_text   text not null default '',
  sections   jsonb not null default '[]'::jsonb,
  source     text not null default 'mock',
  created_at timestamptz not null default now()
);
create index if not exists rfe_case_idx on rfe_responses (case_id);

create table if not exists case_reviews (
  id          text primary key default gen_random_uuid()::text,
  case_id     text not null references cases (id) on delete cascade,
  author_id   text,
  author_role text not null default 'applicant',
  kind        text not null,
  body        text not null default '',
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists case_reviews_case_idx on case_reviews (case_id);
`;

type Row = Record<string, unknown>;
interface Queryable {
  query: (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: Row[]; affectedRows?: number }>;
}
interface Pglite extends Queryable {
  exec: (sql: string) => Promise<unknown>;
  transaction: <T>(fn: (tx: Queryable) => Promise<T>) => Promise<T>;
  waitReady: Promise<unknown>;
}

let pgPromise: Promise<Pglite> | null = null;

async function open(): Promise<Pglite> {
  if (!pgPromise) {
    pgPromise = (async () => {
      const { PGlite } = await import("@electric-sql/pglite");
      // CORE_DDL runs `create extension pgcrypto` (for gen_random_uuid()), which
      // PGlite only makes available when the contrib extension is loaded at
      // construction — without this the whole DDL fails with
      // 'extension "pgcrypto" is not available' and every DB-backed page 500s.
      const { pgcrypto } = await import("@electric-sql/pglite/contrib/pgcrypto");
      const pg = new PGlite(pglitePath(), {
        extensions: { pgcrypto },
      }) as unknown as Pglite;
      await pg.waitReady;
      await pg.exec(CORE_DDL);
      return pg;
    })();
  }
  return pgPromise;
}

const num = (v: unknown): number => Number(v ?? 0);
const str = (v: unknown): string => (v == null ? "" : String(v));

const CASE_COLUMNS =
  "id, file_number, petitioner, classification, status, approval_likelihood, receipt_number, created_at, updated_at";

interface CaseRow {
  id: string;
  file_number: string;
  petitioner: string;
  classification: string;
  status: string;
  approval_likelihood: number;
  receipt_number: string | null;
  created_at: string | null;
  updated_at: string | null;
}

function toStoredCase(row: CaseRow): StoredCase {
  return {
    id: row.id,
    fileNumber: row.file_number,
    petitioner: row.petitioner,
    classification: row.classification,
    status: row.status,
    approvalLikelihood: Number(row.approval_likelihood ?? 0),
    receiptNumber: row.receipt_number ?? null,
    createdAt: row.created_at
      ? new Date(row.created_at).toISOString()
      : null,
    updatedAt: row.updated_at
      ? new Date(row.updated_at).toISOString()
      : null,
  };
}

function toDraftSections(v: unknown): DraftSection[] {
  if (!Array.isArray(v)) return [];
  return v.map((s) => {
    const o = (s ?? {}) as Record<string, unknown>;
    return { heading: str(o.heading), body: str(o.body) };
  });
}

export async function getPgliteStore(): Promise<Store> {
  const pg = await open();

  return {
    async getProfile(userId) {
      const r = await pg.query(
        `select id, email, full_name, avatar_url, onboarded_at
           from profiles where id = $1`,
        [userId],
      );
      const row = r.rows[0];
      if (!row) return null;
      return {
        id: row.id as string,
        email: (row.email as string | null) ?? null,
        full_name: (row.full_name as string | null) ?? null,
        avatar_url: (row.avatar_url as string | null) ?? null,
        onboarded_at: row.onboarded_at
          ? new Date(row.onboarded_at as string).toISOString()
          : null,
      };
    },

    async upsertProfileWithConsent(input) {
      await pg.transaction(async (tx) => {
        await tx.query(
          `insert into profiles (id, email, full_name, avatar_url, onboarded_at)
             values ($1, $2, $3, $4, now())
           on conflict (id) do update set
             email = excluded.email,
             full_name = excluded.full_name,
             avatar_url = excluded.avatar_url,
             onboarded_at = coalesce(profiles.onboarded_at, now()),
             updated_at = now()`,
          [input.userId, input.email, input.fullName, input.avatarUrl],
        );
        await tx.query(
          `insert into consents
             (user_id, consent_version, terms_accepted, privacy_accepted,
              marketing_opt_in, ip, user_agent)
           values ($1, $2, $3, $4, $5, $6, $7)`,
          [
            input.userId,
            input.consentVersion,
            input.terms,
            input.privacy,
            input.marketing,
            input.ip,
            input.userAgent,
          ],
        );
      });
    },

    async getLatestConsentVersion(userId) {
      const r = await pg.query(
        `select consent_version from consents
           where user_id = $1 order by id desc limit 1`,
        [userId],
      );
      const v = r.rows[0]?.consent_version;
      return typeof v === "string" ? v : null;
    },

    async getBalance(userId) {
      const r = await pg.query(
        `select balance from token_accounts where user_id = $1`,
        [userId],
      );
      return num(r.rows[0]?.balance);
    },

    async charge(userId, cost, operation, ref) {
      return pg.transaction(async (tx) => {
        await tx.query(
          `insert into token_accounts(user_id, balance) values ($1, 0)
           on conflict (user_id) do nothing`,
          [userId],
        );
        const cur = await tx.query(
          `select balance from token_accounts where user_id = $1 for update`,
          [userId],
        );
        const balance = num(cur.rows[0]?.balance);
        // Idempotent by requestId (ref): an app-level retry of the same logical
        // charge must not debit twice (mirrors credit's ref dedupe).
        const seen = await tx.query(
          `select 1 from token_ledger where ref = $1 and reason = 'debit' limit 1`,
          [ref],
        );
        if (seen.rows.length) return { ok: true, balance }; // already debited
        if (balance < cost) return { ok: false, balance };
        const next = balance - cost;
        await tx.query(
          `update token_accounts set balance = $2, updated_at = now() where user_id = $1`,
          [userId, next],
        );
        await tx.query(
          `insert into token_ledger(user_id, delta, reason, operation, ref, balance_after)
           values ($1, $2, 'debit', $3, $4, $5)`,
          [userId, -cost, operation, ref, next],
        );
        return { ok: true, balance: next };
      });
    },

    async credit(userId, amount, reason, ref, metadata = {}) {
      return pg.transaction(async (tx) => {
        await tx.query(
          `insert into token_accounts(user_id, balance) values ($1, 0)
           on conflict (user_id) do nothing`,
          [userId],
        );
        const cur = await tx.query(
          `select balance from token_accounts where user_id = $1 for update`,
          [userId],
        );
        if (ref) {
          const seen = await tx.query(
            `select 1 from token_ledger where ref = $1 and reason = $2 limit 1`,
            [ref, reason],
          );
          if (seen.rows.length) return num(cur.rows[0]?.balance); // already applied
        }
        // Floor at 0: a refund clawback (negative amount) on an already-spent
        // balance must not go negative — and the `check (balance >= 0)` column
        // constraint would otherwise THROW here, failing the whole refund.
        const next = Math.max(0, num(cur.rows[0]?.balance) + amount);
        await tx.query(
          `update token_accounts set balance = $2, updated_at = now() where user_id = $1`,
          [userId, next],
        );
        await tx.query(
          `insert into token_ledger(user_id, delta, reason, ref, balance_after, metadata)
           values ($1, $2, $3, $4, $5, $6::jsonb)`,
          [userId, amount, reason, ref, next, JSON.stringify(metadata)],
        );
        return next;
      });
    },

    async grantSignupTokens(userId, amount) {
      await pg.transaction(async (tx) => {
        await tx.query(
          `insert into token_accounts(user_id, balance) values ($1, 0)
           on conflict (user_id) do nothing`,
          [userId],
        );
        const cur = await tx.query(
          `select balance from token_accounts where user_id = $1 for update`,
          [userId],
        );
        const seen = await tx.query(
          `select 1 from token_ledger where user_id = $1 and reason = 'signup_grant' limit 1`,
          [userId],
        );
        if (seen.rows.length) return; // already granted
        const next = num(cur.rows[0]?.balance) + amount;
        await tx.query(
          `update token_accounts set balance = $2, updated_at = now() where user_id = $1`,
          [userId, next],
        );
        await tx.query(
          `insert into token_ledger(user_id, delta, reason, balance_after)
           values ($1, $2, 'signup_grant', $3)`,
          [userId, amount, next],
        );
      });
    },

    // ── Domain: cases + criteria ────────────────────────────────────────────
    async createCaseWithCriteria(input) {
      return pg.transaction(async (tx) => {
        const r = await tx.query(
          `insert into cases
             (user_id, file_number, petitioner, classification, status, approval_likelihood)
           values ($1, $2, $3, $4, 'Intake', $5)
           returning id`,
          [
            input.userId,
            input.fileNumber,
            input.petitioner,
            input.classification,
            Math.round(input.approvalLikelihood),
          ],
        );
        const caseId = r.rows[0].id as string;
        let ord = 0;
        for (const cr of input.criteria) {
          await tx.query(
            `insert into criteria
               (case_id, name, status, evidence, rationale, exhibit, ord)
             values ($1, $2, $3, $4, $5, $6, $7)`,
            [caseId, cr.name, cr.status, cr.evidence, cr.rationale, cr.exhibit ?? "", ord++],
          );
        }
        return { id: caseId, fileNumber: input.fileNumber };
      });
    },

    async getCasesForUser(userId) {
      const r = await pg.query(
        `select ${CASE_COLUMNS}
           from cases
          where user_id = $1
          order by created_at desc
          limit 100`,
        [userId],
      );
      return (r.rows as unknown as CaseRow[]).map(toStoredCase);
    },

    async getCaseForUser(userId, caseId) {
      const r = await pg.query(
        `select ${CASE_COLUMNS} from cases where id = $1 and user_id = $2`,
        [caseId, userId],
      );
      const row = r.rows[0] as unknown as CaseRow | undefined;
      return row ? toStoredCase(row) : null;
    },

    async getCaseAnyOwner(caseId) {
      const r = await pg.query(
        `select ${CASE_COLUMNS} from cases where id = $1`,
        [caseId],
      );
      const row = r.rows[0] as unknown as CaseRow | undefined;
      return row ? toStoredCase(row) : null;
    },

    async getCasesInReview() {
      const r = await pg.query(
        `select ${CASE_COLUMNS}
           from cases
          where status = 'Attorney Review'
          order by updated_at asc
          limit 200`,
      );
      return (r.rows as unknown as CaseRow[]).map(toStoredCase);
    },

    async getCriteriaForCase(caseId) {
      const r = await pg.query(
        `select id, name, status, evidence, rationale, exhibit
           from criteria
          where case_id = $1
          order by ord asc`,
        [caseId],
      );
      return r.rows.map(
        (row): StoredCriterion => ({
          id: str(row.id),
          name: str(row.name),
          status: str(row.status),
          evidence: str(row.evidence),
          rationale: str(row.rationale),
          exhibit: str(row.exhibit),
        }),
      );
    },

    async setCaseStatus(caseId, status, receiptNumber) {
      if (receiptNumber !== undefined) {
        await pg.query(
          `update cases
              set status = $2, receipt_number = $3, updated_at = now()
            where id = $1`,
          [caseId, status, receiptNumber],
        );
      } else {
        await pg.query(
          `update cases set status = $2, updated_at = now() where id = $1`,
          [caseId, status],
        );
      }
    },

    async transitionCase(input) {
      return pg.transaction(async (tx) => {
        // Compare-and-set: only flip status when it is currently one of the
        // allowed `fromStatuses`. The guarded UPDATE returns the row iff it
        // applied, so concurrent double-submits and illegal transitions are
        // rejected atomically.
        const params: unknown[] = [input.caseId, input.toStatus];
        let receiptClause = "";
        if (input.receiptNumber !== undefined) {
          params.push(input.receiptNumber);
          receiptClause = `, receipt_number = $${params.length}`;
        }
        const fromPlaceholders = input.fromStatuses
          .map((s) => {
            params.push(s);
            return `$${params.length}`;
          })
          .join(", ");
        // No allowed source statuses → never applies.
        if (fromPlaceholders === "") return false;
        const upd = await tx.query(
          `update cases set status = $2${receiptClause}, updated_at = now()
            where id = $1 and status in (${fromPlaceholders})
          returning id`,
          params,
        );
        if (upd.rows.length === 0) return false;
        // Same transaction → status advance and the append-only log stay in sync.
        for (const ev of input.events) {
          await tx.query(
            `insert into case_reviews
               (case_id, author_id, author_role, kind, body, metadata)
             values ($1, $2, $3, $4, $5, $6::jsonb)`,
            [
              input.caseId,
              ev.authorId,
              ev.authorRole,
              ev.kind,
              ev.body ?? "",
              JSON.stringify(ev.metadata ?? {}),
            ],
          );
        }
        return true;
      });
    },

    // ── Domain: petition drafts (versioned) ───────────────────────────────────
    async saveDraft(caseId, sections, source) {
      return pg.transaction(async (tx) => {
        const v = await tx.query(
          `select coalesce(max(version), 0) + 1 as next
             from petition_drafts where case_id = $1`,
          [caseId],
        );
        const version = num(v.rows[0]?.next) || 1;
        await tx.query(
          `insert into petition_drafts (case_id, version, sections, source)
           values ($1, $2, $3::jsonb, $4)`,
          [caseId, version, JSON.stringify(sections), source],
        );
        // Advancing past Intake — a draft now exists for this case.
        await tx.query(
          `update cases set status = 'Drafting', updated_at = now()
            where id = $1 and status = 'Intake'`,
          [caseId],
        );
        return version;
      });
    },

    async getLatestDraft(caseId) {
      const r = await pg.query(
        `select version, sections, source
           from petition_drafts
          where case_id = $1
          order by version desc
          limit 1`,
        [caseId],
      );
      const row = r.rows[0];
      if (!row) return null;
      return {
        version: num(row.version),
        sections: toDraftSections(row.sections),
        source: str(row.source),
      } satisfies StoredDraft;
    },

    // ── Domain: RFE responses (versioned) ─────────────────────────────────────
    async saveRfeResponse(caseId, rfeText, sections, source) {
      return pg.transaction(async (tx) => {
        const v = await tx.query(
          `select coalesce(max(version), 0) + 1 as next
             from rfe_responses where case_id = $1`,
          [caseId],
        );
        const version = num(v.rows[0]?.next) || 1;
        await tx.query(
          `insert into rfe_responses (case_id, version, rfe_text, sections, source)
           values ($1, $2, $3, $4::jsonb, $5)`,
          [caseId, version, rfeText, JSON.stringify(sections), source],
        );
        return version;
      });
    },

    async getLatestRfeResponse(caseId) {
      const r = await pg.query(
        `select version, rfe_text, sections, source
           from rfe_responses
          where case_id = $1
          order by version desc
          limit 1`,
        [caseId],
      );
      const row = r.rows[0];
      if (!row) return null;
      return {
        version: num(row.version),
        rfeText: str(row.rfe_text),
        sections: toDraftSections(row.sections),
        source: str(row.source),
      } satisfies StoredRfe;
    },

    // ── Domain: attorney review thread (append-only) ──────────────────────────
    async addReviewEvent(input) {
      await pg.query(
        `insert into case_reviews
           (case_id, author_id, author_role, kind, body, metadata)
         values ($1, $2, $3, $4, $5, $6::jsonb)`,
        [
          input.caseId,
          input.authorId,
          input.authorRole,
          input.kind,
          input.body ?? "",
          JSON.stringify(input.metadata ?? {}),
        ],
      );
    },

    async getReviewEvents(caseId) {
      const r = await pg.query(
        `select id, author_role, kind, body, metadata, created_at
           from case_reviews
          where case_id = $1
          order by created_at asc`,
        [caseId],
      );
      return r.rows.map(
        (row): ReviewEvent => ({
          id: str(row.id),
          authorRole: str(row.author_role),
          kind: row.kind as ReviewKind,
          body: str(row.body),
          metadata: (row.metadata as Record<string, unknown>) ?? {},
          createdAt: row.created_at
            ? new Date(row.created_at as string).toISOString()
            : "",
        }),
      );
    },

    // ── Domain: evidence vault ────────────────────────────────────────────────
    async addCaseDocument(input) {
      return pg.transaction(async (tx) => {
        // Monotonic, never-reused ordinal: the high-water mark across the case's
        // doc_seq counter AND any surviving rows (robust even if doc_seq was not
        // backfilled). Deleting the top exhibit must NOT free its number for
        // reuse — matches the Firestore doc_ord semantics.
        const o = await tx.query(
          `select greatest(
              coalesce((select doc_seq from cases where id = $1), 0),
              coalesce((select max(ord) from case_documents where case_id = $1), 0)
           ) + 1 as next`,
          [input.caseId],
        );
        const ord = num(o.rows[0]?.next) || 1;
        await tx.query(
          `update cases set doc_seq = $2, updated_at = now() where id = $1`,
          [input.caseId, ord],
        );
        const exhibit = `Ex. ${ord}`;
        const status = input.status ?? "Received";
        const facts = [...input.facts].map((f) => String(f));
        const r = await tx.query(
          `insert into case_documents
             (case_id, name, criterion, ord, exhibit, status, facts, source)
           values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
           returning id`,
          [
            input.caseId,
            input.name,
            input.criterion,
            ord,
            exhibit,
            status,
            JSON.stringify(facts),
            input.source,
          ],
        );
        return {
          id: str(r.rows[0].id),
          name: input.name,
          criterion: input.criterion,
          exhibit,
          status,
          facts,
          source: input.source,
        } satisfies StoredDocument;
      });
    },

    async getCaseDocuments(caseId) {
      const r = await pg.query(
        `select id, name, criterion, exhibit, status, facts, source
           from case_documents
          where case_id = $1
          order by ord asc`,
        [caseId],
      );
      return r.rows.map(
        (row): StoredDocument => ({
          id: str(row.id),
          name: str(row.name),
          criterion: str(row.criterion),
          exhibit: str(row.exhibit),
          status: str(row.status),
          facts: Array.isArray(row.facts) ? (row.facts as string[]) : [],
          source: str(row.source),
        }),
      );
    },

    async removeCaseDocument(caseId, documentId) {
      const r = await pg.query(
        `delete from case_documents where id = $1 and case_id = $2`,
        [documentId, caseId],
      );
      return (r.affectedRows ?? 0) > 0;
    },

    async refileCaseDocument(caseId, documentId, criterion) {
      const r = await pg.query(
        `update case_documents set criterion = $3 where id = $1 and case_id = $2`,
        [documentId, caseId, criterion],
      );
      return (r.affectedRows ?? 0) > 0;
    },
  };
}
