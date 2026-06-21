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

- **2026-06-14 — #1 Live Adjudication-Risk Engine SHIPPED.** Promoted the eval
  gates into the live path. New `src/lib/llm/adjudication-gates.ts`:
  `runAdjudication(ctx)` → `{gates, risk: ready|review|blocked, attorneyReady}`.
  The scenario-FREE leaf scanners (`fabricatedSpecifics`+`stripLegal`,
  `matchedAdvice` UPL tripwires, `caseLawHits`, `wrongCodes`, `tokens`,
  `sentenceCount`) were MOVED here and are now imported by
  `scripts/llm-eval/gates.ts` — single-sourced, so live + offline can't drift
  (harness behavior verified unchanged via a throwaway `runGates` check). The
  orchestrator (`operation.ts`) gained an `adjudicate?(output,input,source,body)`
  hook run after `build` (best-effort, try/caught) that attaches `{adjudication}`
  to the body; wired for draft + qualify. `AdjudicationBadge` (in
  `components/legal`) shows attorney-ready/review/blocked + exact reasons.
  **Gotcha:** `executeAiOperation` already has a local `body` var (the request
  JSON) — name the response var `responseBody`. **Producer for #2** (provenance
  ledger enriches DraftGenerated w/ the adjudication verdict) **and #3**
  (ensemble adjudicates each sample). **Follow-ups:** step 4 (LightTrack
  pass-rate per op/engine) + step 5 (auto-capture live hard-fails into a
  scenario-candidate store) — both need new infra. rfe/guidance/categorize can
  adopt the hook trivially (not yet wired).

- **2026-06-14 — #19 Adjudicator redline SHIPPED.** Self-critique loop over the
  draft. `drafting.ts`: `buildCritiquePrompt`/`tryParseCritique` (maps each
  critique back to a REAL section heading so a renamed heading can't apply to the
  wrong section)/`mockCritique`/`overallCritiqueScore`. Route
  `/api/draft/critique` (`critiqueOperation.ts`) grades the CLIENT's current
  sections (incl. local edits) via `executeAiOperation`. **Billing pattern:**
  reused the existing heavy `draft_section` op key rather than adding a new
  metered op — the `OPERATION_REGISTRY` test asserts EXACTLY six ops, so a 7th
  would break it. `DraftStudio`: score chips per section, redline cards (<80)
  with the weakness + rewrite, one-click Apply that swaps the body and persists a
  new version via the existing no-charge `/api/draft/save` (`retrySaveDraft`) —
  no new persistence code. **Follow-up:** step 6 (attorney triggers critique
  from the review queue; score as the queue sort key) not built.

- **2026-06-14 — #20 RFE Risk Radar SHIPPED.** Inverted `rfe.ts` into a pre-filing
  forecast: `buildRfeForecastPrompt`/`tryParseRfeForecast`/`mockRfeForecast`
  predict per-criterion RFE risk (ranked; mock ranks Partial highest, drops
  None). Route `/api/rfe/forecast` (`forecastOperation.ts`) reuses the heavy `rfe`
  op key (no new metered op — same registry constraint as #19). `RfeRiskRadar`
  (in `features/rfe/components`) is embedded in DraftStudio; **Reinforce wires
  straight to DraftStudio's existing `regenerate(criterion)`** (the section
  headings == criterion names, so `reinforceable = new Set(sections.map(s=>
  s.heading))`). This is the **canonical RFE-forecast engine** — #11 (pre-adjudicate
  over criteria+vault+draft) and #8 (qualify-side challenges w/ legal basis) can
  reuse `buildRfeForecastPrompt`/`tryParseRfeForecast` with their own inputs/
  surfaces. **Follow-ups:** step 5 (persist a pre-filing risk score per draft
  version) + step 6 (predicted-vs-actual calibration) need a schema column.

- **2026-06-14 — #21 Exhibit-bound brief SHIPPED.** Extended #10's exhibit
  citation discipline to the RFE responder. `RfeCriterion.exhibits?`,
  `buildRfePrompt` lists exhibits + adds the (Exhibit N) rule, `attachRfeExhibits`
  binds the vault on the DB path (rfe route now loads docs via EvidenceAdapter
  best-effort), `mockRfe` cites them. Extracted the `<ExhibitIndex>` UI
  (citation-integrity meter + UNSUPPORTED quarantine) from DraftStudio into
  `features/drafting/components/ExhibitIndex.tsx` and `exhibitBullets` from
  drafting.ts — both studios now share one citation surface. #10 had built the
  pure helpers (`auditCitations`/`buildExhibitIndex`/`attachExhibits`) generically
  enough that RfeStudio reuses them verbatim. Net: #10+#21 are one
  evidence-to-argument graph across draft AND RFE.

- **2026-06-14 — #17 Programmatic SEO atelier SHIPPED.** `professions.ts` (typed
  content map: profession → tuned evidence example per criterion NAME, falls back
  to the pack's generic copy). One SSG route
  `/visa/[classification]/[profession]/page.tsx` via `generateStaticParams` over
  `livePrograms() × PROFESSIONS` (15 pages: 3 programs × 5 professions) — renders
  criteria + examples + FAQ/Service JSON-LD + embedded `<InstantVerdict
  initialClassification>` (added that prop). `sitemap.ts` (force-static) covers
  the matrix. Extracted `SITE_URL` into `@/lib/site` and pointed layout at it
  (single-source). All statically prerendered (`●` in build). The matrix scales
  with the data — add a profession or live program → more pages, zero marginal
  code.

- **2026-06-14 — #2 Provenance Ledger SHIPPED (step 1).** `src/lib/events/
  provenance.ts`: hash-chained audit ledger. `createProvenanceChain`/
  `verifyChain`/`hashAuditRecord` are pure with an injectable `HashFn` (default
  SHA-256 via node:crypto; canonical key-sorted JSON → stable digest).
  `registerProvenanceLedger` reuses the SAME `toAuditRecord` projection (can't
  drift from the audit trail); `getDomainBus` wires it in place of the plain
  audit log, `getProvenanceChain()` exposes it. Tests prove any mutation/delete/
  reorder breaks the chain. **This hash-chain primitive is the SHARED producer
  for #5 (token_ledger cost-of-record) and #13 (consent attestation chain) —
  both just need to apply `hashAuditRecord`-style chaining at their write seam.**
  **Follow-ups (need infra):** durable `ChainedAuditSink` (Store ledger table),
  enriching DraftGenerated w/ the #1 adjudication verdict, the signed PDF
  appendix, and the public verify endpoint.

- **2026-06-14 — #18 Shareable Letters Patent SHIPPED.** Done WITHOUT a DB by
  encoding the snapshot in the URL token. `letters-patent.ts`:
  `encodeSnapshot`/`decodeSnapshot` (runtime-agnostic base64url via
  `btoa`/`atob`+`TextEncoder` — NO `Buffer`, so it works client-side for the
  share button AND server-side in the page/OG route). Token carries only
  name/classification/likelihood/per-criterion-status (never profile text);
  decode is tamper-guarded (rejects non-live programs + wrong status counts vs
  the pack). `/c/[token]/page.tsx` renders the engraved certificate;
  `/c/[token]/opengraph-image.tsx` (next/og, `runtime="nodejs"`, brand palette
  mirrored as hex since globals.css tokens aren't in Satori). `LettersPatentShare`
  (copy link + LinkedIn) wired into InstantVerdict + QualifyPanel. **Pattern:**
  URL-encoded snapshots are a clean way to ship "public shareable artifact"
  features without persistence. Consumer of #16 (links back to Instant Verdict).
  **Follow-up:** brand FONT in the OG image (Fraunces) needs a font fetch in the
  route — currently Georgia/serif fallback.

## Bug-hunter + UI-perfectionist dual-lens scan (2026-06-20, branch `vibeman/bughunt-uiperf-2026-06-20`)

100 findings / 20 contexts (7C/35H/42M/16L). Waves 1-6 closed 37 findings incl.
ALL 7 criticals (one a verified FP, hardened). 17 fix + 5 doc commits, UNMERGED
off `main`. tsc0 / tests 378→395 / lint / `next build` PASS throughout. INDEX +
per-wave docs at `docs/harness/bughunt-uiperf-2026-06-20/`.

- **2026-06-20 (W6 a11y)** — `Button` now applies the focus ring on its shared
  BASE (was ghost-only) so all variants are keyboard-visible; the canonical ring
  is `focus-visible:ring-2 ring-accent-dark ring-offset-2 ring-offset-background`.
  The whole app rings on `--accent-dark` (4.2/5.6:1), NOT `--accent`/40 (2.63:1) —
  a 34-file sweep. New convention: result surfaces (verdict, generated text,
  categorize status) carry an sr-only `role="status"` live region (CriteriaReport,
  FieldGuidancePanel, EvidenceVault). Clickable table rows keep `<tr onClick>` as
  a MOUSE enhancement + a labelled link-in-cell for keyboard/SR (don't make the
  `<tr>` a button — breaks table semantics). `sr-only` is available (Tailwind 4).

### Structural facts
- **2026-06-20** — The save route (`/api/draft/save`) uses the ADAPTER
  (`@/lib/data/adapters/petition`), whose `saveDraft` converts a no-store `null`
  into `err("unconfigured")` → 503 (http.ts maps `unconfigured`→503,
  `forbidden`→403, `not_found`→404, `store_error`→500). So a no-store save is a
  503, never a `200 {version:null}` — the "Saved ✓ persists nothing" critical was
  a FALSE POSITIVE (the subagent traced `@/lib/data/petitions`, the lib, not the
  adapter). LESSON: verify the import the CONSUMER uses before fixing.
- **2026-06-20** — The token ledger (`@/lib/tokens/ledger`) is the ONE chokepoint
  all metered ops + purchases + refunds + grants funnel through; money-validation
  belongs there. `credit` accepts NEGATIVE amounts (refund clawback) — guards must
  allow sign but bound magnitude/finiteness. Firestore needs CODE-level balance
  invariants (`safeBalance`) since it can't express PGlite's integer + `>= 0`
  CHECK.
- **2026-06-20** — The orchestrator (`executeAiOperation`) now: runs `spec.guard`
  OUTSIDE the model try (a guard throw is a billed-parser-regression, logged +
  reclaimed, not a model failure); skips `spec.adjudicate` when `source==="mock"`
  (no theater risk score on a template); reclaims at most once via a try/caught
  `reclaim()` helper.
- **2026-06-20** — Rate-limit IP derivation (`clientIp`) takes the
  RIGHTMOST-minus-`TRUSTED_PROXY_HOPS` `x-forwarded-for` hop (the edge-appended,
  unforgeable one), NOT the leftmost client claim. `enforceCap` hard-evicts to
  hold `MAX_BUCKETS`. New env: `TRUSTED_PROXY_HOPS` (default 0).
- **2026-06-20** — `safeNext()` (`@/lib/auth/safe-next`) is the open-redirect
  guard; EVERY `?next=` consumer must route through it. `next` is now wired
  login → /welcome → consent action, re-validated each hop.
- **2026-06-20** — Sign-out (both `/auth/signout` POST and `DELETE
  /api/auth/session`) now `revokeRefreshTokens(uid)` before clearing the cookie;
  `getUser` already verifies with `checkRevoked=true`, so this makes sign-out a
  real logout. `getUser`'s catch now logs the UNEXPECTED (admin/credential) branch.
- **2026-06-20** — `Store.getLatestConsentVersion(userId)` added; the onboarding
  gate + `/welcome` re-prompt when it ≠ `CONSENT_VERSION` (consent version was
  write-only before). `QualifyAssessment.classification` is now pinned into the
  result so `CriteriaReport` derives the threshold from it, not mutable form state.

### Open follow-ups (from the 2026-06-20 dual-lens scan)
- **Waves 6-8 NOT run** (no remaining criticals): W6 accessibility (focus-visible
  on Button variants, criteria-table semantics, verdict aria-live, live regions),
  W7 reliability/resource (provenance ledger unbounded growth, concurrent-publish
  ordering, module/cache staleness, orphan grandchild on claude timeout), W8 UI
  consistency (manifest stale "$2,500" price, header/footer drift, landing-claude
  duplicate-content, dead Card hover, destructive-remove confirm).
- **Deferred mediums/lows:** llm-eval #5 (sentence-count fooled by `U.S.`/`C.F.R.`
  — masking attempt introduced a NUL byte into the single-sourced
  `adjudication-gates.ts`, reverted; redo with a tokenizer); rate-limit #4 (byUser
  anon→IP fallback), #5 (single-node doc); auth #5 (/welcome edge protection);
  drafting #4 (first-generate seeding), #5 (stale Saved-pill); checkout #3 (refund
  floor), #4 (toast race); token #3 (debit idempotency-by-requestId), #4 (dev
  grant `||1000`), #5 (metering-unavailable observability); ai #3/#4.
- **Verify before merge:** `externalCustomerId` propagation on a real Polar
  sandbox renewal (checkout #2 fix relies on it); `TRUSTED_PROXY_HOPS` set
  correctly for the actual deployment edge.
