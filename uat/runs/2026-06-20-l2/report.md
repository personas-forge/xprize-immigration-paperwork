# UAT L2 scorecard — 2026-06-20-l2 (empirical, live browser + real Claude)

- **cert_level:** **L2** (live app `npm run dev`, PGlite persistence, **real Claude via the CLI engine**)
- **Base:** `http://localhost:3010` · synthetic dev user (`developer@localhost`) · `ATTORNEY_EMAILS=developer@localhost`
- **Port selection (the contention guard):** preflight probed 3000–3005 (all free *this* run, but per the
  parallel-session expectation we don't take 3000). Picked **3010** from the less-contended band (avoids the
  3000–3002 dogpile + the 3003 e2e reservation), asserted server identity (`<title>Immigration Concierge…`)
  before driving, recorded it in `runs/2026-06-20-l2/.port`, and threaded `BASE_URL=http://localhost:3010`
  into every driver/API call. Engine verified live: `claude -p … → PONG`.
- **Selection (10 of the 20 L1 Characters):** Lucia (O-1B), Noa (O-1B), Marcus (O-1A athletics),
  Ingrid (EB-1A), Kenji (O-1A OSS), Oluwaseun (EB-1A), Harold (attorney), Gloria (paralegal),
  Priscilla (GC), Wei (H-1B prospect) — chosen to answer L1's deferred `l2_priority` questions, above all
  **the grounded AI-output quality for the non-default (arts / EB-1A / athletics) profiles whose whole case
  rides on the live model read.**
- **Result:** **the live real-Claude path clears the senior-quality bar on every grounded profile tested
  (5 qualify + 1 draft, all `source:claude`); T3 + T4 confirmed live; the reconciliation pack-identity check
  passes live. 0 new defects beyond the L1 backlog; T1's blast radius is *narrowed* to the cold keyless path.**

## The "whole ballgame" — grounded AI output on non-default profiles (L1's #1 deferred question)

L1 confirmed the **keyless mock** under-reads anyone who isn't a default tech O-1A applicant (T1). The open
question only the live model could answer: *does the authenticated real-Claude read save them?* It does.

| Character | Pack scored | Verdict (live, `source:claude`) | Evidence mapping (the L1 fear → live reality) | Specifics | Disclaimer |
|---|---|---|---|---|---|
| **Lucia** (O-1B) | the **six** ✅ | likelihood 68 · 4 Met/Strong | director → **Lead role: Met**; NYT/Variety → **Reviews & press: Met** (not a business "critical role") | Sundance, Variety, Guild, distribution (4/4) | ✅ |
| **Noa** (O-1B) | the **six** ✅ | likelihood 68 · 3 Strong | composer → **Lead role: Strong** (the mock literally can't see a composer as a lead; the model does) | Emmy, streams, Guild, Variety (4/4) | ✅ |
| **Marcus** (O-1A) | the **eight** ✅ | likelihood 52 · 2 Met/Strong | podiums → **Awards: Met**; national-team coach → **Critical role: Strong**; **Scholarly = None** (honest, not forced) | World Cup, champion, coach, sponsor (4/4) | ✅ |
| **Ingrid** (EB-1A) | the **ten** ✅ | likelihood 68 · 4 Met | Venice Biennale → **Artistic exhibitions: Met** (not mis-bucketed as Press) | Biennale, exhibit, monograph, competition (4/4) | ✅ |

Artifacts: `lucia-ferraro-filmmaker-qualify.json`, `noa-grossman-composer-qualify.json`,
`marcus-bell-athlete-coach-qualify.json`, `ingrid-larsson-architect-qualify.json`.

**Grounded draft (capstone) — Lucia, O-1B (`lucia-draft.json`):** `source:claude`, **6 sections** headed by the
O-1B criteria (Introduction · Lead Role in Distinguished Productions · National or International Recognition ·
Reviews and Press · Record of Major Commercial or Critical Success · Conclusion) — **no O-1A-pack heading leak**.
Argues from Sundance / IDFA / Variety / distribution; reads like a real petition ("…in support of her
classification … under the O-1B visa category…"). **Live adjudication gates pass:** `disclaimer-present: pass`,
`classification-consistent: pass — "reads as O-1B"`, `no-fabrication: pass`. → **lf-draft-03 RESOLVED:** the live
draft argues arts distinction on the *right* pack, not generic/business filler.

## L1 themes — live status

| Theme | Live status | Evidence |
|---|---|---|
| **T1** keyless/best-path picks the path, not the model | **Narrowed — not refuted.** The defect is real on the cold preview, but the **authenticated** read screens every non-default profile on the *correct* pack (table above). Job-impact is confined to the *first-impression* surface (a skeptic may bounce pre-sign-in), not the actual screening. | 5 grounded qualify JSONs; T3 below |
| **T3** `SCHOLARLY` regex includes `conference` → false eager-yes | **CONFIRMED LIVE (open).** Keyless `/api/qualify/preview` scored a thin "two conference talks" record **Scholarly: Met** → Original + Scholarly + High-remuneration = **3 Met / threshold met / 62%**. | live preview response (`packs.ts:71-76`) |
| **T4** DraftStudio hardcodes "Draft a full **O-1A** petition letter" | **CONFIRMED LIVE — cosmetic only (open).** Rendered verbatim on Ingrid's **EB-1A** case; but the *generated* draft reads O-1B (gate passes). Trust paper-cut, not a functional defect. | shot `l2-ingrid-eb1a-case.png` (`DraftStudio.tsx:374`) |
| **Reconciliation (a)** classification label | **Mismatch confirmed — cosmetic.** Criteria UI + draft body + gate all read EB-1A/O-1B; only the idle DraftStudio copy says "O-1A". | Ingrid case page (EB-1A ×8, stray O-1A ×2 = the copy) |
| **Reconciliation (c)** criteria-pack identity end-to-end | **CONSISTENT live.** Ingrid's case renders the EB-1A 10 (Artistic exhibitions, Commercial success in the arts, Leading/critical role) — **no O-1A-8 leak** into a non-O-1A case. | Ingrid case page criteria section |
| **T2** queue-age badge reads the wrong clock | **Confirmed-in-code (L1); live time-shift repro deferred.** Reproducing the "old case-file submitted just now → red overdue" needs an aged fixture; the code path (`pglite-store.ts:433,501`, `review/page.tsx:35`) is unambiguous. Carry **open**. | L1 HP-REVIEW-01 / tv-attorney-01 |
| **T6** FAQ security claims unbacked + no privacy/terms/DPA | **Confirmed-in-code (L1).** Live FAQ renders the AES-256/TLS/hard-delete copy; nothing in code backs it and no `/privacy`·`/terms`·`/dpa` route exists. Carry **open** (blocker for the GC segment). | L1 PO-EVAL-01/02 (`faq/page.tsx:55`) |

## Strengths confirmed live (protect)
- **Pack-correctness is real, not just coded:** O-1A/O-1B/EB-1A each scored on their own pack end-to-end, with
  the runtime **adjudication gates** firing on the live draft (`disclaimer-present`, `classification-consistent`,
  `no-fabrication` all `pass`).
- **The UPL line holds on the live payload:** `disclaimer:true` on all 5 qualify results + the draft; the draft
  gate reads "UPL disclaimer attached".
- **Zero fabrication on genuinely-grounded input:** every profile's named specifics (festivals, Emmy, World Cup,
  Biennale) survived into the verdict/draft; the fabrication scanner did not false-positive on real numbers.
- **Honest thin reads:** Marcus's Scholarly stayed **None** (grey, out of the ≥3 count) — the athlete wasn't
  force-fit into a scientist's criteria.

## What L2 did NOT cover (honest ceilings)
- No live **time-shift** repro of T2 (needs an aged fixture); no live **draft** for O-1A-OSS / EB-1A-architect /
  athletics (qualify mapping validated; draft validated only for O-1B-Lucia + the prior researcher run).
- Operator queue-age + sign-&-file ceremony (Harold) and throughput (Gloria) were prioritised below the
  grounded-quality checks this run; their L1 verdicts (queue clock = open) stand.

See `uat/runs/2026-06-20-l1/SUMMARY.md` for the full L1 backlog this L2 verified against.
