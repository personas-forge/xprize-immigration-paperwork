---
type: tiger/session
date: 2026-06-24
mode: drill (v2, hardened) — qualify-screening op, OVER-READ stress test
target: [[qualify-screening]] / O-1A
engine: claude-opus @ effort:low (judge: claude-sonnet vs expert ground truth)
design: 3 profiles (strong / superficial-adversarial / borderline) × 2 rungs (production vs +calibration) × k=3
headline: REFUTES the over-read hypothesis on the model path → don't ship a calibration prompt; the real
  over-read risk is the keyless MOCK (#3), deterministic code
---

# Tiger DRILL 2026-06-24 — qualify, calibration / over-read stress test

Qualify's value is **funnel integrity**, not prose: a false "you qualify" pollutes the paid funnel +
erodes trust; a false "you don't" loses a viable applicant. The eval harness flagged *stochastic
over-scoring*, so this drill stress-tested over-reading against expert ground truth and asked whether a
**calibration instruction** cuts false-positives without hurting recall.

## Results (k=3, mean over judged samples)
| profile | rung | over-read | under-read | accuracy | likelihood (band) | fab |
|---|---|---|---|---|---|---|
| strong (Dr. Park, genuinely qualifies) | v0 prod | **1.67** | 1.0 | 79 | 80.7 (75-88 ✓) | 0 |
| strong | v1 +calibration | 1.67 | 0.67 | 81.7 | 87 (✓) | 0 |
| adversarial (superficial keywords) | v0 prod | **0** | 0 | 88.7 | 7 (10-28 — slightly LOW) | 1 |
| adversarial | v1 +calibration | **0** | 0 | 95 | 5 (LOW) | 0 |
| borderline (UX designer, "not yet") | v0 prod | 0 | 0.67 | 82 | 21.7 (30-48 — LOW) | 0 |
| borderline | v1 +calibration | 0 | **1.0** | 84 | 20 (LOW) | 0 |

## What it actually showed (the premise was wrong — that's the value)
1. **The model does NOT over-read the adversarial profile — 0 over-reads at BOTH rungs.** Bare
   "shipped products / GitHub repos / conference talks / top performer" did not inflate
   Original-contribution, Scholarly, or Critical-role; likelihood ~7 (correctly low). Production qualify
   (Rules 1-5 + 1b) is already robust against the funnel-pollution failure on the model path. **The
   keyless-mock ORIGINAL false-positive (#3) does NOT replicate on the model — it lives in the
   DETERMINISTIC mock**, confirming the L2 Marcus result generalizes.
2. **If anything the model is slightly UNDER-confident on weak profiles** — adversarial likelihood 7
   (band 10-28) and borderline 21 (band 30-48) both landed *below* the appropriate band. That's the SAFE
   direction for the funnel (under-promise, not over-promise) — arguably a feature (honest "not yet").
3. **The real (minor) miscalibration is the OPPOSITE of the fear:** the model OVER-rates near-Met criteria
   on the STRONG profile — Critical-role and High-remuneration scored "Strong" where the evidence is only
   "Partial" (PI role without confirming a distinguished-reputation org; top-10% survey without a specific
   figure). A Strong-vs-Partial confidence overstatement on applicants who qualify anyway — **low stakes,
   not a funnel risk.** Calibration did NOT fix it (1.67→1.67).
4. **Only 1 fabrication across all 18 screens** (one adversarial v0 sample), removed by the calibration
   instruction (1→0).

## Decision — DON'T ship the calibration instruction (`ship_calibration: false`)
It had nothing to fix on the adversarial over-read (already 0), and it slightly **hurt borderline recall**
(under-read 0.67→1.0 — it dismissed the genuine 2M-user lead role). It marginally helped accuracy
(strong 79→82, adversarial 89→95) and removed 1 fabrication, but net it's a **wash-to-slightly-harmful**
as framed — a heavier instruction risks turning the model's already-safe conservatism into under-reading
viable applicants. The drill's value is **preventing a wasteful/harmful prompt change.**

## Actionable (where the over-read risk actually is)
- **✅ #3 keyless-mock ORIGINAL false-positive SHIPPED (PR #119)** — this drill confirmed the over-read the
  eval-harness/UAT flagged is in the MOCK keyword regex (bare `shipped|github|product|…`), NOT the model.
  Fixed in `packs.ts`: the regex now requires a standalone originality term OR an authorship verb/role
  paired in-clause with a work term. Real founder still keys it; bare participation no longer does. +1
  test; only the keyless PUBLIC preview affected. (The drill correctly redirected the fix from a
  model/prompt change to the deterministic mock.)
- **Optional minor:** if the Strong-vs-Partial over-rating on strong profiles ever matters, a narrow nudge
  ("Strong requires the criterion's harder element confirmed — a distinguished-reputation org for Critical
  role; a specific figure for remuneration") — but it's low-value (these applicants qualify regardless).

## Honest ceilings
- k=3; the Strong-vs-Partial "over-reads" are fine-grained judge calls (the judge is strict — it counts
  "Strong" as over-reading a "Partial" GT), not Met-vs-None errors. The headline (no Met-vs-None
  over-reading of the adversarial profile; model leans conservative) is robust.
- One model + one pack (O-1A); a broader sweep (O-1B arts, EB-1A, more adversarial shapes) would harden it,
  but the funnel-safety conclusion held across the 3 deliberately diverse profiles.
