# UAT remediation backlog — 2026-06-20 sweep

Source: `uat/runs/2026-06-20-l1/` (20-Character L1, 162 findings) + `uat/runs/2026-06-20-l2/`
(10-Character live L2). Scorecard: **95 actionable findings** (1 blocker · 24 major · 60 minor ·
10 polish) + 67 strengths, deduped to **8 themes** (`SUMMARY.md`).

**Ordering (as requested):** (1) **Fixes** — deterministic, confirmed defects, ship first;
(2) **LLM improvements** where the business impact is largest; (3) **the rest** — positioning, SEO,
ops features, polish.

> **L2 already de-risked the core AI quality.** The *authenticated* real-Claude path screens every
> non-default profile on the **correct pack** and maps evidence correctly (Lucia O-1B→Lead role:Met,
> Noa composer→Lead role:Strong, Marcus athlete→Awards/Critical-role w/ Scholarly=None, Ingrid
> EB-1A→Artistic exhibitions:Met), and the O-1B draft argues the right pack with gates passing
> (`reads as O-1B`, no fabrication). So the LLM tier below is about the **keyless picker, the gate, and
> raising the floor** — NOT the draft quality, which L2 confirmed is already good.

---

## Tier 1 — Fixes (deterministic; ship first)

> **✅ ALL SHIPPED (2026-06-20).** XS batch (F1, F2, F6, F7, F8, F10) → PR **#95** (`cb3c27b`);
> S batch (F3, F4, F5, F9, F11) → PR **#96** (`a85a43a`). Both squash-merged to `main`, CI green
> (typecheck · lint · test · build · E2E). +2 regression tests (F1 Scholarly, F4 roadmap). Note: F4
> fixed `fam-track-01`; `tv-track-02` ("review = ready to submit") is by-design per an existing test
> and is parked as a Tier-3 label decision. F11 is the cheap copy-truthing; the real security
> implementation (encryption + `/privacy`/DPA) stays in Tier 3.

Ordered by impact. Effort: XS ≈ a few lines · S ≈ one file/handler · M ≈ a small feature.

| # | Fix | Where | Effort | Status / evidence | Reporters |
|---|---|---|---|---|---|
| **F1** | **Drop `conference` from the keyless `SCHOLARLY` regex** (a talk scored as a publication → inflates the keyless Met count → false "Meets threshold/62%" on the first screen). One edit fixes qualify + best-path + categorize + share. Also tighten the adjacent over-broad regexes (Membership auto-Met on "society/fellow"; ORIGINAL matches nearly any engineer) — require ≥2 signals or narrow. | `packs.ts:71-76` (+ `:44`, `:67`) | XS | **L2-confirmed live** (T3) | kw-qualify-01, WZ-QUAL-01, kw-evidence-01, kw-share-02, WZ-SHARE-01; adj. rm-qual-02, dt-qual-02 |
| **F2** | **Interpolate the case `classification` in DraftStudio idle/error copy** (hardcoded "Draft a full **O-1A** petition letter" on every non-O-1A case); refresh the stale `:40` docstring. The prose is already parameterized — copy drift only. | `DraftStudio.tsx:374,40` | XS | **L2-confirmed live** (T4, cosmetic) | rm-draft-01, ao-draft-02, ng-draft-02, ac-draft-01, OA-DR-01, lf-draft-01, gm-draft-01 (7) |
| **F3** | **Queue-age badge + oldest-first sort read the wrong clock** — switch the input from `createdAt` to the `submitted` review-event ts (`reviews.ts:35`) or expose `cases.updated_at` (add to `CASE_COLUMNS`). The age math is correct & tested; only the timestamp is wrong (a just-submitted old file shows red "overdue"). | `review/page.tsx:35`, `dashboard/page.tsx:37`, `pglite-store.ts:433,501,186` | S | confirmed-in-code (T2); live time-shift repro deferred | HP-REVIEW-01, tv-attorney-01 |
| **F4** | **Roadmap stage logic** — marks "Attorney review" current while still Drafting, and "Evidence" current after a draft exists (empty vault). Derive stage from real status. | `roadmap.ts:51` | S | confirmed-in-code | tv-track-02, fam-track-01 |
| **F5** | **Make filtered CaseList rows navigable** — the rich portfolio table (search/filter/sort/CSV) has non-clickable rows, so a paralegal can filter to the aging pile but can't open a case. | `CaseList.tsx:246,270` | S | confirmed-in-code | gm-track-01 |
| **F6** | **File-number prefix is classification-aware** — EB-1A/O-1B cases mint an "O1-…" number. Derive the prefix from classification. | `petitions.ts:54` | XS | confirmed-in-code | il-track-01, rm-track-01 |
| **F7** | **Render the `DisclaimerStamp` on the Evidence Vault card** — the DISCLAIMER rides the categorize payload but never renders on the vault surface an intake coordinator forwards to a client (no on-screen UPL stamp). | `EvidenceVault.tsx:24-30,120-292` | XS | confirmed-in-code (T8, major/UPL) | bc-org-01 |
| **F8** | **Hedge the share-cert verdict + render the full disclaimer** — `/c/[token]` stamps the declarative "**Qualifies**" (vs the hedged "criteria supported / Meets threshold" everywhere else) and carries only a microprint disclaimer on the most-forwarded surface. Match `CriteriaReport` wording + render `DisclaimerStamp`. (Also: don't offer a share link on a below-threshold result.) | `c/[token]/page.tsx:126`, `CriteriaReport.tsx:58,86` | XS | confirmed-in-code (T8) | SI-QUAL-01, SI-EVAL-01, lf-share-02 |
| **F9** | **Keep the exhibit index monotonic on the optimistic-add fallback** — shows exhibit "—" when persistence is skipped, breaking the index a coordinator files. | (evidence add fallback) | S | confirmed-in-code | bc-org-03 |
| **F10** | **Truth-in-copy** — remove the unsubstantiated "Most of our candidates meet seven" + all-eight-pre-green boast; fix stale `/qualify` metadata ("O-1A self-screening / eight criteria") and "eight O-1A criteria" doc comments. These are *false/stale*, hence fixes, not positioning. | `landing-claude/page.tsx:88-91`, `qualify/page.tsx:11`, doc comments | XS | confirmed-in-code | WZ-PROSPECT-01, dt-eval-03, PO-QUAL-02, gm-evid-01 |
| **F11** | **Truth-scope the FAQ security copy** (the blocker, cheap path) — the FAQ asserts AES-256 / TLS 1.3 / "every access logged" / "export or hard-delete everything" that nothing in code backs. Immediate fix: scope the copy to what's true (or "in production we will…"), fix "every access logged" (it's a mutation-only stdout audit). The *real* implementation (encryption/region-pin/DSAR + a published policy) is the Tier-3 project. | `faq/page.tsx:55`, `audit-log.ts:22` | S (copy) | confirmed-in-code (T6, **blocker**, segment-confined) | PO-EVAL-01, PO-EVAL-03 |

**Batch first:** F1, F2, F6, F7, F8, F10 are all XS one-shots — land them together. Then F3/F4/F5/F9/F11.

---

## Tier 2 — LLM improvements (largest business impact)

> **Progress:** LLM-1 interim caveat → PR **#97**; **LLM-1 model-backed best-path → PR #98** (shipped,
> live-verified — a director is now recommended O-1B with cross-classification reasoning, the opposite
> of the keyword mock); **LLM-2 grounding gate → this PR**. Remaining: **LLM-4** (strong-but-unscored
> nudge), **LLM-3** (grounding floor / domain hints).

The product's value *is* the AI output. L2 proved the authenticated draft/verdict already clears the
bar — so these target the one place the model **isn't** used (the picker), the **gate** that protects
a signing attorney, and **floor-raising / variance reduction**.

### LLM-1 — Model-back "best path" + real trade-off reasoning · HIGHEST impact (T1)
**Problem:** the path picker (`best-path.ts` → `mockQualification`) runs the **keyword mock even under
`LLM_ENGINE=claude`**, with **no** O-1A-vs-O-1B-vs-EB-1A reasoning, and frames EB-1A's green card as a
"bonus" rather than a higher bar. It is the **first decision screen** and steers the entire downstream
journey — and it under-reads every non-default profile (composer, chef, director, designer, athlete,
EB-1A self-petitioner). **15 reporters** — the single most-reported defect.
**Why biggest business impact:** getting an arts/EB-1A applicant onto the *right* path is the
difference between adoption and an avoidable RFE; this is the screen a skeptical first-time visitor
uses to decide whether to proceed.
**Approach:**
- (a) On the **authenticated** path, run the model to score & compare programs and emit a short
  *classification-vs-classification rationale*, including an **EB-1A "final-merits higher bar"** note
  (OA-QV-01). (L2 showed the model is excellent at the per-program read; best-path just never calls it.)
- (b) **Interim, cheap:** give best-path the same prominent **"instant keyword pre-read — the full
  screening reads your whole record"** caveat the hero SoftGate already has, which best-path lacks
  (`InstantVerdict.tsx:273` vs `BestPathFinder.tsx:91`) — so a non-default applicant isn't under-sold
  before sign-in. Pairs with **F1** (the `conference` fix removes the worst mock mis-reads meanwhile).
**Evidence:** `best-path.ts:75-98,119-135`, `api/qualify/preview/best-path/route.ts:11-18,57`.
**Effort:** M (model-back) · XS (caveat). Reporters: YT-QV-01, ac-qv-01/02, lf-qual-02, ng-qual-01,
dm-qual-01, OA-QV-01/02, MB-QV-01, kw-qualify-02, il-qual-01, gm-qual-01, dt-qual-01, fam-qual-01.

### LLM-2 — Harden the adjudication/fabrication gate beyond numbers · trust/liability (T7)
**Problem:** `fabricatedSpecifics()` flags only money / % / 4-digit-year / int ≥100. A **renamed or
mis-phased trial, an invented society, or a nomination upgraded to a "win"** carries no flaggable
number and **passes the "live adjudication" gate silently** — the defense is only the prompt rule + the
attorney.
**Why high impact:** for a physician or attorney *signing* the output, a qualitative hallucination that
clears the gate is the malpractice / RFE risk — and the product markets the gate as a safeguard.
**Approach:** add a **named-entity / award-status grounding-overlap** check — flag specifics in the
output (org / award / trial names; "won" vs "nominated") that don't appear in the grounding; consider
making `HP-RFE-02`'s non-blocking warn **blocking** for high-risk entities. At minimum, stop implying
the gate catches qualitative fabrication and document the numbers-only limit.
**Evidence:** `adjudication-gates.ts:83-93,122`, `drafting.ts:181`. **Effort:** M. Reporters:
ao-draft-01 (physician/major), YT-DR-01, HP-RFE-02; adj. fam-draft-01.

### LLM-3 — Raise the grounding floor + domain hints · floor-raising (incremental)
L2 showed the model already maps non-default evidence well, so this **reduces variance / raises the
floor**, not a fix:
- (a) Pass a light **profession/domain hint** into the qualify+draft prompts so a behind-the-scenes
  artist's "lead role" (composer/editor/cinematographer) and a chef's culinary-arts are signposted
  (ng-qual-02, dm-qual-02, ao-qual-01).
- (b) **Per-class draft framing** — an arts-O-1B "distinction" / EB-1A "top-of-the-field totality"
  cue (lf-draft-03, il-draft-02 — largely handled live in L2, so low priority).
- (c) **Peer-comparison framing for High remuneration** so comp is argued *vs peers*, not bare — an
  RFE magnet for the data-scientist/founder (fam-draft-01).
- (d) (Lower) thread the **full CV** into the draft (the accepted G1.3/PN-DRAFT-01 boundary; L2 showed
  criteria-grounding already suffices).
**Effort:** S–M.

### LLM-4 — "Strong-but-unscored criterion → no section" nudge · output completeness (T8)
**Problem:** the draft writes a section **only per Met/Strong criterion**; an under-scored-but-important
criterion (e.g. a composer's dropped lead role) yields **no section and nothing flags it**, so the
attorney can receive a letter missing the case's defining argument.
**Why it matters:** a dropped lead-role argument = a weak petition; cheap safety net that compounds
with LLM-1 (better scoring → fewer drops).
**Approach:** when a high-signal evidence item maps to an unscored criterion (or a criterion is
"strong-but-unscored"), surface a nudge in DraftStudio. **Evidence:** `drafting.ts:83-85,204-205,664`.
**Effort:** S. Reporter: ng-draft-01.

---

## Tier 3 — The rest (positioning, SEO, ops features, polish)

- **Positioning rebalance (T5)** — balance the audience ribbon + evidence copy for arts/culinary/
  athletics ("CV, press, reviews, awards" not just "GitHub"); **name EB-1A on `/`**; distinguish
  O-1A-8 / O-1B-6 / EB-1A-10. *dm-eval-01 is "major" (a chef bounces before the right selector) —
  consider promoting it.* `page.tsx:125,154,156,133`, `landing-claude/page.tsx:59-62`. Effort: S–M.
  Reporters: dm-eval-01/02, OA-EP-01, YT-EP-01.
- **SEO professions** — add chef/architect/athlete (or a graceful generic) so
  `/visa/[class]/[profession]` doesn't hard-404. `professions.ts`. il-seo-01, dm-prospect-03, MB-QV-03.
- **Ops features (T2-adjacent, missing-features not bugs)** — a **read-only ops/case-manager role**
  (view the SLA queue without sign/file power; today viewing requires `ATTORNEY_EMAILS` which also
  grants signing) + **per-case aging + target-date on an owner board**. tv-attorney-02, gm-track-02,
  tv-track-01. Effort: M.
- **FAQ security — the real fix (T6 project)** — implement encryption / region-pin / hard-delete /
  DSAR and publish `/privacy`, `/terms`, `/dpa`, `/security` to *bind* the claims (Tier-1 F11 is the
  interim copy-truthing). PO-EVAL-01/02. Effort: L.
- **Certificate "ceremony" framing** (subjective/by-design; prior G3.1/PN-QUAL-01) — soften
  "Approved/Certificate / Letters Patent" toward "informational screening" for rigor-focused users.
  ac-share-02, fam-qual-02, MB-QV-02, SI-EVAL-02, dt-eval-04. Effort: S.
- **Demo-data hygiene** — the mock "Dr. Anya Krishnan · 92%" portfolio renders next to real cases;
  gate the demo seed behind a flag or hide it from real-user views (check `accepted-gaps.md` first).
  kw-track-01, bc-track-02. Effort: S.
- **Keyless categorizer order-dependence** — first-keyword-wins can mis-bucket (biennale→Press,
  streams+press doc) on the *keyless* path only (model path fine). ng-evid-01, il-evid-01, lf-evid-02,
  ao-evid-01. Effort: S.
- **Misc polish** — show categorize `source` (model vs mock) so a coordinator knows what to trust
  (bc-org-02); refile-to-wrong-bucket inflates coverage (fam-evid-01 — prior dc-evidence-02 accepted);
  review-nav link is top-bar-only (HP-REVIEW-02).

---

## Sequencing

1. **Tier-1 XS batch:** F1, F2, F6, F7, F8, F10 (one PR — high trust-per-line).
2. **Tier-1 S:** F3, F4, F5, F9, F11(copy).
3. **LLM-1(b) caveat** (XS) immediately; then **LLM-1(a) model-back best-path** — the highest-impact LLM work.
4. **LLM-2** (gate hardening), **LLM-4** (unscored nudge), then **LLM-3** (floor-raising).
5. **Tier 3** as capacity allows (promote positioning T5 / dm-eval-01 if conversion matters most).

Verify each batch with **`/uat recertify`** against its finding's `l2_priority` (resolved-verified +
the run-over-run grounding/time-saved deltas). Re-run live L2 on the AI surfaces after LLM-1/LLM-2.

---

### Prior wave — CLOSED
The 2026-06-19 backlog (positioning, draft integrity, attorney ceremony, RFE parity, qualify
calibration, dashboard; then G1–G3 grounding/evidence/verdict-framing) shipped in **PR #92 + #93** and
was L2-verified (`runs/2026-06-19-l2/`). See git history / the memory note for that wave's detail.
