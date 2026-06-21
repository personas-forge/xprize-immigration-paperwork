# Moonshot Backlog — immigration-paperwork

> Generated 2026-06-14 by Vibeman **moonshot-architect** (Opus, deep first-principles analysis).
> 21 accepted moonshots across 7 context groups. Status in Vibeman: `accepted`.
> **Dev handoff:** pull live via `GET /api/ideas?projectId=65ef6aff-e59b-4614-88a8-835d2b180c12&status=accepted`; PATCH `{"id":"<ideaId>","status":"implemented"}` when shipped.
> Each entry carries a Path-to-implementation (first step doable in the current scaffold) inside its description.

**Scoring:** Effort / Impact / Risk are 1–10; Value = Impact·2 − Effort − Risk.

---

## AI Infrastructure & Evaluation

### 1. Live Adjudication-Risk Engine that grades every AI output
- **Idea ID:** `77d566c6-a038-4110-8b7f-5aaafc42b365` · **Category:** user_benefit · **Effort 7 / Impact 10 / Risk 5** (Value 8)

Today the deterministic quality gates in scripts/llm-eval/gates.ts (UPL tripwires, fabrication scan with stripLegal, classification consistency, criteria-pack completeness, case-law hallucination flags) only run OFFLINE on 30 fixed scenarios. The moonshot promotes those same gates into the live request path so every paid generation a real user receives is scored against adjudicator-shaped invariants in real time, and the result is surfaced to the user as a per-document 'USCIS-readiness / compliance risk' badge with the exact reasons (e.g. 'cites case law -> attorney must verify', 'invented a citation count not in the record'). Because the gates already reuse the REAL product constants (DISCLAIMER, criteriaNames, the packs), the production check can never drift from what the eval asserts. Every live gate failure is then auto-captured as a new regression scenario, so the eval corpus grows from real cases instead of 30 hand-written ones.

Path to implementation:
1. Extract the pure scoring core of scripts/llm-eval/gates.ts into a new server-only-free module src/lib/llm/adjudication-gates.ts (same shape: runGates(ctx) -> GateResult[]), leaving the harness importing it so behavior stays single-sourced. First sprint: move the functions, keep the harness green.
2. Add an optional spec.adjudicate hook to AiOperationSpec in src/lib/ai/operation.ts; in the orchestrator's guard stage (step 5) run the gates on the guarded output and attach { adjudication: GateResult[] } to the response body via build().
3. Render a compact risk badge + expandable reasons in the studios (DraftStudio/RfeStudio/CriteriaReport), reusing the existing source-badge slot.
4. Record each gate verdict to LightTrack via lt.trackGuard-style scores so pass-rate is observable per operation per engine.
5. When a live output hard-fails a gate, write an anonymized {input, raw, gates} record to a scenario-candidate store that an admin can promote into scripts/llm-eval/scenarios.ts.
6. Gate the user-visible 'attorney-ready' state on zero hard failures.

If we ship it: the product becomes the only immigration-AI that grades its own output against adjudicator invariants in real time and gets measurably safer with every case it processes - a self-reinforcing compliance moat competitors can't copy without rebuilding the entire gate corpus.

**Why now:** This is a 10x bet because it converts a one-shot dev artifact into a continuously-improving production safety system that is the single most defensible feature a UPL-sensitive legal-AI can have - real-time, deterministic, attorney-grade self-audit. The magnitude is category-defining: every generation gets safer and every failure becomes a permanent test. Now is the moment because the gates, constants, and orchestrator hook points already exist and are proven (they already caught the hardcoded-O-1A and Q10 over-scoring bugs).


### 2. Tamper-evident Petition Provenance Ledger (signed)
- **Idea ID:** `9690a753-8347-4a44-882b-3bf4ccc55cd9` · **Category:** functionality · **Effort 7 / Impact 9 / Risk 4** (Value 7)

The domain event bus already emits typed events (CaseStatusChanged, DraftGenerated, EvidenceUploaded) and the audit-log subscriber (src/lib/events/subscribers/audit-log.ts) already projects each into a structured AuditRecord - but it just writes one JSON line to stdout, so the compliance trail is ephemeral and unverifiable. The moonshot turns that stream into a cryptographically hash-chained, append-only Provenance Ledger: each AuditRecord is extended with the prior record's hash plus a hash of its own content (the engine/source that produced a draft, the exact evidence inputs, and the adjudication-gate verdict), making the entire history of what the AI did to a case tamper-evident. From that ledger the system produces a signed 'AI Provenance Appendix' PDF an attorney can attest to: a court-and-USCIS-defensible record proving exactly what the tool asserted, that it never fabricated specifics outside the record, and that a human attorney reviewed it.

Path to implementation:
1. In audit-log.ts, change AuditRecord to carry prevHash and selfHash and compute a SHA-256 chain over the canonical JSON of {event, caseId, at, detail, prevHash}; inject the hashing fn so it stays testable. First sprint: hash-chain in memory + a test proving any mutation breaks the chain.
2. Add a durable AuditSink that persists ledger rows through the existing Store boundary (one row per event, ordered, with the chain columns).
3. Enrich DraftGenerated/EvidenceUploaded payloads with the source/engine and the live adjudication verdict (depends on the gate engine) so provenance captures HOW each artifact was produced.
4. Build a per-case ledger view that renders the verified chain and flags any break.
5. Generate a signed PDF appendix (reuse the existing brand/seal assets) with a verification hash an attorney signs.
6. Expose a public verify endpoint that recomputes the chain from a downloaded appendix.

If we ship it: every petition ships with a verifiable, signed record of exactly what the AI did - turning the scariest liability of legal-AI (malpractice / UPL exposure) into the product's strongest trust asset and a moat no prompt-wrapper competitor can match.

**Why now:** This is a 10x bet because provenance and UPL-defensibility are the deciding purchase criteria for attorneys adopting AI, and a tamper-evident signed ledger converts the category's biggest fear into its biggest differentiator. The impact is strategic and compounding - the ledger becomes the system of record that locks customers in. Now is right because the event types, the audit-record projection, and the seal/brand assets already exist; only the hash-chain and durable sink are missing.


### 3. Adjudicator Ensemble: multi-model deliberation panel
- **Idea ID:** `2c7272c7-7848-4298-ad30-c84ef837f869` · **Category:** functionality · **Effort 8 / Impact 9 / Risk 6** (Value 4)

The orchestrator (src/lib/ai/operation.ts) currently calls ONE engine via the injectable getLlm() and falls back to a deterministic mock; the eval (EVALUATION.md F2) proved the highest-stakes behavior - qualify scoring on thin/ambiguous profiles - is stochastically unstable, sometimes conflating criteria. The moonshot replaces the single-shot call for the structured screening ops with an Adjudicator Ensemble: run the same operation through N diverse engines/personas (a strict examiner, a petitioner's advocate, a neutral), have each independently score against the deterministic gates, then compute a consensus criterion-by-criterion and surface ONLY agreement as confident, flagging every disagreement for the attorney instead of hiding variance behind one lucky sample. This directly hardens the single behavior the eval identified as most important to a screening tool, and turns model variance from a hidden risk into an explicit, attorney-actionable signal.

Path to implementation:
1. Add a getLlmEnsemble() composite to src/lib/llm/client.ts that returns an OperationLlm whose generate() runs the underlying engine twice (same model, then diverse persona system-prompts) - the orchestrator's getLlm dep is already injectable, so no route changes. First sprint: ship the same-engine double-run for the qualify op and diff the per-criterion verdicts.
2. Add a consensus reducer that takes the parsed results, applies the existing gates per sample, and emits a merged result plus a per-criterion agreement score.
3. Extend AiOperationSpec with an optional ensemble policy (which ops, how many samples) so draft/rfe stay single-shot (cost) while qualify/evidence deliberate.
4. Bill the extra samples honestly through the existing charge-then-reclaim path (one charge, N model calls).
5. Render an agreement/disagreement view in CriteriaReport: green where the panel agrees, amber + 'attorney review' where they split.
6. Feed disagreement cases into the scenario-candidate corpus to harden the prompts over time.

If we ship it: the product stops gambling on a single model sample for the most consequential legal judgment and instead delivers calibrated, panel-backed confidence with disagreement made visible - a trust and accuracy leap that defines what 'serious' AI screening means in this category.

**Why now:** This is a 10x bet because it attacks the exact failure mode the eval flagged as most dangerous (stochastic over-scoring of thin profiles) and converts model uncertainty into an explicit, attorney-facing confidence signal - the difference between a toy and a tool an attorney will stake their license on. Impact is high and directly tied to the core screening promise. Now is right because the orchestrator's getLlm dependency is already injectable and the gates needed to adjudicate each sample already exist.


## Billing & Token Economy

### 4. Token-denominated growth network: gifting, grants & referrals
- **Idea ID:** `234fc7c3-f427-4e17-8a60-3d1200f758ae` · **Category:** functionality · **Effort 5 / Impact 8 / Risk 4** (Value 7)

The ledger already supports idempotent credit() with typed reasons and a one-time signup grant. This moonshot makes the token itself the growth engine: an attorney or firm can grant tokens directly to a client (so counsel sponsors an applicant's drafting), any user can gift tokens to a co-applicant or family member, and a referral pays both sides in tokens when an invitee makes their first purchase — all settled atomically through the existing append-only ledger. Because tokens are the unit of value AND the unit of virality, every grant and referral compounds usage instead of just discounting it.

Path to implementation:
1. Extend CreditReason in store.ts with 'gift', 'referral', and reuse 'enterprise_grant'; add a debit-from-sender + credit-to-recipient transfer that runs as one transaction in pglite-store.ts (charge sender, credit recipient, both keyed off one transfer ref for idempotency). Step 1 is a pure ledger extension — no new UI required to land it.
2. Add a server action + minimal '/billing/gift' form where a signed-in user with balance gifts N tokens to an email; the recipient is credited on next sign-in (pending-grant row keyed by email).
3. Add referral codes stamped into Polar checkout metadata; the webhook credits the referrer on the invitee's first 'purchase' credit, deduped by referral ref.
4. Surface a 'Sponsored by your attorney' badge and a referral share card on /billing, reading grant provenance from ledger metadata.
5. Add anti-abuse caps (max outstanding gifts, referral payout only on paid orders) enforced in the transfer guard.
If we ship it: tokens become a viral currency where every firm seeds its clients and every applicant invites peers, turning the billing system from a cost center into a self-funding acquisition loop with a built-in network effect.

**Why now:** This is a 10x bet because it converts the billing primitive into a distribution channel: attorney-sponsored grants and two-sided referral payouts create a network effect where each user lowers the next user's acquisition cost, which is transformational for a niche, high-intent immigration market. Now is right because the idempotent credit() ledger with typed reasons already exists, so the first transfer mechanic is a contained, low-risk ledger extension rather than new infrastructure.


### 5. Tamper-evident AI cost-of-record signed by the attorney
- **Idea ID:** `6bbaa285-a1ed-4c54-9bca-917544945242` · **Category:** user_benefit · **Effort 5 / Impact 8 / Risk 4** (Value 7)

The token_ledger is already append-only with per-row operation, ref, and jsonb metadata, and the app already has an attorney-of-record sign-off step (transitionCase: signed/filed/decision, case_reviews author_role=attorney). This moonshot turns the ledger into a cryptographically tamper-evident AI provenance and cost record: each ledger row carries the hash of the prior row (a hash chain), so the complete history of which AI operations touched a petition — at what cost, when, by whom — becomes a verifiable, non-repudiable artifact. The attorney can then sign and export a 'Cost & AI-Assistance Record' per case, the exact provenance immigration practice ethics (UPL, candor to USCIS) increasingly demand and that no competitor offers.

Path to implementation:
1. Add a nullable prev_hash + row_hash column to token_ledger in pglite-store.ts and compute row_hash = sha256(prev_hash + canonical(row)) inside the existing charge()/credit() transactions (FOR UPDATE already serializes per account, so the chain is well-ordered). Old rows stay valid as a null-anchored chain.
2. Stamp caseId into ledger metadata at charge time (chargeForOperation already receives the operation; thread the caseId from executeAiOperation's spec) so spend is attributable per petition.
3. Add a verify(userId) function that walks the chain and flags any broken link, exposed as an internal integrity check.
4. Build a per-case 'AI-Assistance & Cost Record' export (PDF/JSON) listing every operation, cost, source label (mock vs model), and the chain digest.
5. Bind the attorney sign-off (transitionCase 'signed') to snapshot the current chain digest into the review event metadata, making the signature attest to a specific record state.
If we ship it: every filed petition ships with a court-and-USCIS-defensible cryptographic record of its AI assistance and cost, an unforgeable compliance asset that becomes the reason firms and bar associations trust this product over any generic AI writer.

**Why now:** This is a 10x bet because it converts a billing ledger into a regulatory moat: immigration filings increasingly need provenance of AI assistance, and a hash-chained, attorney-signable cost-of-record is a defensible asset no general-purpose AI tool can match. Impact is high (it underwrites trust for the entire filing workflow) and now is right because the append-only ledger and the attorney sign-off lifecycle already exist — we only add a chained hash and an export.


### 6. Firm Wallet: pooled multi-seat token economy for law firms
- **Idea ID:** `14bfd7e7-d655-445c-9d7d-102689798226` · **Category:** functionality · **Effort 8 / Impact 9 / Risk 6** (Value 4)

Today the economy is strictly one-user-one-balance (token_accounts keyed by user_id), yet the product already gates an attorney-of-record workflow (isConfiguredAttorney, getCaseAnyOwner, case_reviews author_role=attorney, the Enterprise contact band). The Firm Wallet turns this consumer top-up into B2B infrastructure: a single firm-owned token balance that funds every seat's AI operations, with per-seat and per-case spend rollups derived from the existing token_ledger (operation, ref, metadata). The charge guard resolves a user to their firm and debits the firm wallet instead of the individual, so a firm buys once and provisions an entire caseload — converting a $5 self-serve top-up into a five-figure annual seat contract.

Path to implementation:
1. Add an optional org_id to chargeForOperation's resolution: in guard.ts, after getUser(), look up the user's firm (new orgs/memberships rows in pglite-store.ts; default null = today's per-user behavior) and pass the wallet owner id into charge(). One file + one migration, fully backward compatible.
2. Introduce a wallet-owner column on token_accounts/token_ledger (owner_kind: 'user'|'org') so credit()/charge() debit the right wallet while keeping the idempotency indexes intact.
3. Echo org_id into Polar checkout metadata (checkout/route.ts) and credit the firm wallet in the webhook when present, reusing the existing idempotent credit() path.
4. Add a Firm console page that reads token_ledger grouped by member and by caseId (already on metadata) for seat- and case-level cost attribution.
5. Add seat invitation + ATTORNEY_EMAILS-style membership, and an enterprise_grant top-up flow (the CreditReason already exists).
6. Add per-seat soft caps enforced in the guard so a firm can budget associates.
If we ship it: the token becomes a firm-standardized procurement line item with high switching cost, flipping the business from impulse consumer purchases to durable, expansion-revenue B2B contracts.

**Why now:** This is a 10x bet because it changes the customer from an individual applicant to an immigration law firm with dozens of cases, multiplying ACV and creating a procurement-grade moat the existing attorney/getCaseAnyOwner primitives already point at. The magnitude is a category shift from self-serve credits to B2B infrastructure, and now is right because the multi-party (applicant+attorney) data model and idempotent ledger already exist to build on.


## Eligibility & Qualification

### 7. Best-path recommender across all visa programs
- **Idea ID:** `6ec5e545-83e6-4cdd-8f78-1f98f78a8d0e` · **Category:** functionality · **Effort 6 / Impact 9 / Risk 4** (Value 8)

Today /qualify forces the user to pick ONE classification up front (QualifyPanel's select is locked to a single Classification), then scores only that pack. Most extraordinary-ability candidates legitimately fit several programs (O-1A and EB-1A overlap on awards/membership/judging/scholarly/original-contribution; O-1B and EB-1A on the arts) yet have no way to know which gives the strongest, fastest path. The moonshot turns the screening into a PATH RECOMMENDER: one profile is scored against EVERY live pack in a single run, and the result ranks programs by qualifying margin, likelihood, and effort-to-close-gaps, then recommends the best route (e.g. "You clear O-1A 5/8 today; EB-1A needs one more criterion but is a green card"). This answers the question every applicant actually has — "which visa should I even pursue?" — which no self-screening tool answers today.

Path to implementation:
1. (current scaffold) Add a pure scoreAllPrograms(profile) in qualification.ts that loops livePrograms() and runs the existing mockQualification per pack, returning {classification, summary, likelihood, gapsToThreshold} per program. Ship behind a deterministic unit test reusing the SAMPLE profile and summarizeCriteria.
2. Extend buildQualifyPrompt into one multi-pack prompt (each live pack's criteria) so a single paid model call covers every program instead of N calls; keep per-pack normalization via parseQualifyResponse.
3. Add a ranker that sorts by (meetsThreshold desc, qualifying-margin desc, gaps-to-close asc) and tags one program as the recommendation with a one-line rationale.
4. Replace the QualifyPanel classification select with an optional "I already know my visa" toggle; default "Find my best path" renders a ProgramComparison (CriteriaReport per program in tabs) above the chosen DraftStudio.
5. Persist the chosen program as today, but also store the comparison so the case file records "why this path".

If we ship it: the product stops being an O-1A calculator and becomes the definitive "which US extraordinary-ability visa is right for me" engine — the top-of-funnel every applicant and immigration creator links to, with a comparison artifact competitors cannot cheaply replicate.

**Why now:** This is a 10x bet because it changes the core question from "score me on the visa I guessed" to "tell me which visa to pursue" — the highest-anxiety decision in the journey and a top reason candidates over-pay attorneys early. The engine, packs, threshold math (summarizeCriteria), and case persistence already exist, so it is largely orchestration. Now is the moment because the multi-product packs (O-1A/O-1B/EB-1A) just landed, so cross-program comparison data is finally all present.


### 8. Adversarial RFE red-team that pre-empts the denial
- **Idea ID:** `7ffb2e41-9662-4d67-8f9c-097c7170d1ec` · **Category:** user_benefit · **Effort 6 / Impact 9 / Risk 5** (Value 7)

The screening today tells you which criteria you Met and lists generic gaps, but USCIS denies extraordinary-ability cases by ATTACKING specific criteria with predictable arguments (a "leading role" that is merely senior, "press" that is a press release not independent coverage, citations that show authorship but not original contribution — exactly the cross-criterion conflation buildQualifyPrompt already warns the model about). The moonshot adds a denial-defense pass: for each criterion the user is relying on, the engine predicts the SPECIFIC RFE/denial argument an adjudicator would raise and the exact evidence that pre-empts it, grounded in the criterion's legal basis from the ValidationRecord (8 CFR 214.2 / 204.5). It red-teams the petition before USCIS does, turning a static score into "here is how you would be challenged and how to win".

Path to implementation:
1. (current scaffold) Add a pure buildRfeAnticipationPrompt(criteria, classification) in qualification.ts that, per relied-on criterion, asks the model for {criterion, likelyChallenge, preemptiveEvidence, severity}; reuse extractJson and a strict parser mirroring parseQualifyResponse, with a deterministic mock keyed off each pack criterion's gap copy.
2. Inject validationFor(classification).legalBasis and sources into the prompt so each predicted challenge cites the regulation it stems from — making the warning authoritative, not generic.
3. Surface a "Defend this case" section in CriteriaReport listing each likely challenge as an actionable, severity-ranked card with the specific evidence to add (wired to the evidence-vault gap it closes via summarizeVault).
4. Run it on its own token-charged route via executeAiOperation (mirroring /api/qualify), so it composes with the existing rfe responder feature.
5. Feed accepted challenges into the Draft Studio prompt so the generated petition language proactively addresses them.

If we ship it: the product moves from "do I qualify?" to "will I survive adjudication?" — the question worth thousands in attorney time — creating a defensible moat of adjudication-shaped intelligence that compounds as real RFE patterns are folded back in.

**Why now:** This is a 10x bet because preventing an RFE or denial is worth orders of magnitude more to a user than a likelihood number, and it is the exact value an immigration attorney sells. The pieces are present — packs encode the criteria, validation.ts supplies the legal basis to cite, and the rfe feature already models RFE responses — so this is a new orchestration over owned data, not new infrastructure. Now is the time because the validation layer just made each criterion's legal grounding queryable, which is what makes the predicted challenges credible.


### 9. Live regulatory-drift watch over cited primary sources
- **Idea ID:** `6428f1ad-2cc4-4cd3-a11a-a1c024ea537e` · **Category:** functionality · **Effort 7 / Impact 9 / Risk 6** (Value 5)

The validation framework is a genuine moat — every program and compliance claim carries a dated, cited ValidationRecord with primary-law/agency-guidance sources, a CI gate, and a weekly freshness job — but it is a STATIC snapshot: lastVerified is a hardcoded date and freshnessOf only tells you a record is OLD, never whether the cited law actually CHANGED. The moonshot makes correctness live: a watcher fetches each ValidationRecord.sources[] URL (eCFR, USCIS Policy Manual, GOV.UK — all already enumerated), fingerprints the relevant text, and when 8 CFR 214.2 or 204.5(h)(3) actually changes it auto-flips that record from verified to needs-review, posts a precise diff, and blocks the program from staying "live" until re-verified. Re-verification stops being a calendar reminder and becomes event-driven from the primary source itself.

Path to implementation:
1. (current scaffold) Extend scripts/check-validation-freshness.ts into a fetch-and-fingerprint pass: for each record's sources[], GET the URL, extract the cited section text, hash it, and write a baseline hashes file committed alongside validation.ts.
2. Add a drift detector that re-fetches, compares to the baseline hash, and emits a Markdown drift report (changed source, record, legalBasis) reusing the existing report-and-exit-nonzero shape.
3. Wire it into the existing .github/workflows/validation-freshness.yml so a regulatory change opens/updates the same tracking issue the freshness job already manages — now triggered by the LAW changing, not the clock.
4. Add a runtime degraded-state: when a record is drift-flagged, the /validation page shows a "source changed — under re-review" banner and isLiveProgram gates the affected program out of /qualify until re-verified.
5. Expose the combined drift and freshness state as a signed, public compliance receipt others can verify.

If we ship it: "is this still legally correct?" becomes a continuously-proven, auditable property no competitor can fake — a trust moat that turns the compliance ledger from documentation into live infrastructure and underwrites every downstream draft and filing.

**Why now:** This is a 10x bet because it converts the validation layer from a static promise into a self-proving, event-driven trust system — the most defensible asset for a legal-paperwork product where being silently out-of-date is catastrophic. The scaffold is unusually ready: sources are already enumerated with URLs, the freshness script and CI workflow exist, and isLiveProgram already gates programs, so step one merely extends an existing script. Now is the moment because the source list and CI plumbing just stabilized, making the jump from "dated" to "live-monitored" small in effort but category-defining in trust.


## Evidence & Case Management

### 10. Exhibit-cited petitions: fuse the vault into every draft
- **Idea ID:** `71f92350-2c6e-43f7-86cc-83605c44abcf` · **Category:** functionality · **Effort 6 / Impact 10 / Risk 4** (Value 10)

Today the Drafting Studio argues only from the static criteria evidence/rationale (drafting.ts) while the evidence vault stores the actual extracted facts and a monotonic exhibit number per document (evidence.ts, addCaseDocument) - two disconnected islands. This moonshot fuses them: the draft prompt is fed each criterion's real vault exhibits and their extracted facts, the model is required to cite '(Exhibit N)' inline for every factual claim, and the system emits a self-consistent petition letter PLUS a matching numbered exhibit index where every citation provably resolves to a document in the vault. A USCIS officer can follow each argument straight to its proof, and the applicant can never ship a letter that cites evidence they do not actually have.

Path to implementation:
1. In buildDraftPrompt (drafting.ts), accept an optional per-criterion exhibits array (exhibit number + name + extracted facts) sourced from getCaseDocuments grouped by criterion, and inject it inside the existing <<<CASE_DATA>>> fence so the strict citation discipline already in the prompt now binds to real exhibits - shippable this sprint behind a flag.
2. Extend the draft route's DraftRequest assembly to call the EvidenceAdapter (resolveCase-gated getCaseDocuments) and attach exhibits per criterion before prompting.
3. Add a citation-integrity validator (pure, unit-testable beside tryParseSections) that parses '(Exhibit N)' tokens out of each section body and rejects/flags any citation with no matching vault exhibit.
4. Render an auto-generated Exhibit Index section in the draft preview and the packet export, with bidirectional links between letter citations and vault rows.
5. Recompute and surface a 'citation coverage' meter (claims backed by an exhibit vs. unbacked) on the case file.
6. Persist the citation map alongside the draft version so re-files/removes in the vault flag now-broken citations.
If we ship it: the petition letter and the evidence vault stop being two products and become one verifiable argument graph - the defining feature no template-based competitor can copy without rebuilding their entire evidence model.

**Why now:** The whole value of an O-1A petition is arguments tied to specific exhibits, yet the draft and the vault never touch - closing that seam turns generic AI prose into filing-grade, officer-followable work product, a 10x leap in defensibility. The pieces (extracted facts, exhibit numbers, strict-citation prompt, resolveCase gate) already exist, so the first step is a one-sprint prompt+route change. Now is the moment because the adapter layer just centralized gated vault access, making the cross-feature wiring safe.


### 11. Adversarial USCIS examiner: simulate the RFE before you file
- **Idea ID:** `ba776406-3b28-460d-81b5-3b338897a62c` · **Category:** user_benefit · **Effort 6 / Impact 9 / Risk 5** (Value 7)

Add a synthetic 'examining officer' that adversarially pre-adjudicates a case before it is filed. It reads the scored criteria, the vault coverage/gaps (summarizeVault), the draft, and the review thread, then returns - per criterion - an RFE-issuance probability, the exact deficiency an officer would cite, and the specific exhibit or argument that would cure it. Unlike evidence strength scoring (which rates documents you have), this models the adjudicator's adverse reading: where the narrative is thin, where 'sustained acclaim' is asserted but not proven, where two exhibits contradict. The output is a defensible pre-filing risk dossier appended to the append-only review log, so the attorney signs with eyes open and the applicant fixes the weakest criterion first.

Path to implementation:
1. Add a pure 'adjudication' module (mirroring drafting.ts/evidence.ts: buildAdjudicationPrompt + tryParseAdjudication + deterministic mock) that takes criteria + VaultSummary + draft sections and asks the model to role-play a skeptical USCIS officer returning strict JSON of per-criterion {rfeRisk, deficiency, cure} - the prompt and parser are unit-testable this sprint with zero new infrastructure.
2. Wire a /api/cases/[id]/pre-adjudicate route through executeAiOperation (charge + rate-limit + graceful mock already provided) and the resolveCase gate.
3. Surface a 'Pre-flight review' panel on CaseDetailView next to the roadmap, with a single headline RFE-risk score and per-criterion red/amber/green findings.
4. Record each adjudication as a typed event in the case_reviews log (new ReviewKind 'adjudication') so risk over time is auditable and the attorney sees it inline.
5. Block or hard-warn submitForReview when headline risk is above a threshold, turning the gate into a quality bar.
6. Feed cures back into the gap-closing checklist so the dossier is actionable, not just diagnostic.
If we ship it: the product stops being a drafting tool and becomes the thing that tells you whether you will actually get approved - the category-defining promise ("see your RFE before USCIS does") that anchors the entire brand.

**Why now:** RFEs and denials are the single greatest fear and cost in this market; a tool that predicts the officer's adverse findings per criterion before filing is a 10x shift from 'help me write' to 'tell me if I will win' - worth a premium and impossible to ignore. Every input it needs (criteria, vault gaps, draft, review log) already exists in this group, and executeAiOperation makes the charged AI call a declarative spec, so the first pure module ships in one sprint. Now is right: the criteria/vault/draft surfaces just matured, so the adversarial pass has real signal to read.


### 12. Expert letter engine with secure recommender intake
- **Idea ID:** `c20a8f12-f8d0-4251-8afe-ea5b30ed339b` · **Category:** functionality · **Effort 7 / Impact 9 / Risk 6** (Value 5)

Recommendation letters from recognized experts are the single highest-leverage exhibit in an O-1A/EB-1A case, yet the vault can only ingest documents the applicant already has - there is no machinery to produce or collect them. This moonshot adds an expert-letter engine: for each criterion it drafts a tailored support-letter addressed to a specific named recommender (grounded in that criterion's vault facts via the same citation discipline as drafting.ts), then mints a secure, time-boxed, single-case intake link the outside recommender opens to review, edit, and upload their signed letter - which flows straight back into the vault as a numbered exhibit, classified to the right criterion. The applicant orchestrates a letter campaign instead of chasing email attachments.

Path to implementation:
1. Add a pure 'recommender' module beside drafting.ts (buildRecommenderLetterPrompt + parser + mock) that produces a per-criterion, per-recommender letter draft from the criterion's vault facts - shippable and unit-testable this sprint.
2. Introduce a case_grants-style scoped token (the same time-boxed, single-case access seed already proposed for delegated sharing) whose role is 'recommender', resolved through resolveCase so the outside party can ONLY see and contribute to that one criterion's intake - never the case.
3. Build a minimal public intake page that validates the token, shows the pre-drafted letter, and accepts an edited/signed upload that calls addCaseDocument with an auto exhibit number and source 'recommender'.
4. Add a recommender tracker to the case file (invited / opened / signed) driven by the append-only access log.
5. Notify the applicant and advance the roadmap when a letter lands; feed letter coverage into the readiness/gap surfaces.
6. Watermark and provenance-stamp each received letter so its origin is auditable.
If we ship it: outside experts are pulled INTO the product as participants, creating a referral surface and a collected-letters moat - the platform shifts from a solo drafting tool to a multi-party case-building network.

**Why now:** Expert letters decide these cases and are the worst part of the process to manage manually; owning the draft-route-collect loop is a 10x workflow elimination AND a network-effect wedge as every recommender touches the product. It reuses the strict-citation drafting pattern, the vault's addCaseDocument exhibit pipeline, and the resolveCase gate (extended with a scoped recommender grant), so the first letter-drafting module is a one-sprint pure addition. Now is the time because the gate was just centralized, making scoped outside access safe to introduce.


## Identity & Access

### 13. Court-admissible attestation chain for consent & filings
- **Idea ID:** `dd180aef-ecbe-4537-8407-a09e69705a15` · **Category:** user_benefit · **Effort 7 / Impact 9 / Risk 5** (Value 6)

The consents table already captures version, IP, user-agent and timestamp at first auth, but it is WRITE-ONLY — nobody reads it back, and a free-form edit to any row would be undetectable. For an immigration product where a false statement on a USCIS filing is a federal offense, the chain of who-attested-what-when is the single most legally load-bearing asset. Turn the append-only consent/review logs into a tamper-evident, hash-chained attestation ledger: every consent acceptance, every attorney sign-off (the 'signed'/'filed' review events in transitionCase), and every applicant fact-affirmation is recorded as a record whose hash includes the prior record's hash, optionally anchored to an external timestamp authority (RFC 3161) or a public Merkle root. The user (and their attorney, and USCIS if subpoenaed) can then export a verifiable PDF proving the exact consent text, version, and signer at a moment in time.

Path to implementation:
1. In the current scaffold, add a prev_hash + record_hash column to the consents table (and case_reviews) in both pglite-store.ts and firestore-store.ts, and compute record_hash = sha256(canonical(payload) + prev_hash) inside the existing upsertProfileWithConsent / transitionCase transactions so the chain is written atomically.
2. Add a Store.verifyAttestationChain(userId|caseId) that re-walks the chain and returns the first broken link (or 'intact').
3. Surface a 'Download signed attestation' action that renders the verified consent + signer chain as a sealed PDF (reuse the existing brand/Stamp + PDF generation).
4. Add periodic anchoring: hash the latest Merkle root to a trusted timestamp authority (or commit it to an append-only external log) on a schedule.
5. Expose verification publicly so a third party can independently confirm a filing's attestation without trusting our database.

If we ship it: every petition leaves the platform with a cryptographically provable consent-and-sign-off history, making the product the trusted system-of-record that bar associations and applicants choose precisely because the legal record cannot be quietly altered — a trust moat competitors with plain audit logs cannot match.

**Why now:** In a legal product the integrity of the consent/sign-off record IS the product's defensibility; converting an unread write-only table into a court-admissible, independently-verifiable attestation chain is a 10x trust differentiator, not a polish. Now is the time because the consent and review writes already happen inside single atomic transactions (upsertProfileWithConsent, transitionCase), so hash-chaining slots in at exactly those choke points with minimal new surface.


### 14. Passkey identity bound to bar license & applicant docs
- **Idea ID:** `aeb2df57-7a85-4414-a413-94acfb7dbafd` · **Category:** functionality · **Effort 8 / Impact 9 / Risk 6** (Value 4)

Auth today is a single Firebase Google popup minting a 5-day cookie, with role decided by an env email allowlist and zero step-up. For a product that moves federal immigration filings and applicant PII, that is both too much friction (Google-only) and too little assurance (no proof the attorney is really bar-licensed, or that the applicant is the person on the passport). Make identity itself the breakthrough: phishing-resistant passkeys (WebAuthn) as the primary credential, layered with verifiable proofs that bind a real-world status to the account — an attorney's account is bound to a verified bar number/state, and an applicant can optionally bind a government-ID / passport verification. High-risk actions (attorney 'sign' and 'file' transitions) then require a fresh passkey step-up, so a stolen cookie can never file a petition.

Path to implementation:
1. In the current scaffold, add a 'credentials' table + Store methods and a /api/auth/passkey register/authenticate route pair alongside the existing /api/auth/session route, minting the SAME httpOnly session cookie via the existing Firebase custom-token path so getUser() is unchanged.
2. Add a step-up gate: extend authorizeRoute / the review server actions so the 'signed' and 'filed' transitions require a recent WebAuthn assertion (a freshness claim in the session), reusing the existing fail-closed Authorized union.
3. Bind attorney bar verification: a one-time bar-number + state check (manual or via a state-bar API) stamped onto the credential, replacing isConfiguredAttorney's env allowlist with a verified flag on the identity.
4. Add optional applicant ID verification (document/selfie via a KYC provider) recorded against the profile, surfaced as a 'verified applicant' seal in the brand UI.
5. Offer passkey + verified credential as the default door on the login page, keeping Google as a fallback.

If we ship it: signing in is one tap and unphishable, every attorney sign-off is provably made by a license-verified human with a fresh credential, and the platform becomes the place where immigration identity is cryptographically trustworthy end-to-end — a security and trust posture no Google-only competitor can claim.

**Why now:** This simultaneously removes sign-in friction (one-tap passkeys vs a Google popup) and closes the highest-stakes gap — that nothing today proves an attorney is licensed or that a signer wasn't a stolen cookie — which is exactly the assurance a federal-filing product must own. Now is the right time because the session mint already funnels through one route and getUser(), so a passkey path and a step-up freshness claim can be added at those single seams without rewriting how the app reads identity.


### 15. Attorney Marketplace: firms, seats & licensed-counsel matching
- **Idea ID:** `38d2d4dd-cec9-4bad-aaed-66fd8f0ecbf5` · **Category:** functionality · **Effort 9 / Impact 10 / Risk 7** (Value 4)

Today an attorney is a single global env allowlist (ATTORNEY_EMAILS / isConfiguredAttorney) and getCaseAnyOwner lets ANY allowlisted email open EVERY applicant's case. Replace that single-tenant binary with a real multi-firm identity graph: Firm -> Seats (attorneys, verified by bar number + state) -> per-case Engagement that explicitly binds ONE firm to ONE case. Every applicant who reaches Attorney Review is then matched to (or chooses) a licensed firm from a marketplace; the firm sees only its engaged cases, and the platform takes a per-filing fee or seat subscription. This turns a hard-coded reviewer into a two-sided network where supply (immigration attorneys) and demand (O-1/EB-1 applicants) both onboard themselves.

Path to implementation:
1. In the current scaffold, add a 'firms' and 'firm_members' table to the Store interface (store.ts) with parallel Firestore + PGlite implementations, plus an 'engagements' table (case_id, firm_id, status) — mirroring the existing dual-driver pattern used for cases/criteria.
2. Extend authorizeRoute's RoutePolicy/AuthzDeps (authorizeRoute.ts) so the attorney fallback resolves an ENGAGEMENT for (firm of user) x caseId instead of the global isConfiguredAttorney check, keeping the same fail-closed Authorized union and existing tests.
3. Replace getCasesInReview() (today an unfiltered global queue) with getCasesForFirm(firmId) so a firm sees only engaged cases; gate the /dashboard/review page on firm membership.
4. Add a self-serve firm-onboarding flow (bar number + state + email-domain verification) reusing the /welcome consent scaffold and Store.upsert pattern.
5. Add applicant-facing attorney selection at the 'submit for review' transition, writing an engagement row inside the existing transitionCase atomic unit.
6. Layer marketplace economics: per-filing platform fee via the existing token/Polar ledger, attorney ratings, and SLA timers.

If we ship it: the product stops being one app with one lawyer and becomes the marketplace where every independent immigration attorney in the US plugs in — a two-sided network whose value compounds with each firm and each filed petition, which no single-tenant competitor can replicate.

**Why now:** This converts the weakest part of the identity model (a global env allowlist that is also a cross-tenant PII-leak surface) into the product's defining network-effect moat: a two-sided marketplace of licensed counsel. Impact is category-defining (new revenue line + supply-side flywheel), and now is the moment because authorizeRoute (ADR-0006) already centralizes the exact decision point that must change, so the blast radius is one helper plus the Store, not every route.


## Marketing & Design System

### 16. Instant Verdict: anonymous engraved screening in the hero
- **Idea ID:** `7bcbb15a-7bac-4132-9034-70f986566021` · **Category:** functionality · **Effort 5 / Impact 9 / Risk 4** (Value 9)

Today the landing's gorgeous Seal/Guilloche/Stamp brand is pure decoration and every CTA hard-links to /qualify behind a sign-in wall, hiding the product's one magical asset (the 8-criteria scoring engine) until AFTER the visitor has already decided. The moonshot collapses the funnel: paste your CV or LinkedIn bio into the hero and watch an engraved 'Certificate of Extraordinary Ability' assemble live in front of you -- guilloche rings drawing in, each criterion getting Met/Strong/Partial stamped on, a bordeaux likelihood seal pressing down -- with zero signup. The qualification engine already runs fully offline via mockQualification() (deterministic, keyless, no DB) and the real model behind it, so the verdict is instant and the brand primitives finally BECOME the product instead of framing it.

Path to implementation:
1. Add an unauthenticated screening path: a /api/qualify/preview route (or a preview flag) that runs parseQualifyRequest + mockQualification + buildQualifyResult only -- no charge, no rate-limit-by-user, no persist -- reusing the exact pure functions in features/qualification/qualification.ts.
2. Build a client <InstantVerdict> hero block: a textarea + classification picker (packs.ts CLASSIFICATIONS) that POSTs and renders the result by reusing CriteriaReport, but skinned as a certificate using Seal, Guilloche, Stamp and the stampIn motion variant.
3. Animate the reveal stage-by-stage with the existing easeArrival/stampIn language so each criterion 'stamps' in sequence -- the PetitionStepper press effect applied to a real result.
4. Gate the deep value (full evidence, gap plan, save) behind a single soft sign-in CTA that pre-fills the just-entered profile into the authenticated /qualify, so nothing is re-typed.
5. Instrument the funnel (paste -> verdict -> sign-in) to measure lift vs the current brochure hero.

If we ship it: the landing stops describing the product and starts BEING it -- the first 20 seconds deliver a personalized, branded verdict no competitor's brochure can match, turning the brand system into a conversion engine and the site's defining moment.

**Why now:** This is a 10x bet because it converts a static brochure into a live demo of the single most differentiated capability in the product, using machinery that already runs keyless and offline -- so the wow-factor is huge while the first step (a no-charge preview route over existing pure functions) ships in one sprint. Top-of-funnel personalization at this fidelity is the difference between a category-defining storefront and another landing page, and it's the highest-leverage change this group can make right now.


### 17. Programmatic SEO atelier: a page per visa x profession
- **Idea ID:** `5acb9648-469c-4324-9b31-b484ca23b81e` · **Category:** functionality · **Effort 6 / Impact 8 / Risk 4** (Value 6)

The marketing site is just four hardcoded pages, so the product is invisible to the thousands of monthly searches like 'O-1 visa for software engineers' or 'EB-1A criteria for designers' where high-intent applicants actually are. The moonshot turns the design system into a content engine: a single brand-styled template generates a static page for every (classification x profession x jurisdiction) combination -- each rendered in the full Atelier identity, showing that classification's real criteria from packs.ts, profession-tuned evidence examples, FAQPage + Service JSON-LD for rich results and AI-answer eligibility, and an embedded Instant Verdict so the visitor screens themselves on the page they landed on. The taxonomy already exists: packs.ts encodes O-1A/O-1B/EB-1A/UK-Global-Talent and their criteria, and jurisdictions.ts gates which are live -- so the matrix is data, not hand-written copy.

Path to implementation:
1. Add a typed content map of professions (engineer, researcher, founder, designer, artist...) and per-(classification, profession) evidence/example snippets, sitting alongside packs.ts as the page data source.
2. Build one /visa/[classification]/[profession] route using generateStaticParams over livePrograms() x professions, reusing PageFrame + ChapterMark + the criteria layout so every page is on-brand and statically generated.
3. Emit per-page Metadata + FAQPage/Service JSON-LD and wire a generated sitemap.ts so Google and AI answer engines can index the full matrix.
4. Embed the Instant Verdict screener and a Letters-Patent share CTA so each SEO page converts and feeds the viral loop, not just ranks.
5. Start with one live classification x five professions to validate indexing and conversion, then fan out the matrix.

If we ship it: the product owns the long tail of extraordinary-ability search with hundreds of beautiful, self-screening landing pages, creating a compounding organic-acquisition moat that scales with the criteria data instead of with marketing headcount.

**Why now:** This is a 10x bet because organic search is the dominant discovery channel for high-intent visa applicants and the product currently captures none of it; the criteria taxonomy needed to generate the entire matrix already exists as structured data in packs.ts and jurisdictions.ts. The first slice (one classification x five professions) ships in a sprint and proves the loop, after which the moat compounds page-by-page at near-zero marginal cost -- exactly the kind of strategic asset that defines a category.


### 18. Shareable Letters Patent: a viral, sealed proof-of-ability card
- **Idea ID:** `ebee7724-8a6d-4878-939b-273a76b35ada` · **Category:** user_benefit · **Effort 6 / Impact 8 / Risk 4** (Value 6)

Every qualification result dies inside the dashboard. The moonshot mints each screening as a public, beautifully engraved 'Letters Patent of Extraordinary Ability' at /c/[token] -- the petitioner's name in Fraunces, a guilloche-ringed likelihood seal, the criteria stamped as a coat-of-arms, and a unique per-result Open Graph image (rendered server-side from the SAME Seal/Guilloche/Stamp primitives via Next ImageResponse) so it unfurls as a stunning card on LinkedIn and X. Distinct from a single static /og.png: this is a unique, person-specific certificate per result, engineered to be posted ('92% likely to qualify for an O-1 visa'). Because the brand is already pure inline-SVG that inherits currentColor and re-skins from globals.css tokens, the same engraving renders identically in the DOM and in the OG image.

Path to implementation:
1. Add an opt-in share toggle to a screening result that creates an immutable public snapshot (likelihood, classification, criteria statuses only -- no profile text) keyed by an unguessable token, persisted through the existing petition data adapter.
2. Build the public /c/[token] route reusing PageFrame + Seal + Guilloche + Stamp + CriteriaReport, with a prominent 'Run your own free screening' CTA back into Instant Verdict.
3. Add a /c/[token]/opengraph-image route using Next ImageResponse that draws the seal, the likelihood number, and the stamped criteria in brand fonts/colors -- the certificate as a 1200x630 card.
4. Add 'Share to LinkedIn' / copy-link affordances and a tasteful watermark so reshared images always route back.
5. Track share -> visit -> new-screening as a first-class viral loop metric.

If we ship it: every applicant becomes a branded billboard and each share recruits the next applicant, giving the product a compounding, zero-CAC acquisition loop that a brochure site can never produce -- the network-effect moat.

**Why now:** This is a 10x bet because it converts a one-and-done private result into a self-propagating acquisition channel: high-achievers love to share validation, and a gorgeous sealed certificate of 'extraordinary ability' is inherently postable. The brand primitives are already inline-SVG and token-driven, so rendering the certificate both in-page and as a per-result OG image is achievable now -- and shipping it turns the design system from cost center into the growth engine.


## Petition Drafting & Document Generation

### 19. Adjudicator redline: self-critique scores & fixes weak sections
- **Idea ID:** `db31ae71-a37e-4155-9e47-f40590d60700` · **Category:** functionality · **Effort 5 / Impact 8 / Risk 4** (Value 7)

Drafting today is one-shot: generate, then the user edits raw textareas with no signal about which sections are weak. The moonshot adds an adjudicator critique pass � a second model call that grades each generated section against the O-1A regulatory standard and the citation-discipline rules already encoded in buildDraftPrompt (no fabrication, no case law, evidence-grounded), returning a per-section score, a specific weakness, and a ready rewrite. Weak sections surface as inline redline cards with a one-click Apply that swaps in the improved body and saves it as a new non-destructive version through the existing merge-by-heading persist path. This turns a single generation into a measurable, iterative quality loop instead of a wall of editable text.

Path to implementation:
1. Add buildCritiquePrompt + tryParseCritique in drafting.ts that take the just-generated sections and return JSON [{heading, score, weakness, improvedBody}] reusing the extractJson/toSection parsing discipline and a deterministic mock so the keyless build works.
2. Add a /api/draft/critique spec via executeAiOperation (heavy tier), owner-gated exactly like draftSpec, that never persists by itself.
3. In DraftStudio render a per-section score chip and, on low scores, a redline card showing weakness + improvedBody.
4. Wire Apply to the existing focus-regenerate persist path (draftOperation merge-by-heading) so an accepted fix becomes a new draft version � no new persistence code.
5. Show an overall draft quality score that rises as fixes are applied, persisted per version for the attorney review queue.
6. Let the attorney trigger critique on demand from the review view, making the score the queue sort key.

If we ship it: drafting becomes a self-improving loop where quality is visible and trending upward, the attorney review queue can prioritize by machine-graded weakness, and the product earns the reputation of producing filing-ready briefs rather than first drafts.

**Why now:** A critique-and-revise loop is how the best AI writing systems reach professional quality, and here it rides entirely on assets that already exist: the regulatory rules in the prompt, the strict JSON parsing, versioned drafts, and the section-merge persist path � so a transformational quality jump costs little net-new architecture. It is a 10x bet because it converts opaque one-shot output into a measurable, attorney-prioritizable quality signal, the single biggest driver of trust and conversion for paid legal work product. Now is right because versioning and section regenerate just shipped, leaving only the critique layer to add.


### 20. RFE Risk Radar: predict the RFE before USCIS sends one
- **Idea ID:** `6559363f-99ff-40d5-9aab-78d048f3f882` · **Category:** user_benefit · **Effort 6 / Impact 9 / Risk 5** (Value 7)

The system already scores each criterion (Met/Strong/Partial/None) and, via rfe.ts, knows how to draft a response to a USCIS Request for Evidence. Invert that machinery: at draft time run an adjudicator-simulation pass that predicts which criteria a real USCIS officer is most likely to challenge (the Partial/thin ones, the ones leaning on weak evidence) and pre-emptively hardens those sections � so the petition ships already inoculated against its most probable RFE. Each predicted challenge becomes a ranked Risk Radar card with a one-click Reinforce action that regenerates the targeted section with the strongest available evidence.

Path to implementation:
1. Add buildRfeForecastPrompt in rfe.ts that takes the same criteria the responder uses and returns ranked predicted-challenge JSON {criterion, likelihood, why, suggestedEvidence}; reuse tryParseSections-style strict parsing and the deterministic mock fallback so the keyless build still demos.
2. Wire a new /api/rfe/forecast spec through executeAiOperation (a light/heavy tier op) reusing the exact owner-or-attorney resolveCase gate the RFE route already has.
3. Render a Risk Radar panel on the case/draft view: ranked cards colored by likelihood, each linking to the criterion.
4. Wire each card Reinforce button to the existing /api/draft focus=section regenerate so a predicted weakness is fixed in one paid click and saved as a new draft version.
5. Persist a pre-filing risk score per draft version so users watch their risk fall as they reinforce.
6. Aggregate anonymized predicted-vs-actual RFE outcomes to continuously calibrate the forecast.

If we ship it: the pitch shifts from we help you write the letter to we strengthen your petition before you file and cut your RFE odds � a quantified, fear-killing value prop that justifies premium pricing and creates a data flywheel (every real RFE outcome sharpens the predictor for everyone).

**Why now:** Predicting and pre-empting the RFE is the outcome immigrants actually fear and pay for, and no consumer tool does it � yet every ingredient (scored criteria, an RFE prompt model, section-level regenerate, versioned drafts) already exists to assemble it. It is a 10x bet because it moves the product from reactive drafting to proactive outcome-shaping, and the predicted-vs-actual loop becomes a defensible data moat. Now is the moment because the RFE responder just landed, so inverting it is incremental code for transformational positioning.


### 21. Exhibit-bound brief: every claim cites its vault exhibit
- **Idea ID:** `435ba786-1605-40e3-81dc-7e36d134da04` · **Category:** functionality · **Effort 6 / Impact 9 / Risk 5** (Value 7)

Today buildDraftPrompt and buildRfePrompt argue only from the inline criteria[].evidence/rationale strings, while the evidence vault (StoredDocument in features/evidence, the /api/evidence/categorize route) already holds an exhibit number and model-extracted facts[] per criterion � yet the drafted letter never references a single Exhibit. The moonshot joins the vault into drafting so the model must attach an [Ex. N] citation to every factual assertion, and the parser flags any sentence with no backing exhibit as UNSUPPORTED � ATTORNEY MUST VERIFY. The result is the only AI petition brief where every factual sentence is exhibit-traceable and every unbacked claim is visibly quarantined, exactly the discipline a USCIS adjudicator (and a malpractice-averse attorney) demands.

Path to implementation:
1. In draftOperation.ts parse, when caseId resolves, also load petitions/evidence vault docs and pass a compact [{criterion, exhibit, facts[]}] table into a new buildDraftPrompt overload (the criteria read seam at petitions.getCriteria already exists).
2. Extend the prompt contract so each section body interleaves [Ex. N] tags and the JSON shape gains a per-section claims[] of {text, exhibit|null}; extend toSection/tryParseSections to carry exhibit refs without breaking the existing shape.
3. In DraftStudio, render [Ex. N] as inline chips linking to the vault doc, and render claims with exhibit:null as a bordeaux UNSUPPORTED stamp the attorney must clear.
4. Add a coverage meter (claims cited / total) persisted on the draft version so reviewers see citation completeness over time.
5. Mirror the same exhibit-binding into the RFE responder (rfe.ts already shares tryParseSections).
6. Generate an Exhibit Index appendix from the cited set for the filing packet.

If we ship it: the product stops being a text generator and becomes the system of record for evidence-to-argument traceability � a compounding moat because every uploaded exhibit makes every future draft more cite-complete, and no competitor without the vault join can replicate it.

**Why now:** This is a 10x bet because it converts the riskiest part of an immigration filing (unsupported assertions that trigger RFEs or UPL exposure) into a visible, enforced, machine-checked invariant � turning the letter into auditable work product rather than prose. The data (exhibit numbers, extracted facts) and the prompt/parse seams already exist, so the magnitude of trust gained vastly exceeds the build cost. Now is right because evidence categorization just shipped, so the vault is finally rich enough to cite.

