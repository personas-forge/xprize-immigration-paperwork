---
id: qualify-screening
type: tiger/call-site
modality: text
file: src/app/api/qualify/route.ts:36
wrapper: executeAiOperation (inline spec, route.ts)
provider: gemini (prod) | claude (dev)
model: tier "fast" → GEMINI_MODEL ?? gemini-3-flash-preview | claude sonnet
operation: qualify
tier: medium (3 tokens)
schema: yes — parseQualifyResponse (qualification.ts:192); fills missing criteria "None", canonical pack order
grounding: 4/5 (L1+L2 model path; the keyless MOCK path still leaks)
quality_score: PASS (L2 marcus + drill k=3 — model path is funnel-SAFE: 0 over-reads on the adversarial profile, leans slightly conservative)
code_score: strong (temp:0, robust parse, adjudicate); 1 public-mock false-positive (#3, the real over-read risk)
recommended_model: — (drill held opus-low fixed; calibration is a prompt question, model fine)
status: drilled (L2 + calibration drill)
last_scanned: 2026-06-24
characters: ["[[sam-founder]]", "[[priya-researcher]]", "[[kenji-oss-engineer]]", "[[lucia-filmmaker]]", "[[noa-composer]]", "[[ingrid-architect]]", "[[marcus-athlete]]", "[[bryan-intake]]"]
---
## What it does
The **public, no-auth entry point** (`/qualify`). Screens a free-text profile against a
classification's evidentiary criteria → per-criterion status (Met/Strong/Partial/None) + evidence
quote + rationale + overall likelihood + gaps. **Highest frequency/reachability site — the funnel
mouth; gates every paid op downstream.** An honest yes/no in minutes vs a $5–8k consult.

## Prompt & grounding
`buildQualifyPrompt` (qualification.ts:122). Notable correctness guards already in the prompt:
**Rule 4** anti-cross-contamination (publications ≠ original contribution, qualification.ts:137) and
**Rule 5** field-norms (don't under-score non-sciences fields, :141) — both added to fix a known
over-scoring bug. Generate opts: `json:true, tier:"fast", temperature:0` (route.ts:56 — deterministic).
- **Reaches the prompt:** free-text profile (40–12000 chars), name, classification, the pack's
  criteria names. ✓✓✓✓ — everything the user gave reaches it; grounding is high *within* a thin input.

## Code quality (wrapping · logging · caching)
- Chokepoint ✓; robust parse + canonical-order fill ✓; **adjudicate gate ✓** (route.ts:72).
  `temperature:0` ✓ (reduces the stochastic over-scoring). Telemetry ✓. **No output cache.**
- The **keyless mock** path (`mockQualification`, qualification.ts:239) uses keyword heuristics — the
  SCHOLARLY regex counts the word "conference" → false "you qualify" on the cold preview (UAT T3,
  `packs.ts`). That's the *mock*, not the model, but it's the public preview many prospects see first.

## Findings (L1 — [[2026-06-23-l1]])
- **[code/value · H/H/H] Keyless mock ORIGINAL false-positive** (backlog #3). `mockQualification` →
  ORIGINAL regex matches bare `shipped|launched|product|framework|library|github|stars|downloads`
  WITHOUT an ownership signal (packs.ts:67) → "I shipped a feature" / "GitHub user" → false "Met" →
  inflated "you qualify" on the PUBLIC, no-key preview many prospects see first. (SCHOLARLY
  "conference" exclusion is already fixed — T3.) Fix: require `my|our|i built|authored|founded` near
  the product term. The funnel mouth → highest reachability.
- **[value · M/H/H] Field-norms are prose, not schema** (backlog #6). Rule 5 (qualification.ts:141)
  protects OSS + athletics by instruction only — "widely-adopted = major significance" is uncalibrated
  (kenji risks "Strong" not "Met"); the O-1A pack is sciences-shaped with no athletics anchors (marcus,
  unlike the tailored O-1B pack). Fix: worked examples in Rule 5; consider an athletics pack.
- **[code · L/M/M] No `onBlocked`** (backlog #12) — a blocked UPL output isn't reclaimed + ships badged,
  not withheld (mirror guidance route.ts:96). *Verify adjudicate can return attorneyReady:false here.*
- _Protect:_ temperature:0, robust canonical-order parse, adjudicate gate, user-keyed rate-limit.
- _Open (eval harness):_ residual stochastic over-scoring on terse/non-native profiles even at temp 0 —
  confirm on the live model path in `--live`.

## L2 live (Opus-low — [[2026-06-23-l2]])
## DRILL (calibration / over-read, k=3 — [[2026-06-24-drill-qualify]])
**The over-read hypothesis is REFUTED on the model path.** Adversarial superficial profile (bare
github/shipped/conference/top-performer) → **0 over-reads at both rungs**; the model leans slightly
*conservative* (likelihoods below the appropriate band on weak profiles) — the SAFE funnel direction.
**The keyless-mock ORIGINAL false-positive (#3) does NOT replicate on the model** → it's a deterministic
`packs.ts` issue. **✅ FIXED (PR #119):** the ORIGINAL regex now requires a standalone originality term OR
an authorship verb/role (created/built/founded/maintainer…) paired in-clause with a work term — a real
founder still keys it, bare "shipped products / GitHub / open source" no longer does (the model already
didn't over-read). The only real
miscalibration is mild OVER-rating of near-Met criteria on STRONG profiles (Critical-role/High-remuneration
"Strong" vs "Partial" — low stakes, they qualify anyway). **Decision: DON'T ship a calibration instruction**
(wash on adversarial over-read=0; slightly hurt borderline recall 0.67→1.0). 1 fabrication in 18 screens.

**[#6 REFUTED on the model path]** Marcus (athletics) PASSED: podiums→Awards, national-team→Membership,
head-coach-to-medals→Critical role, sponsorship→Remuneration; Scholarly=None treated as **expected** (no
penalty, no remedy nudge); **zero fabrication**. Rule-5-as-prose holds on a capable model, so #6 is a
weaker-model / keyless-mock concern only. The keyless-mock ORIGINAL false-positive (#3, deterministic
code) is untouched and still stands.

**1b FIXED 2026-06-23** (the upstream seam — the L2 root cause of the draft losses). `buildQualifyPrompt`
now instructs the model to capture the SPECIFIC, load-bearing facts in each criterion's `evidence`
(named entities, numbers, dates, venues, awards, metrics) and explains WHY — *the evidence field is
reused verbatim by a later drafting step that never sees the profile, so a fact dropped here cannot
appear in the petition.* Still binds Rule 2 (invent nothing). Pure prompt change, no schema/type/DB
change; unit-tested; 431 tests green. _Live delta re-run pending._
