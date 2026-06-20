# L1 synthesis — Immigration Concierge · 20-Character simulated-UAT sweep · 2026-06-20

**Cert level:** L1 (theoretical / code-grounded — no browser). **Engine for deferred-to-L2 paths:** real Claude (`LLM_ENGINE=claude`). Reads all 20 per-Character findings JSONs + reports, dedupes, ranks by **impact (frequency x reachability x trust_erosion)**, not raw severity. Citations `file:line`. BACKLOG/accepted-gap items referenced by id.

---

## 1. Headline scorecard

| Metric | Value |
|---|---|
| Characters | **20** (8 segments: arts/O-1B, EB-1A self-petition, O-1A tech/founder, attorney/ops, intake/paralegal, athlete, prospects/buyers) |
| Journeys walked | **74** |
| Per-journey verdict | **48 L1-pass / 26 L1-conditional / 0 L1-fail** |
| Findings total | ~170 (~70 strengths) |
| blocker / major roots / minor | **1 / ~7 / ~55** |

**Zero L1-fail** — every journey completes structurally; designed-sound end to end. The 26 conditionals cluster on three reachable surfaces: keyless preview/best-path, the DraftStudio O-1A copy, ops/attorney queue-age+reachability. The lone blocker is segment-confined (a GC security diligence). Dedup collapses ~18 raw majors to ~7 themed roots; each names all reporters.

---

## 2. Cross-cutting themes (deduped, impact-ranked)

> Impact = frequency x reachability x trust_erosion. The keyless first-screen defects (T1/T3/T4) hit every cold run. A themed "minor" on the first screen of every run outranks the segment-confined blocker.

### T1 — Best-path/keyless picks the path with a keyword mock, not the model · HIGH (H/H/H) · MAJOR
`recommendBestPath -> scoreAllPrograms -> mockQualification` scores EVERY program with the deterministic keyword regex even under `LLM_ENGINE=claude` — no model, no charge, no persistence (`best-path.ts:75-98`, `api/qualify/preview/best-path/route.ts:11-18,57`). `rationaleFor()` emits only a templated margin line (`best-path.ts:119-135`); all packs share threshold 3 + an identical likelihood formula (`packs.ts:97,142`, `qualification.ts:241-242`), so it is a keyword margin-sort with ZERO classification-vs-classification reasoning (self-flagged `best-path.ts:13-14`). Two confirmed modes: (a) under-scores non-default profiles — composer "composed the score" misses O-1B Lead-role (`packs.ts:106`, ng-qual-01); chef Michelin/Beard miss (`packs.ts:106,124,130`, dm-qual-01); director misses O-1B Lead-role but HITS O-1A Critical-role -> read as business (`packs.ts:79,106,124`, lf-qual-02); game director O-1B ranks last, EB-1A recommended (YT-QV-01); designer design-system drops from O-1B (ac-qv-01/02); athlete podium/coach/sponsorship miss (`packs.ts:38-43,77-88`, MB-QV-01); architect biennale -> Press (`packs.ts:51,153-158`, il-qual-01). (b) no "EB-1A is the higher bar" candor — green card framed as a sweetener (`best-path.ts:120-121`), opposite of the final-merits warning a senior intake memo gives (OA-QV-01).
**Reporters (15):** YT-QV-01, ac-qv-01/02, lf-qual-02, ng-qual-01, dm-qual-01, OA-QV-01/02, MB-QV-01, kw-qualify-02, il-qual-01, gm-qual-01, dt-qual-01, fam-qual-01, YT-QV-02.
**Fix:** model-back best-path on the auth path (+ explicit O-1A/O-1B/EB-1A trade-off w/ EB-1A higher-bar note), or give best-path the prominent "keyword pre-read" caveat the hero SoftGate has (`InstantVerdict.tsx:273`) and it lacks.

### T2 — Queue-age badge reads the wrong clock + no aging signal/role reachable for ops · HIGH (H/M-H/H) · MAJOR
Queue feeds `submittedAt = c.createdAt` (case creation), not time-in-queue; `getCasesInReview` orders by `created_at asc` (`review/page.tsx:35`, `dashboard/page.tsx:37`, `pglite-store.ts:433`). `transitionCase` into Review updates only status + `updated_at`, never `created_at` (`pglite-store.ts:501`). The age machinery (`queue-age.ts:26-74`) is correct + tested — ONLY the input timestamp is wrong: a 9-day-old file submitted an hour ago shows red "overdue" and sorts top. A better source exists: the `submitted` event `created_at` (`reviews.ts:35`) or `cases.updated_at` (omitted from `CASE_COLUMNS`, `pglite-store.ts:186`). Adjacent: no aging signal on any owner/ops board (real cases persist `targetFileDate:""`; gm-track-02, tv-track-01); no read-only ops tier — viewing the queue requires `ATTORNEY_EMAILS` which also grants sign/file (tv-attorney-02); non-navigable filtered CaseList rows (`CaseList.tsx:246,270`, gm-track-01); roadmap shows "Attorney review" current while still Drafting (`roadmap.ts:51`, tv-track-02).
**Reporters:** HP-REVIEW-01, tv-attorney-01, gm-track-02, tv-track-01, tv-attorney-02, gm-track-01, tv-track-02, fam-track-01.
**Fix:** derive badge + oldest-first sort from the `submitted` event ts (or expose `updated_at`); add per-case age on an owner board + a read-only ops tier + navigable rows.

### T3 — SCHOLARLY regex includes "conference" -> talk scored as a publication · HIGH (H/H/H) · MAJOR
The keyless mock SCHOLARLY regex includes `conference` (`packs.ts:71-76`). A KubeCon keynote / "conference talks" trips it -> "Scholarly: Met" on the hero, best-path, and categorize mock (`qualification.ts:225-238`, `evidence.ts:185-199`, `preview/route.ts:69`). Inflates the Met count on the FIRST screen a cold visitor sees. For a thin record: 3 Met -> `meetsThreshold:true` -> green "Meets threshold" + 62% (`criteria.ts:74-102`, WZ-QUAL-01) — the worst failure mode for a price-sensitive prospect. Propagates into a share cert minted from the hero (kw-share-02, WZ-SHARE-01).
**Reporters:** kw-qualify-01, WZ-QUAL-01, kw-evidence-01, kw-share-02, WZ-SHARE-01; adj. rm-qual-02 (society/fellow auto-Met), dt-qual-02 (ORIGINAL over-broad).
**Fix:** drop `conference` from SCHOLARLY (one edit fixes qualify + best-path + categorize + share).

### T4 — DraftStudio hardcodes "Draft a full O-1A petition letter" on non-O-1A cases · HIGH (H/H/M) · MINOR sev / MAJOR rank
Idle/error blurb is the literal "Draft a full O-1A petition letter from your scored criteria..." regardless of classification (`DraftStudio.tsx:374`; docstring `:40`). The prose IS parameterized (`drafting.ts:177`) and every other label pack-driven — copy drift, not a wrong pack — but for the Characters whose #1 anxiety is mis-classification, the UI says O-1A on their O-1B/EB-1A case. The `wrongCodes` gate scans generated `outputText` only, so this React copy is UNCOVERED (ao-draft-02, `EVALUATION.md:72`).
**Reporters (7 — every non-O-1A Character):** rm-draft-01, ao-draft-02, ng-draft-02, ac-draft-01, OA-DR-01, lf-draft-01, gm-draft-01. This "minor" OUTRANKS the T6 blocker — it fires every non-O-1A run on the trust-sensitive surface vs a blocker confined to one buyer segment.
**Fix:** interpolate the active `classification`; refresh stale docstrings.

### T5 — Landing positioning is tech-only; arts/culinary/athletics excluded, EB-1A invisible on `/` · MED-HIGH · MAJOR(chef)/MINOR
Audience ribbon: "For founders / engineers / researchers / designers" (no artists/chefs/athletes); hero subhead drafts from "CV, GitHub, press and publications" — a chef has no GitHub (`page.tsx:125,154,156`, `landing-claude/page.tsx:59-62,88`). Marketing frames "the eight O-1 criteria" throughout, never the O-1B arts six (`page.tsx:154,250,282`, `qualify/page.tsx:11`). "EB-1A" never appears on `/` though fully built — the green-card job is buried in /qualify or the FAQ (`page.tsx:133,199-210`, OA-EP-01).
**Reporters:** dm-eval-01 (major)/02, OA-EP-01, YT-EP-01, il-seo-01 / dm-prospect-03 / MB-QV-03 (no chef/architect/athlete SEO profession -> 404); adj. dt-eval-03, WZ-PROSPECT-01 ("Most of our candidates meet seven" + all-eight-green, no data).
**Fix:** balance audience/evidence copy (arts/culinary/athletics; "CV, press, reviews, awards"); name EB-1A on `/`; distinguish O-1A-8 / O-1B-6 / EB-1A-10; drop the "meet seven" boast.

### T6 — FAQ data-security claims unbacked by code; no privacy/terms/DPA page · BLOCKER (segment-confined)
`faq/page.tsx:55` claims AES-256 / TLS 1.3 / US servers / "every access logged" / no-train / "export or hard-delete everything". In code: no encryption impl (grep AES/encrypt/TLS = only this string); the only "export" is a case-LIST CSV (`export.ts:33`); no hard-delete/DSAR — only single-doc delete (`store.ts:260`, `pglite-store.ts:716`); no region pin; "every access logged" overstates a mutation-only audit subscriber to stdout (`audit-log.ts:22`). No `/privacy`, `/terms`, `/dpa`, `/security` route to bind it (PO-EVAL-02). Security-by-slogan — a GC blocker on the spot.
**Reporters:** PO-EVAL-01 (blocker), PO-EVAL-02, PO-EVAL-03.
**Fix:** match FAQ copy to the build (or scope "in production"), or implement + publish a privacy policy / DPA. L1-resolvable.

### T7 — Fabrication gate is numbers-only; misses qualitative fabrication · MED-HIGH · MAJOR(physician)/MINOR
`fabricatedSpecifics()` flags only money / percent / 4-digit-year / int >=100 (`adjudication-gates.ts:83-93,122`). A renamed/invented trial, a wrong phase (small int, ignored), a not-in-record society, or a nomination upgraded to a win carries no flaggable number and passes silently. Defense rests on the prompt rule (`drafting.ts:181`) + the attorney — weaker than "live adjudication" implies for medical/arts.
**Reporters:** ao-draft-01 (major), YT-DR-01 (IGF nomination -> won), HP-RFE-02; related fam-draft-01 (High-remuneration argued bare, not vs peers — an RFE magnet).
**Fix:** add a named-entity / award-status grounding-overlap warn, or document the numbers-only limit explicitly.

### T8 — Verdict-framing & disclaimer-parity gaps across client-facing surfaces · MED · MINOR
- **bc-org-01 (major/trust):** the DISCLAIMER rides the categorize PAYLOAD (`evidence.ts:205`) but is NEVER rendered on the Evidence Vault (grep disclaimer across `case-file/components` = zero); the exhibit index an intake coordinator forwards carries no on-screen UPL stamp (`EvidenceVault.tsx:24-30,120-292`). Fix: render `DisclaimerStamp` once on the vault card.
- **SI-QUAL-01 (minor/trust):** share cert `/c/[token]` stamps declarative "Qualifies" (`c/[token]/page.tsx:126`) vs in-app hedged "criteria supported / Meets threshold" (`CriteriaReport.tsx:58,86`) — the UPL hedge breaks on the most-forwarded surface; SI-EVAL-01: only a microprint disclaimer there. Fix: hedge the stamp + render the full DisclaimerStamp.
- **ng-draft-01 (major/missing):** the draft writes a section ONLY per Met/Strong criterion (`drafting.ts:83-85,204-205,664`); an under-scored criterion (a composer dropped Lead-role, T1) yields no section and NOTHING flags it — the attorney can get a letter missing the case's defining argument. Fix: surface a "strong-but-unscored, no section" nudge.

**Other per-segment items:** EB-1A file number minted with an "O1-" prefix (`petitions.ts:54`, il-track-01/rm-track-01); anonymous preview not covered by the live UPL tripwire (SI-QUAL-02, safe-by-construction but unproven); no profession/domain hint reaches the qualify prompt (dm-qual-02/ng-qual-02); no EB-1A/arts-hybrid draft framing (il-draft-02/lf-draft-03 — L2's).

---

## 3. Impact-ranked backlog (highest impact first — frequency x reachability x trust_erosion, NOT raw severity)

| # | Item | Sev | Theme | Fix | Reporters |
|---|---|---|---|---|---|
| 1 | Best-path/keyless picks the path with a keyword mock, no model, no reasoning — under-scores every non-default profile; no EB-1A higher-bar candor; on the first decision screen | major | T1 | model-back best-path on auth path, or prominent keyword-caveat + O-1A/O-1B/EB-1A trade-off | YT-QV-01, ac-qv-01/02, lf-qual-02, ng-qual-01, dm-qual-01, OA-QV-01/02, MB-QV-01, kw-qualify-02, il-qual-01, gm-qual-01, dt-qual-01, fam-qual-01, YT-QV-02 (15) |
| 2 | SCHOLARLY regex includes "conference" — a talk scores "Met", inflating the keyless count -> false eager-yes on the first screen (and into a shared cert) | major | T3 | drop conference from SCHOLARLY (one edit fixes qualify+best-path+categorize+share) | kw-qualify-01, WZ-QUAL-01, kw-evidence-01, kw-share-02, WZ-SHARE-01; adj. rm-qual-02, dt-qual-02 |
| 3 | DraftStudio hardcodes "O-1A petition letter" on every non-O-1A case — UI contradicts the case real pack on the trust-sensitive surface. (A "minor" outranking the #6 blocker: fires every non-O-1A run.) | minor | T4 | interpolate the classification; refresh docstrings | rm-draft-01, ao-draft-02, ng-draft-02, ac-draft-01, OA-DR-01, lf-draft-01, gm-draft-01 (7) |
| 4 | Queue-age badge + sort read createdAt, not time-in-queue — a just-submitted old case shows red "overdue"; + no aging signal/role for ops; + non-navigable filtered rows | major | T2 | derive age from submitted event ts (or expose updated_at); owner-board age + read-only ops tier + navigable rows | HP-REVIEW-01, tv-attorney-01, gm-track-02, tv-track-01, tv-attorney-02, gm-track-01, tv-track-02 |
| 5 | Landing tech-only; EB-1A invisible on /; arts six never named — arts/culinary/athletics bounce before the correct selector; founder green-card job buried | major(chef)/minor | T5 | balance copy + name EB-1A + distinguish the three packs; drop "meet seven" | dm-eval-01/02, OA-EP-01, YT-EP-01, dt-eval-03, WZ-PROSPECT-01, il-seo-01, dm-prospect-03, MB-QV-03 |
| 6 | FAQ security claims unbacked; no privacy/terms/DPA page — security-by-slogan fails GC diligence (blocker, but segment-confined — ranked below the every-run papercuts) | blocker | T6 | match FAQ copy to the build (or implement + publish policy/DPA) | PO-EVAL-01, PO-EVAL-02, PO-EVAL-03 |
| 7 | Fabrication gate is numbers-only — misses invented/mis-phased trial, invented society, nomination->win | major(phys)/minor | T7 | named-entity/award-status grounding-overlap warn, or document the limit | ao-draft-01, YT-DR-01, HP-RFE-02; adj. fam-draft-01 |
| 8 | Evidence Vault renders no on-screen DISCLAIMER — the categorize output an intake coordinator forwards has no UPL stamp | major | T8 | render DisclaimerStamp once on the vault card | bc-org-01 |
| 9 | Share cert says declarative "Qualifies" vs hedged "criteria supported"; + only microprint disclaimer on the most-forwarded surface | minor | T8 | hedge the stamp + render the full DisclaimerStamp | SI-QUAL-01, SI-EVAL-01 |
| 10 | Draft silently drops a strong-but-unscored criterion — no section, no flag; the attorney can get a letter missing the case defining argument | major | T8 | "strong-but-unscored, no section" nudge | ng-draft-01 |
| 11 | EB-1A file number "O1-" prefix; no profession hint to qualify prompt; no EB-1A/arts draft framing; preview not UPL-gated | minor/polish | T8 | classification-aware prefix; domain hint; light per-class draft framing; prove/add preview UPL assertion | il-track-01, rm-track-01, dm-qual-02, ng-qual-02, il-draft-02, lf-draft-03, SI-QUAL-02 |

---

## 4. Value ledger — promise vs designed-sound vs deferred

**Promise (time-saved-if-it-worked), by segment anchor:**
- EB-1A self-petition (physician, architect, founder, postdoc): $7.5k-$15k + 2-4 months of firm drafting -> a red-line-ready first draft in an afternoon.
- O-1B arts (chef, filmmaker, composer, designer): $7k-$12k + 2-3 months of an arts firm -> an afternoon, if the arts prose lands.
- Athlete: $6k-$9k / 6-8 weeks sports firm -> afternoon. Prospects: a $300-$600 consult (or a multi-week vendor review for the GC) -> "proceed or walk" in ~2-3 minutes.
- Paralegal / attorney: a 2-2.5-day first draft -> an afternoon; a full-day RFE -> ~an hour, repeatably.

**Designed-sound (L1 can confirm):** the machinery is sound on every journey (0 fail). Pack-correctness threads end-to-end; runtime adjudication gates exist; share privacy holds; pricing is canonical. The time-saved upside is structurally available wherever the authenticated path is reached.

**The recurring pattern — the authenticated real-Claude path grounds well; the keyless/preview path is the weak point.** Authenticated grounding: 3/3-6/6 (ravi 6/6, marcus 5/5-auth, physician/paralegal/kenji-auth 4/4-5/5, categorize 4/4-5/6). Keyless/preview grounding: 1/3 (designer best-path 1/5, fatima landing 1/4, architect & filmmaker best-path 2/6, composer 2/4, athlete 2/4, yuki 2/6, chef 3/5, derek cold 3/6). The weakest path is what every cold visitor sees first — and it is where T1/T3/T5 all live. Draft grounding sits at 3/5-4/6 (the accepted PN-DRAFT-01/G1.3 boundary).

**Deferred to L2 (only the live model read settles it):** whether the authenticated draft/verdict actually NAMES each Character real specifics and reads at the senior bar for arts/EB-1A/athlete; whether T1/T3 mis-reads flip a recommendation live; whether the fabrication prompt-rule holds for qualitative facts (T7); reachability/job-unblock for the ops queue (T2).

---

## 5. Strengths worth protecting (what NOT to touch)

- **Pack-correctness threaded end-to-end with runtime adjudication gates.** O-1A 8 / O-1B 6 / EB-1A 10 genuinely distinct (`packs.ts:90-168`); classification threads qualify -> case -> criteria UI -> evidence buckets -> draft -> share for every selected program; packFor O-1A fallback fires only on unset/garbage. qualifyGates HARD-FAILS if returned criteria != criteriaNames(classification) in count/order; classificationGate fails a leaked visa code; disclaimerGate fails a missing/altered disclaimer; legalAdviceGate fails advice/outcome language (`adjudication-gates.ts:135,204,227,244,302`).
- **Citation discipline + visible AdjudicationBadge.** Draft/RFE prompts forbid inventing specifics + forbid case law; auditCitations quarantines any hallucinated (Exhibit N) with a red "attorney must verify" alarm; every paid generation runs runAdjudication (`drafting.ts:160,181,593-608`, `ExhibitIndex.tsx:33`).
- **"None" is never green and never counts to threshold** — a single classifyStatus drives both tone + count (`criteria.ts:27-95`).
- **Share-token privacy + tamper-resistance** — only name/classification/likelihood/status in the token, DB-free render, count-mismatch rejection (`letters-patent.ts:69-102`; all 20 share findings agree).
- **Canonical pricing** from `economy.ts`/`registry.ts`, identical across surfaces, cannot drift; Enterprise the only contact-sales.
- **Validation cites primary sources** (8 CFR per program, USCIS Policy Manual, AZ ABS order) with dates + a CI freshness gate.
- **RFE + section-regenerate grounding landed (prior G1.1/G1.2)** — RFE fuses the as-filed petition + exhibits; regenerate carries sibling sections as continuity context.
- **Two-step Sign & file + atomic compare-and-set** — no one-click filing, no double-file/second-receipt; attorney RBAC fail-closed (accepted gap, a security strength).

---

## 6. Honest ceilings — what L1 structurally cannot confirm

- **Live model output quality on the grounded path** — whether the authenticated draft/verdict names each Character real specifics and clears the senior-in-role bar (esp. arts/EB-1A/athlete). L2 only — the whole ballgame for the conditionals.
- **Reachability + job-unblock** — L1 speaks only to "fix landed in code", not "reachable"/"unblocks the job". The ops queue (T2) and the read-only-tier absence (tv-attorney-02) are sharpest: the aging machinery is correct but the persona may not reach it.
- **Whether T1/T3/T5 mis-reads change a real decision live** — keyword mis-scores are L1-confirmed; whether the live model overrides them (and whether a cold visitor bounces first) is L2.
- **Whether the numbers-only fabrication gate prompt-rule holds** for qualitative facts on real prose (T7) — adversarial L2.

---

## 7. Panel verdict

The twenty voices converge on one sentiment: the engine is honest and the machinery is sound — the wrong-criteria-count never ships, "None" never greens, citations are disciplined, nothing private leaks, the disclaimer is load-bearing — but the FRONT DOOR under-serves everyone who is not a default tech O-1A applicant, and it does so on the very first screen. The keyless keyword preview picks a visa path it cannot reason about and under-reads composers, chefs, directors, designers, athletes and EB-1A self-petitioners (T1); a stray "conference" keyword inflates a thin record to a false "you qualify" (T3); the draft studio greets every arts/EB-1A user with the word "O-1A" they came to escape (T4); and the landing tells an artist or chef the product is not for them before they type a word (T5). None of these block the job structurally — the authenticated path grounds 4-6/6 and the upside (an afternoon vs months and thousands of dollars) is real — but they erode trust at exactly the moment a skeptical user decides whether to proceed. Fix the keyless path calibration, the one hardcoded word, and the positioning, and this is a tool every one of these Characters said they would adopt and tell a peer about.

---

## 8. L2 targeting (ranked l2_priority)

1. **Grounded AI-output quality for the rides-on-the-live-read profiles** — feed each real record to authenticated /qualify then draft; assert the prose NAMES the supplied specifics and reads senior: chef (Michelin/Beard/NYT -> arts six), filmmaker (director as lead creative role), composer (composed score -> Lead role), designer (Webby/Awwwards/adopters), architect (Venice Biennale -> Artistic exhibitions), athlete (podiums/titles/coaching/sponsors), EB-1A physician (guideline -> Original contribution; trial -> Leading/critical role), founder (ARR/round/Forbes). (dm-qual-01/02, lf-qual-02/draft-03, ng-qual-01/draft-01, ac-draft-02, il-draft-02, MB-DP-01, ao-qual-01/draft-01, fam-draft-01/02, OA-DR-02.)
2. **Live confirmation of T1** — run best-path live on a composer/chef/director/athlete/founder record; confirm it reasons O-1A-vs-O-1B/EB-1A, does not bury O-1B for a director, and acknowledges EB-1A higher bar. (YT-QV-01, OA-QV-01, lf-qual-02, MB-QV-01.)
3. **Live confirmation of T3** — paste a thin "OSS + conference talks" record into the hero; assert no "Scholarly: Met"/"Meets threshold" cold (and the model marks Scholarly thin/None). (kw-qualify-01, WZ-QUAL-01.)
4. **Live confirmation of T4** — screenshot DraftStudio idle on an O-1B and an EB-1A case; confirm the copy no longer reads "O-1A". (ao-draft-02, ac-draft-01, OA-DR-01, ng-draft-02, rm-draft-01.)
5. **T7 adversarial** — feed an oncology record + an IGF-nomination record; verify the live draft introduces no mis-phased/renamed trial, no not-in-record society, never writes "won" for a nomination; observe whether anything flags it. (ao-draft-01, YT-DR-01.)
6. **T2 reachability** — confirm an old-file-just-submitted case reads "fresh" once the clock is fixed; confirm whether any role short of the attorney allowlist can even view the queue. (HP-REVIEW-01, tv-attorney-01/02.)
7. **T8 surfaces** — confirm no DISCLAIMER renders on the Evidence Vault; screenshot /c/[token] and judge whether "Qualifies" + microprint reads as a determination. (bc-org-01, SI-QUAL-01, SI-EVAL-01.)

---

## Reconciliation sweep (cross-surface consistency)

Tracing each load-bearing shared concept across EVERY surface that uses it, asserting agreement. Mismatches emitted as `type:trust`.

### (a) Classification label — MISMATCH (T4)
The case classification is its real pack everywhere EXCEPT the DraftStudio idle/error copy + module docstring, which hardcode "O-1A" (`DraftStudio.tsx:374,40`), while the prompt header (`drafting.ts:177`), case header (`CaseDetailView.tsx:143-144`), criteria UI, evidence buckets, and share token all read classification. Verified live: `DraftStudio.tsx:374` literally renders "Draft a full O-1A petition letter..." with no interpolation. -> `type:trust`, surfaces: DraftStudio vs the rest of the case file. Second cosmetic instance: the case file number is minted O1-<random> for every classification (`petitions.ts:54`), so an EB-1A/O-1B masthead reads "File No O1-..." (il-track-01, rm-track-01).

### (b) Verdict framing — MISMATCH (T8 / SI-QUAL-01)
The share cert `/c/[token]` stamps the declarative "Qualifies" at/above threshold (`c/[token]/page.tsx:126`, verified live) while the in-app CriteriaReport — driven by the SAME data — uses the hedged "criteria supported" / "Meets threshold" (`CriteriaReport.tsx:58,86`). The most-forwarded, most-screenshotted surface drops the UPL hedge. The hero/landing sample cards add "Approved / 92% likelihood" (`page.tsx:228`) — by-design marketing illustration (refuted as a defect: dt-eval-04, fam-qual-02, SI-EVAL-02) but the same award-ceremony register the backlog flags as PN-QUAL-01/G3.1. -> `type:trust`, surfaces: `/c/[token]` stamp vs CriteriaReport.

### (c) Criteria-pack identity — CONSISTENT (no leak found)
Traced qualify -> case criteria UI -> evidence buckets -> draft sections for O-1B and EB-1A Characters. No surface leaks the O-1A 8 into a non-O-1A case. Every classification-bearing surface reads packFor(classification)/criteriaNames(classification) (`CriteriaReport.tsx:119`, `CaseDetailView.tsx:143,196,204`, `EvidenceVault.tsx:55`, `draftOperation.ts:151`); packFor O-1A fallback fires only on unset/garbage (no selector path sends that); and qualifyGates hard-fails any returned criteria set whose count/order != the pack (`adjudication-gates.ts:244`). The ONLY O-1A residue on a non-O-1A case is the cosmetic copy of (a) — DraftStudio string + the file-number prefix — never the actual pack, threshold, sections, or buckets. (Confirmed independently by lf-qual-01, ng-qual-03, ao-pack-01, il-pack-01, rm-qual-01, dm-qual-03.)

### (d) Keyless-mock vs real-model verdict for the same input — MISMATCH, partially disclosed (T1/T3)
Cold (keyless preview/best-path) and authenticated (model) screens CAN disagree for the same paste: a composer reads "Lead role: None" cold but should read Met on the model (ng-qual-01); a thin record reads "Meets threshold / 62%" cold via the conference mis-hit (WZ-QUAL-01); a director path can rank O-1B last cold (YT-QV-01). Disclosure is uneven: the hero InstantVerdict SoftGate honestly labels its read "an instant keyword read... the full screening reads your whole record in depth" (`InstantVerdict.tsx:273-277`) — but the best-path finder carries NO equivalent prominent caveat (`BestPathFinder.tsx:91` says only "Free / informational"), and a share certificate minted from the hero read inherits the mock inflated statuses with no re-screen warning (kw-share-02, WZ-SHARE-01). -> `type:trust`, surfaces: keyless preview/best-path vs authenticated /qualify; disclosed on the hero, UNDISCLOSED on best-path and on any hero-minted share token.
