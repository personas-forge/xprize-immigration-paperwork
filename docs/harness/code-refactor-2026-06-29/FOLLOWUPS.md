# Code-refactor 2026-06-29 — durable follow-up backlog

Everything deferred across Waves A–G, with the reason. This is the standing
backlog: each item was consciously NOT done because it needs a decision, a
behaviour change, a new method, a test edit, or carries regression risk that a
behaviour-preserving refactor wave shouldn't take on. Grouped by theme.

---

## Needs a product / design decision (don't "just refactor")

- **domain-event-bus #1 (HIGH) — provenance ledger is write-only.** (Wave D)
  `getProvenanceChain`/`verifyChain` have no production caller, but
  `registerProvenanceLedger` runs on every domain event — it's a latent
  tamper-evident audit capability on an immigration SaaS. **Decision:** ship a
  consumer (e.g. an auth-gated `GET /api/audit/pack` returning
  `getProvenanceChain()?.records()` + a `verifyChain` result) **vs.** stop
  registering the ledger. Tie the audit-sink item below to this decision.
- **domain-event-bus `registerAuditLog` / `AuditSink` / `defaultSink`.** (Wave D)
  Test-only consumers today (`subscribers.test.ts`). Don't delete (would require
  editing a test); its fate follows the #1 decision. `toAuditRecord` is live —
  leave it.

## Behaviour-sensitive — would change observable output (out of scope here)

- **petition.createCase vs evidence.addDocument null-write 500-vs-503.** Same
  root cause (configured store, null write) returns a non-retryable 500 in one
  path and a retryable 503 in the other. Reconciling changes a user-facing status
  code + ops signal. (data-adapter-layer #2)
- **AI orchestrator adjudicate-envelope ×4 / persist-envelope unification.**
  (ai-operation-orchestrator #2, #4) Moving `runAdjudication`/`versionSave*` into
  the orchestrator changes the hook contract and what the draft/save-recovery
  route reads (`saveFailed`). Response-contract risk.
- **evidence `str()` content/classification coercion.** (evidence-vault #3)
  `str(record.content, MAX_CONTENT)` would make the over-length rejection
  unreachable; `classification` `str(...) || "O-1A"` would change `""`/padded
  inputs. Only the genuinely-identical `name` field was converted.
- **evidence double case-resolve per categorize.** (evidence-vault #2) Needs a new
  adapter method (`getCaseAndDocuments`) and changes a hot-path query shape —
  perf/consolidation, not pure dedup.
- **ai-operation-orchestrator #3 — `loadCaseContext` extraction.** ~25-line
  pre-charge sequence across rfe/draft/forecast with genuine per-spec divergence
  (draft 409 merge-base gate, owner-only flag, forecast lighter variant). High
  regression risk.
- **caseFileData cache/TTL guards.** (case-file-dashboard #4) Only remove if the
  guarded multi-consumer/per-case condition is provably unreachable AND removal
  can't change behaviour; otherwise keep. Not provable in a safe wave.

## Brand / UI — Tailwind v4 cascade-layer finding (NEW, Wave G)

- **brand-design-system #5 remainder — microprint inline color → token class is
  UNSAFE.** This app is Tailwind v4 (`@import "tailwindcss"`, cascade layers).
  `.microprint` is **unlayered** (`color: var(--muted)`), so it BEATS any layered
  `text-accent-dark` / `text-muted-strong` / `text-success` utility. Existing code
  proves it: CaseDetailView keeps an inline `style={{ color: "var(--accent-dark)" }}`
  on a microprint child even though its parent already carries `text-accent-dark`.
  Converting the ~override sites to token classes would **regress** them to muted.
  Options: (a) leave inline; (b) add `tone`-variant classes INSIDE the same
  unlayered block (e.g. `.microprint.is-accent { color: var(--accent-dark) }`) and
  migrate; (c) move `.microprint` into `@layer components` so utilities can win.
  Only the pure no-op (`var(--muted)` on a `.microprint` element) is safe to drop —
  CardSubtitle was done in Wave G.
- **brand-design-system #5 — per-page `var(--muted)` no-op scatter (~40 sites).**
  `className="microprint" style={{ color: "var(--muted)" }}` is a safe no-op
  everywhere the element has `microprint`. A separate **verified codemod** task:
  must EXCLUDE the ~3 non-microprint `var(--muted)` spans (EvidenceVault.tsx:258,
  DashboardChrome.tsx:35, FieldGuidancePanel.tsx:179 — those genuinely set muted on
  a non-microprint element). Low value, broad/visual — do as its own reviewed pass.
- **uscis-form-field-guidance #2 — `WithAdjudication<T>` dedup.** Only 2 of the 5
  sites are clean `T & { adjudication?: AdjudicationReport }` intersections
  (FieldGuidancePanel, QualifyPanel); the other 3 (DraftStudio ×2, RfeStudio) are
  members of larger named interfaces with their own field doc-comments. Converting
  those to `WithAdjudication<{…}>` isn't a clean type-only move, and a generic for a
  single optional interface field is over-abstraction. Partial 2/5 adoption would
  add inconsistency. Defer until it can be done uniformly (or leave as idiomatic).

## Dead-code / cleanup blocked by the "don't touch tests" rule

- **rfe #3 — `parseRfeResponse`/`parseDraftResponse` tests-only wrappers.** (Wave B)
  Clean fix is deletion, but their unit tests forbid it here. Safe follow-up: a
  one-line "convenience wrapper — route uses guard+mock directly" note.
- **evidence-vault #5 — `DISCLAIMER`/`O1A_CRITERIA` barrel re-exports.** (Wave D)
  Only consumer is `evidence.test.ts`; removing requires repointing a test.
- **README.md / README_work.md still list `stampIn`** (and removed motion
  variants). (Wave D) Doc drift; harmless.
- **brand-design-system #3, #4 — dead `stampIn` Variants + `indigo` color ramp.**
  Exported/threaded through 5 layers with zero consumers. Delete-vs-keep-as-palette
  is a small design call; both are dead today.
- **token-economy-ledger #1 — dead `insufficientResponse`.** Divergently
  duplicates the live 402 path AND drops the UPL disclaimer. Safe to delete + fix
  the stale doc ref (or hoist the orchestrator's 402 builder); flagged HIGH but a
  dead-export removal, left for a dead-code pass.

## Lower-value consolidations (genuine but marginal)

- **data-adapter-layer #3, #4 — `BaseAdapter` for constructor/`deps()`; unify the
  "gate then act" preamble (PetitionAdapter awaits `deps()` twice).** Marginal;
  a base class may be heavier than the duplication.
- **data-adapter-layer #5 / http.ts test-only exports.** Kept-by-design test seam
  (reviewed & kept twice); honest comment already prevents a phantom contract.
- **consent-onboarding #2 — `loadConsentState` extraction.** The correctness-
  critical predicate (`isFullyConsented`) is already shared; only the
  fetch-profile+fetch-consent plumbing repeats (opposite polarity). Tidiness only.
- **checkout #1, #4, #5 — `featuredBundle()` accessor; `isPolarWebhookConfigured()`
  predicate; 3 near-dup SDK-version reminder comments.** Each small; #1 (kill the
  `b.key === "pro"` magic string in 2 landing callers) is the most valuable.
- **rate-limiting #1, #2 — `enforceRateLimit` already added (Wave/earlier); stale
  header comment listing 3 of 5 AI endpoints.** Comment fix is trivial.
- **llm-engine-observability #1, #3 — cost-telemetry header comment misdescribes
  `lib/lighttrack.ts` as "unrelated"; `docs/llm-engines.md` "adding an engine"
  predates the engines.ts split.** Doc/comment corrections.
- **uscis #4, #5 — "back-compat" comment mislabels a live re-export; stale
  pre-orchestrator route-header narration.** Comment cleanup.
- **case-file-dashboard #2 / attorney #2 — case-status `statusTone` already
  centralized as `caseStatusTone`;** any remaining private copies should import it
  (verify ReviewPanel/CaseList post-consolidation).
- **token-economy-ledger #2, #3, #4 — `labelOf` total like `costOf`; rename the
  orchestrator's `ChargeOutcome` mirror to `ChargeResult`; route
  getBalance/getLedgerForUser null-store branch through `warnIfMeteringExpected`.**
  #2 is a latent billing-page crash (a stale ledger op string throws) — worth doing
  but it's a small behaviour change (returns the raw key instead of throwing).

## Authentication-session tail (low)

- **authentication-session #1 — `authProvider()` `explicit` branch is dead** /
  `NEXT_PUBLIC_AUTH_PROVIDER` is a no-op knob. Reduce to
  `isFirebaseConfigured() ? "firebase" : null` and drop the env line — but it
  touches `.env.example` + the provider abstraction; small decision (keep the
  selector seam for a future non-firebase provider?).
- **authentication-session #5 / checkout — middleware comment names dev `__session`
  though prod uses `__Host-session`.** One-line comment fix.
