-- Immigration Concierge — application schema (petition pipeline).
--
-- These tables live in the SAME private Postgres schema as the auth/token
-- tables (app_immigration), which Supabase already created and does NOT expose
-- to PostgREST. Run this against that database to enable real, user-scoped
-- cases for the Qualify -> Draft flow. Every statement is idempotent, so it is
-- safe to re-run.
--
-- The token economy keeps working with NO database (the guard free-passes);
-- these tables only become necessary once you want qualification assessments
-- and petition drafts to persist per user.

create schema if not exists app_immigration;

-- gen_random_uuid() — available via pgcrypto (preinstalled on Supabase).
create extension if not exists pgcrypto;

-- A petition case. One row per qualification assessment / petition the user
-- starts. Mirrors PetitionCase in src/features/case-file/types.ts.
create table if not exists app_immigration.cases (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null,
  file_number         text not null,
  petitioner          text not null,
  classification      text not null default 'O-1A',     -- O-1A | O-1B | EB-1A
  status              text not null default 'Intake',    -- Intake | Drafting | Attorney Review | Filed | Approved
  approval_likelihood int  not null default 0,           -- 0-100, AI-scored
  target_file_date    date,
  attorney            text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists cases_user_idx on app_immigration.cases (user_id);

-- The scored O-1A criteria for a case. Mirrors Criterion in types.ts, plus a
-- `rationale` column capturing WHY the model scored the criterion as it did.
-- `status` is text (not an enum) so the AI-sourced value is stored verbatim and
-- validated in application code (see statusTone / summarizeCriteria, ADR 0002).
create table if not exists app_immigration.criteria (
  id        uuid primary key default gen_random_uuid(),
  case_id   uuid not null references app_immigration.cases (id) on delete cascade,
  name      text not null,
  status    text not null,                 -- Met | Strong | Partial | None
  evidence  text not null default '',
  rationale text not null default '',
  exhibit   text not null default '',
  ord       int  not null default 0        -- preserves the canonical criterion order
);
create index if not exists criteria_case_idx on app_immigration.criteria (case_id);

-- A generated petition-letter draft for a case. `sections` is a JSON array of
-- { heading, body } blocks. Multiple versions are kept (version ascending) so a
-- regenerate never destroys prior text. Populated by the Drafting Studio (Phase 2).
create table if not exists app_immigration.petition_drafts (
  id         uuid primary key default gen_random_uuid(),
  case_id    uuid not null references app_immigration.cases (id) on delete cascade,
  version    int  not null default 1,
  sections   jsonb not null default '[]'::jsonb,
  source     text not null default 'mock', -- mock | gemini
  created_at timestamptz not null default now()
);
create index if not exists drafts_case_idx on app_immigration.petition_drafts (case_id);

-- USCIS receipt number, set when the attorney signs and files (workflow #4).
alter table app_immigration.cases add column if not exists receipt_number text;

-- The evidence vault for a case: each uploaded/described document, AI-
-- categorized into one of the eight O-1A criteria (or 'Unsorted'), with an
-- auto-assigned exhibit number and extracted key facts. `ord` is the monotonic
-- exhibit ordinal (never reused), so deletes don't renumber surviving exhibits.
create table if not exists app_immigration.case_documents (
  id         uuid primary key default gen_random_uuid(),
  case_id    uuid not null references app_immigration.cases (id) on delete cascade,
  name       text not null,
  criterion  text not null default 'Unsorted', -- one of the 8 O-1A criteria, or 'Unsorted'
  ord        int  not null default 0,
  exhibit    text not null default '',          -- e.g. 'Ex. 3'
  status     text not null default 'Received',  -- Received | Pending | Needs review
  facts      jsonb not null default '[]'::jsonb,-- extracted key facts (string[])
  source     text not null default 'mock',      -- mock | gemini
  created_at timestamptz not null default now()
);
create index if not exists case_documents_case_idx on app_immigration.case_documents (case_id);

-- A drafted response to a USCIS Request for Evidence (RFE). `rfe_text` is the
-- notice the response addresses; `sections` is the same { heading, body } shape
-- as petition_drafts. Versioned so a regenerate never destroys prior text.
create table if not exists app_immigration.rfe_responses (
  id         uuid primary key default gen_random_uuid(),
  case_id    uuid not null references app_immigration.cases (id) on delete cascade,
  version    int  not null default 1,
  rfe_text   text not null default '',
  sections   jsonb not null default '[]'::jsonb,
  source     text not null default 'mock', -- mock | gemini
  created_at timestamptz not null default now()
);
create index if not exists rfe_case_idx on app_immigration.rfe_responses (case_id);

-- The attorney-review thread for a case: every workflow event (submitted,
-- changes requested, signed, filed, decision) and free-form notes. Drives the
-- review timeline and the attorney queue. `author_role` is applicant|attorney.
create table if not exists app_immigration.case_reviews (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references app_immigration.cases (id) on delete cascade,
  author_id   uuid,
  author_role text not null default 'applicant', -- applicant | attorney
  kind        text not null,                      -- note | submitted | changes_requested | signed | filed | decision
  body        text not null default '',
  metadata    jsonb not null default '{}'::jsonb, -- e.g. { "receipt": "EAC..." }
  created_at  timestamptz not null default now()
);
create index if not exists case_reviews_case_idx on app_immigration.case_reviews (case_id);
