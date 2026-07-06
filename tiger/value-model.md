---
type: tiger/value-model
created: 2026-06-23
purpose: Convert each LLM call site into $ and hours vs the real market, so findings are
  ranked by dollars-leaked, not vibes. Feeds Lens 2 (value) and the `drill` mode.
sources: web research 2026-06-23 (firm fees, competitors, USCIS fees, Kazarian bar) — cited inline
confidence: market figures are firm/platform pages + Clio survey; flagged [EST] where inferred
---

# Tiger value model — Immigration Concierge

The L1/L2 backlog was code-deep but value-shallow: it said *what's wrong*, not *what it's worth*.
This file is the missing half — a researched, quantified model so every finding carries a dollar figure.

## 1. The market the product sits in (cited)
**Incumbent = an immigration law firm.** What it displaces, per petition:
- Legal fee: **O-1A $5–9k**, **O-1B $3.5–8k (+RFE)**, **EB-1A $7.5–15k** (Alma O-1 $8k / EB-1A $10k;
  Lighthouse $10k / $15k — published). Gov fees: O-1 I-129 ~$1.66k / EB-1A I-140 ~$1.0k, **+ $2,965
  premium processing** (Mar 1 2026).
- Effort: **25–40 counsel hours/petition**; **blended rate ~$343/hr** (Clio 2026). Turnaround **2–4
  months** (EB-1A drafting 8–12 wk); reference letters are the bottleneck.
- Risk: **RFE rate O-1 ~20%, EB-1A ~40–50%** [EST]; RFE response **$2–5k + 3–5 months**. Denial:
  O-1A ~6–10%, **EB-1A ~23–28%**; sunk cost on an EB-1A denial **~$14k** + a multi-month refile.

**Direct competitors (the bar to beat):**
- **DIY drafting tools** (the product's exact lane): **QuickFiling** — AI drafts the full package,
  pay-on-download **NIW $749 / EB-1A $949, O-1 "coming soon"** (an open flank); AutoPetition, Parley
  (YC, O-1A writer). This sets the **market price of the drafting deliverable ≈ $750–950**.
- **Done-for-you hybrids** (tech + attorneys): Alma, Lighthouse, Plymouth Street, **LegalOS** (YC W26 —
  AI agents draft, attorney signs, claims 48-hr / "100% so far", trained on "12,000 petitions").
- **B2B drafting SaaS** (sold to firms): CaseBlink, Visalaw.ai ($220–480/seat/mo).
- The wedge: a "drafting tool, not a law firm" priced in the **hundreds vs the $5–15k firm fee** — but
  the funded players own the trust narrative (attorney-signed, self-reported 98–100% approval). To win,
  the **output must survive RFE scrutiny without an attorney signature**.

## 2. The quality→value coupling (the core idea)
The op's COGS is trivial — `draft` = 12 tokens ≈ **$0.12**; `qualify` 3 ≈ $0.03; `rfe` 5 ≈ $0.05. So
**~100% of the value is quality, not cost.** A draft only banks its value to the extent it's *usable*.

**Refined model (hardened 2026-06-23 — the first drill's 4-bucket map saturated at "light", so a 82 and a
94 looked identical in $). Two terms, both keyed to the judge's `market_score` (0–100) so quality above
"usable" still registers:**

```
value_delivered = value_ceiling × usableFraction(score) + rfeAvoidance(score)

usableFraction(score)  — continuous, piecewise-linear (no saturation):
   ≤40 → 0.05 · 40–70 → 0.05→0.50 · 70–85 → 0.50→0.80 · 85–95 → 0.80→0.92 · 95–100 → 0.92→0.97
rfeAvoidance(score) = max(0, score − 78) × 0.005 × $3,500
   (a step-two, field-normed letter pre-empts the most-challenged "original contributions" RFE;
    ~0.5pt off the ~45% EB-1A RFE rate per market-point above an ~78 baseline letter — [EST, conservative])
```

e.g. score 82 → ~$3,116/petition · score 94 → ~$4,017 — a ~$900 gap the old map hid. Research backs the
coupling: a canned/conclusory AI draft "must be substantially reworked" (Cyrus Mehta, AILA ethics) → most
labor value is NOT saved; a specific, field-framed, **Kazarian step-two** draft → light edit → most of it
is. The optimization target is `score` (via `usableFraction` + RFE-avoidance), and that's what `drill`
moves. _Assumptions (RFE sensitivity, the curve anchors) are deliberately conservative estimates — tune as
real rework/RFE data arrives._

## 3. Per-call-site value ceilings
`value_ceiling` = the displaceable drafting labor (the part the op actually does — the letter + the
criterion-by-criterion brief, NOT evidence-gathering or expert letters):

| call site | ceiling basis | value_ceiling / use | volume signal | notes |
|---|---|---|---|---|
| **[[draft]]** (EB-1A) | ~12 firm-hrs × $343 | **~$4,116** | EB-1A I-140s ~11–12k/yr, +50% YoY | + RFE-avoidance term below |
| **[[draft]]** (O-1A) | ~10 firm-hrs × $343 | **~$3,430** | ~10k O-1A/yr | DIY market price ~$850 |
| **[[rfe-response]]** | RFE labor + denial-avoidance | **$3,000 labor + up to ~$3,900 filing-protection** | ~20% of O-1, ~45% of EB-1A | deadline-driven; a botch risks the whole ~$13k filing |
| **[[qualify-screening]]** | a paid consult / triage hr | **~$343** (1 consult-hr) | funnel mouth — every prospect | gates all downstream value; trust-erosion if wrong |

**RFE-avoidance (secondary term on draft + rfe):** a step-two, non-conclusory letter targets the
most-challenged criterion ("original contributions of major significance"). Shaving even ~8 pts off the
~45% EB-1A RFE rate ≈ `0.08 × $3,500 ≈ $280/petition` expected, plus avoiding a 3–5 month delay; a botched
RFE response risks the **~$14k** sunk cost outright.

## 4. Findings re-priced as $ leaked (the L2 defects)
A finding's weight = `value_ceiling × value_lost × P(it fires)`:
- **Digest-ceiling (draft, pre-fix #115):** on specificity-heavy cases the flagship fact vanished →
  "substantial rework" (~25% delivered) → **leak ≈ 0.75 × $4,116 ≈ $3,087/petition**. The shipped fix
  + the `drill` measure how much of that is recovered.
- **RFE 800-char trim (pre-fix #115):** produced a denial-grade non-answer on the exact challenged point.
  On the ~45% of EB-1A cases that draw an RFE, that risks the **~$14k** sunk filing + a second RFE/denial —
  the single highest-$ defect found.
- **Keyless qualify ORIGINAL false-positive (#3, open):** a false "you qualify" on the public preview →
  a doomed case proceeds into the paid funnel (wasted draft spend + a denial + trust damage). Pure
  reachability play (every prospect), low per-event $ but high frequency.

## 5. How `drill` uses this
For a target call site: measure `value_delivered` live (generate → judge vs the **market bar** → rework
→ $), then iterate improvements and re-measure the **value curve** until the marginal Δ$ per rung falls
below a threshold ("maxed out"). See `sessions/2026-06-23-drill.md` for the first run (draft / EB-1A).

_Update these figures when fees/competitor prices move; the Mar-2026 premium-processing bump is the most
recent change. All market numbers are directional (firm/platform pages + Clio), not audited._
