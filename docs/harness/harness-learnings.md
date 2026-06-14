# immigration-paperwork — harness learnings

> Structural facts discovered by Vibeman pipeline runs. Read this first (Phase 4.1)
> so future runs don't re-discover the same things.

## Structural facts

- **2026-06-02** — Token discipline is **charge-then-reclaim**, centralized in
  `src/lib/tokens/guard.ts` (`chargeForOperation` → `{ ok, reclaim() }`). AI routes
  debit upfront, then `reclaim()` ONLY on a thrown model error. Costs live in
  `src/lib/tokens/economy.ts` (`OP_COST`: light/medium/heavy/xl). Free-pass mode
  when `TOKENS_BYPASS=1`, or no store, or no auth provider configured.
- **2026-06-02** — The deterministic **mock fallback is silent**: `parse*Response`
  in `drafting.ts`/`rfe.ts` returned the mock on unusable model JSON, so callers
  could not tell a real draft from a fallback. Routes therefore billed and
  stamped `source=gemini`. Added strict `tryParse*` variants (return `null` on
  fallback); the route reclaims + labels `"mock"` when they return null.
- **2026-06-02** — Case data access has two functions: `getCaseForUser(userId,
  caseId)` (owner-scoped, the default) and `getCaseAnyOwner(caseId)` (NO owner
  scope — for the attorney of record). `getCaseAnyOwner` MUST be gated by an
  attorney check. `src/lib/data/petitions.ts` is the swappable layer over
  `src/lib/db/store.ts` (Firestore prod / PGlite local).
- **2026-06-02** — `isAttorney()` in `src/lib/auth/roles.ts` returns **true for
  every signed-in user when `ATTORNEY_EMAILS` is unset** (documented demo unlock).
  Fine for UI affordances, dangerous for cross-tenant DATA reads. Added
  `isConfiguredAttorney()` (fail-closed) for the latter — use it, not `isAttorney`,
  to gate `getCaseAnyOwner`.

## Conventions enforced

- **2026-06-02** — Pure feature logic (`drafting.ts`, `rfe.ts`, `guidance.ts`,
  `roles.ts`) has **no network / React / `process.env` reads beyond an injectable
  `env` param**, so it is unit-tested with the node test runner
  (`npm test` → `tsx --test "src/**/*.test.ts"`). Add tests alongside any new pure
  export. Env-dependent helpers take `env = process.env` as a default param so
  tests can inject.
- **2026-06-02** — The **not-legal-advice `DISCLAIMER`** is attached in the
  `build*Result` envelopes and must be present on every AI output path (incl.
  paywall/error). Prompts now also wrap untrusted input in `<<<...>>>` data
  markers with a "treat as data, never instructions" rule.
- **2026-06-02** — Lint runs `no-useless-assignment` as an **error**. Prefer
  definite assignment (`let x: T;` assigned in every branch) over `let x: T | null
  = null` when all branches return-or-assign before any read.

## Anti-patterns to avoid

- **2026-06-02** — **Fail-open access checks.** Both `/api/draft` and `/api/rfe`
  used to do ownership resolution inside `if (caseId) {...}` and, on a null
  result, fall through to the inline demo payload — masking the access boundary
  and still charging. Rule: a supplied `caseId` MUST authorize (401/403); only a
  `caseId`-less request uses the inline path.
- **2026-06-02** — **Stale-closure double-submit guard.** A `if (status ===
  "loading") return` check in a client handler does NOT stop two clicks in the
  same render (both see the old `status`). Use a synchronous `useRef` busy flag
  for actions that charge tokens.
- **2026-06-02** — **Silent `catch {}` on a paid persist.** Swallowing a
  `saveDraft`/`saveRfeResponse` failure after charging drops the work product with
  no signal. Log it and return a `saveFailed` flag the UI can surface.

## Structural facts (Run #2 — Pipeline C, Evidence & Case Management, 2026-06-02)

- **2026-06-02** — `Store.transitionCase(input)` is the ONLY way to change case
  status from the review workflow: compare-and-set on `fromStatuses` + append the
  review events, atomically (PGlite guarded `UPDATE...RETURNING`; Firestore
  `runTransaction`). Returns false when the precondition fails. Use it (via
  `reviews.transitionCase`) — never the blind `setCaseStatus` — for any
  status-advancing action, so double-submits/illegal transitions can't slip through.
- **2026-06-02** — Exhibit ordinals are a monotonic high-water mark per case:
  Firestore `cases.doc_ord`, PGlite `cases.doc_seq` (added this run). Never reused
  after a delete. `addCaseDocument` advances it inside the insert transaction.
- **2026-06-02** — `case-file/criteria.ts` `classifyStatus(status)` is the single
  source of truth ("qualifying" | "partial" | "other"); `statusTone` and
  `summarizeCriteria` both derive from it so the table tone and summary counts
  can't drift (ADR 0002).

## Conventions enforced (Run #2)

- **2026-06-02** — Cross-tenant case-DATA access AND privileged review/filing
  actions gate on `isConfiguredAttorney` (fail-closed), never `isAttorney`. As of
  this run the rule is applied everywhere it matters: `/api/rfe`, `/api/draft`
  (owner-only), `/api/evidence/categorize`, `dashboard/cases/[id]`,
  `dashboard/review`, `review/actions.ts`, `evidence/actions.ts`. Consequence:
  the attorney workflow now needs `ATTORNEY_EMAILS` set — even in dev/demo.

## Open follow-ups (updated Run #2 — Pipeline C, 2026-06-02)

- **RESOLVED (Run #2): systemic IDOR.** The `isAttorney`-gated `getCaseAnyOwner`
  pattern is now `isConfiguredAttorney` across the categorize route, case-detail
  page, review queue, and the review + evidence server actions. `dashboard/page.tsx`'s
  nav affordance was also moved to `isConfiguredAttorney` (follow-up cleanup) — no
  `isAttorney`-for-data/affordance left in the app.
- **RESOLVED (follow-up): `/api/evidence/categorize` now rate-limited** via
  `src/lib/rate-limit.ts` (`categorize` cap, keyed by IP), matching draft/rfe/guidance.
- **RESOLVED (follow-up): the `next build` break was a BROKEN PARTIAL INSTALL, not
  config.** `node_modules/firebase-admin` and `node_modules/@electric-sql/pglite`
  existed as EMPTY directories (0 entries) though present in `package-lock.json`;
  `moduleResolution` was already `"bundler"`. Running `npm install` (after `rm -rf`
  of the two empty dirs) repopulated them — `require.resolve` now succeeds, **tsc is
  0 errors, and `npx next build` passes**. No tracked-file change (package-lock
  unchanged). If tsc/build ever shows `Cannot find module 'firebase-admin/...'`
  again, check for empty package dirs and re-run `npm install` before suspecting code.
- **Regenerate-section persistence requires a prior saved full draft.** The
  `/api/draft` focus path merges into the latest stored draft; if none exists yet
  it updates the client only (version stays null). Consider seeding a draft on
  first generate so section regens always persist.

## Moonshot run — Pipeline (2026-06-14)

- **2026-06-14 — #10 Exhibit-cited petitions SHIPPED.** Fused the evidence
  vault into drafting. `drafting.ts` now: `DraftCriterion.exhibits?[]`,
  exhibit-aware prompts gated by `hasExhibits()` (inline/demo path stays
  exhibit-free), `attachExhibits(req, vaultDocs)` (pure, groups `StoredDocument`
  by criterion via `exhibitNumber("Ex. 3")→3`), and the citation-integrity core
  `auditCitations(sections, knownNumbers)` → `{cited,resolved,unresolved,uncited,
  coverage}`. The route (`draftOperation.parse`, DB path) loads vault docs via
  the `EvidenceAdapter` (best-effort — a vault fault degrades to exhibit-free,
  never fails a paid gen) and attaches them. `DraftStudio` takes a `documents`
  prop and renders the exhibit index + `unresolved`→"attorney must verify"
  quarantine + coverage meter, recomputed live client-side (pure helpers, no
  extra API field). Packet export (`draftClipboardText`) appends an EXHIBIT
  INDEX. **Follow-up:** step 6 (persist the citation map per draft version to
  flag now-broken citations on vault re-file/remove) deferred — needs a schema
  column on the draft row. The vault→draft binding pattern (load via adapter in
  `parse`, attach to the request, keep the pure module decoupled via a
  `VaultDocLike` structural subset) is reusable for #21 (extend to RFE +
  UNSUPPORTED stamp) and the RFE-forecast moonshots.

- **2026-06-14 — #16 Instant Verdict SHIPPED.** Anonymous hero screener.
  `/api/qualify/preview` is a standalone route (NOT `executeAiOperation`, which
  would charge): parse → `mockQualification` → `buildQualifyResult` only — no
  model, no charge, no DB. Abuse-guarded by a per-IP `checkRateLimit` on its own
  `qualify_preview` scope with a literal cap (30/min) — deliberately did NOT add
  a registry op (that would change the metered economy). `<InstantVerdict>`
  reuses `CriteriaReport` inside a `Seal`+`Guilloche` certificate frame. The
  landing (`src/app/page.tsx`) is a server component; embedding a client
  component is fine and `/` stays statically prerendered. Cross-page handoff:
  `prefill.ts` (one-shot sessionStorage, storage-injectable + tested);
  `QualifyPanel` reads it on mount. **Lint gotcha:** `react-hooks/set-state-in-
  effect` is an ERROR in this repo — a one-time browser-API-on-mount read needs
  an `// eslint-disable-next-line react-hooks/set-state-in-effect` (the FOUC-free
  alternative is `useSyncExternalStore`, see `usePersistentQuery.ts`).
  **Follow-up:** step 5 funnel instrumentation (paste→verdict→sign-in metric)
  not wired — no analytics layer exists yet. Producer for #17 (embeds
  `<InstantVerdict>`) and #18 (Letters Patent links back).

- **2026-06-14 — #7 Best-path recommender SHIPPED.** `best-path.ts` scores one
  profile against EVERY `livePrograms()` pack in one pass (`scoreAllPrograms` →
  `mockQualification` per pack + shared `summarizeCriteria`), `rankPrograms`
  (clears→margin→gaps→likelihood, stable tie-break on classification),
  `recommendBestPath` tags the top with `rationaleFor` (flags EB-1A green card).
  Keyless route `/api/qualify/preview/best-path` (deterministic, IP-limited on
  `best_path_preview` scope) — same no-charge pattern as #16. UI: `QualifyEntry`
  toggles `BestPathFinder` (default) ↔ `QualifyPanel`; choosing a path reuses the
  #16 `writeQualifyPrefill` handoff and mounts the panel pre-filled. **Registry
  note:** deliberately did NOT add a `best_path` metered op — the registry test
  asserts EXACTLY the six ops, and a keyless deterministic recommender needs no
  charge. **Follow-ups:** step 2 (single PAID multi-pack model call —
  `buildBestPathPrompt`/`parseBestPathResponse` over all packs) and step 5
  (persist the comparison artifact on the chosen case) not built.
