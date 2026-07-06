---
type: tiger/home
app: Immigration Concierge
last_updated: 2026-06-23
state: v2 live — 4 PRs SHIPPED (#115 grounding fixes · #116 market-bar framing · #117 RFE #9 adjudication grounds filed-prose · #118 #2 long-tier-on-Flash warning). #2 deploy action open: set GEMINI_DRAFT_MODEL to a Pro-class model (~+$1,400/petition, saturates mid-tier; A/B w/ real Gemini). All top-3 sites drilled; backlog CLEARED; 5 PRs shipped (#115-#119). **run --live value ledger (2026-06-24, updated method): the fixes deliver — draft +$744/petition (85/100, 82% of ceiling), RFE +$6,019/RFE (91/100, names evidence 3/3), qualify funnel-safe (0 over-reads), ZERO fabrication.** Residuals: draft 85→95 needs a field-norms dataset; #2 deploy (GEMINI_DRAFT_MODEL + A/B). See [[2026-06-24-run-live]] · [[value-model]] · [[2026-06-24-lens3-draft-models]]
---

# 🐯 Tiger — Immigration Concierge

The LLM-value vault. Tiger hunts the model call sites (not the CRUD around them) across three
lenses — **code quality** of the AI plumbing, **business value** (UAT Character method, scoped to
the output), and **model optimization**. This home note is the always-current map; session notes
under `sessions/` are the immutable run records.

## Headline state (init 2026-06-23)
- **9 call sites** inventoried, all funnelled through one chokepoint (`executeAiOperation`,
  `src/lib/ai/operation.ts`). Engine: Gemini Flash (prod) | Claude CLI (dev) | deterministic mock.
- **10 Characters** adapted from the `/uat` roster, re-scoped to judge LLM output.
- **No lens has run yet** — scores below are `—`; grounding `n/m` are provisional code-reads.
- Two cross-cutting facts: **no input-hash output cache anywhere** (every call re-bills + re-runs);
  **telemetry is solid** (`trackLlm` emits provider/model/tokens/latency/status, customer-attributed).

## Runs on the 3 targets → [[2026-06-23-l1]] (theoretical) · [[2026-06-23-l2]] (live Opus-low)
**L2 (Opus-low, judged by Sonnet) changed the picture — current truth:**
1. **RFE 800-char trim is denial-grade** (CONFIRMED-FAIL, top fix). Priya: the trim cut the
   independent-adoption evidence the RFE demanded → a confident circular non-answer that "would invite a
   second RFE or denial." Raise trim to ~2000 / sentence-aware (rfe.ts:199).
2. **Draft drops load-bearing facts on Partial/None criteria** (CONFIRMED). Opus-low is NOT generic — it
   uses every specific that reaches it and **invents nothing** — but "ONE section per Met/Strong"
   suppressed Ingrid's Helsinki Library + Noa's press feature entirely. The loss is at the qualify→digest
   seam + criterion suppression, not the model. Fix upstream (richer evidence capture; marshal strong
   facts into the totality regardless of status).
3. **Field-norms (#6) REFUTED on the model path** — Marcus (athletics) PASSED, no fabrication. Keep #6
   as a keyless-mock/weaker-model watch only.
4. **Still open:** premium-op-on-Flash (#2, untested — used Opus not the prod engine) · keyless ORIGINAL
   false-positive (#3) · no output cache (#5). **Strength held under live fire: zero fabrication across
   all 5 generations.**

## Call sites (by cost tier)
| Site | op / tier | grounding* | status |
|---|---|---|---|
| [[draft]] | draft · **xl** (12) | 2.5/5 | **assessed (L2: CONDITIONAL)** |
| [[draft-section]] | draft_section · heavy (5) | 3/5 | discovered |
| [[draft-critique]] | draft_section · heavy (5) | 2/5 | discovered |
| [[rfe-response]] | rfe · heavy (5) | 3.5/5 | **drilled (k=4: trim fix +$3,857/RFE; framing +$2,415)** |
| [[rfe-forecast]] | rfe · heavy (5) | 3/5 | discovered |
| [[qualify-screening]] | qualify · medium (3) | 4/5 | **drilled (k=3: funnel-safe; over-read risk is the mock #3, not the model)** |
| [[qualify-best-path]] | qualify · medium (3) | 4/5 | discovered |
| [[guidance]] | guidance · light (1) | 3/5 | discovered |
| [[evidence-categorize]] | categorize · light (1) | 4/5 | discovered |

*provisional code-read; confirmed by a Lens-2 run.

## Characters (10)
Applicants: [[sam-founder]] (O-1A) · [[priya-researcher]] (O-1A) · [[kenji-oss-engineer]] (O-1A) ·
[[lucia-filmmaker]] (O-1B) · [[noa-composer]] (O-1B) · [[ingrid-architect]] (EB-1A) ·
[[marcus-athlete]] (O-1A athletics).
Operators: [[gloria-paralegal]] · [[maya-attorney]] · [[bryan-intake]].

## How to use this vault
- **`/tiger scan`** — cheap re-inventory; diff prompts/schemas vs these notes, flag drift/regressions.
- **`/tiger run [--lens all] [--live]`** — the full pass. L1 (theoretical) is free + mass-parallel;
  `--live` runs real generations (Lens 2) + the model benchmark (Lens 3) on the selected sites.
- **`/tiger benchmark <call-site>`** — Lens-3 deep dive on one site.
- See `config.md` for the model-invocation recipe + the open questions to resolve before `--live`.

## Open questions (from config.md)
- Is `GEMINI_DRAFT_MODEL` supposed to be a stronger model for the `xl` draft op? (Today: unset → Flash.)
- Pick the Lens-3 model matrix + the judge model (must differ from the cell under test).
