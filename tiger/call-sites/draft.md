---
id: draft
type: tiger/call-site
modality: text
file: src/app/api/draft/route.ts:24
wrapper: executeAiOperation + draftSpec (src/features/drafting/draftOperation.ts)
provider: gemini (prod) | claude (dev)
model: tier "long" → GEMINI_DRAFT_MODEL ?? gemini-3-flash-preview (unset → flash) | claude sonnet
operation: draft
tier: xl (12 tokens — the premium op)
schema: yes — tryParseDraftResponse (drafting.ts:366) via extractJson + tryParseSections; toSection (drafting.ts:334)
grounding: 2.5/5 (L1+L2 — loss is at the qualify→digest seam + Partial-criterion suppression, not the model)
quality_score: CONDITIONAL (L2 Opus-low; kenji/noa/ingrid all CONDITIONAL; specific + ZERO fabrication, but drops load-bearing facts on sub-threshold criteria)
code_score: strong plumbing; 2 model/code gaps (Flash-on-xl, no cache/repair)
recommended_model: mid-tier long-context @ standard thinking (Lens-3 [[2026-06-24-lens3-draft-models]]: quality saturates at sonnet-class ≈ 87; haiku-class ≈ 72; opus adds ~nothing) → set GEMINI_DRAFT_MODEL to a Pro-class model, A/B with real Gemini
value_ceiling: $4,116/petition (displaceable drafting labor — [[value-model]])
status: drilled + benchmarked (L2 + drill + Lens-3)
last_scanned: 2026-06-24
characters: ["[[sam-founder]]", "[[priya-researcher]]", "[[kenji-oss-engineer]]", "[[lucia-filmmaker]]", "[[noa-composer]]", "[[ingrid-architect]]", "[[marcus-athlete]]", "[[gloria-paralegal]]", "[[maya-attorney]]"]
---
## What it does
Drafts a full U.S. petition letter (O-1A/O-1B/EB-1A) as attorney work product — Introduction,
one section per Met/Strong criterion, Conclusion. Entry: `POST /api/draft` with `{caseId}` (DB,
owner-only) or inline `{petitioner, classification, criteria}` (keyless demo). UI surface: the
drafting studio. **The wedge** (Phase-2) and the single biggest time/cost save in the product.

## Prompt & grounding
`buildDraftPrompt` (drafting.ts:218). Strong injection defense (`<<<CASE_DATA>>>` fence, data-not-
instructions), strict citation discipline (no fabrication; no case law; inline `(Exhibit N)` only
to on-file exhibits when present), field-norm framing (`draftFraming`, drafting.ts:185 — behind-the-
scenes leads, EB-1A final-merits). Generate opts: `json:true, tier:"long"` (draftOperation.ts:171).
- **Reaches the prompt:** petitioner name, classification, scored criteria (name/status/evidence/
  rationale), exhibits on file (attachExhibits, drafting.ts:620). ✓✓✓
- **MISSING (senior would want):** the applicant's raw CV / source documents — only the *pre-scored
  criteria digest* reaches the model, never the underlying material (PN-DRAFT-01, accepted minor).
  → **grounding ≈ 3/5; the richness ceiling is the criteria digest.** This is the top value lever.

## Code quality (wrapping · logging · caching)
- Chokepoint ✓ (executeAiOperation). Typed schema + parse + canonical fallback ✓. **Adjudicate gate
  ✓** (draftOperation.ts:205 — fabrication / case-law / unresolved-exhibit-citation checks).
- Telemetry ✓ via `trackLlm` (client.ts) — provider/model/tokens/latency/status, customer-attributed.
- **No input-hash output cache** (cross-cutting) — an identical re-draft re-bills 12 tokens + re-runs.
- Prompt-bloat: bounded on regen (section context trimmed to 600 chars); full-letter prompt scales
  with criteria/exhibit count — watch on heavy cases.

## Findings (L1 — [[2026-06-23-l1]])
- **[value · H/H/H] Digest-only grounding ceiling** (backlog #1). Only `criteriaLines` (name/status/
  evidence/rationale) + exhibits reach buildDraftPrompt (drafting.ts:158/218); raw CV/source never
  does. STRICT RULE 1 (drafting.ts:225) + digest = generic, conclusory prose for specificity-heavy
  cases (OSS adoption, composer productions, EB-1A venues). noa/ingrid/kenji all CONDITIONAL.
  Fix: fenced `<<<BACKGROUND_MATERIALS>>>` raw-evidence block (enrich, never cite, invent nothing),
  or widen qualify evidence extraction. → grounding 2.5/5 → ~4/5.
- **[model · H/H/H] Premium op on a non-premium model** (backlog #2). `tier:"long"` →
  `GEMINI_DRAFT_MODEL ?? fast`; unset here → xl runs on Flash like the 1-tok ops (config.ts:36-40).
  Fix: set+benchmark a long model, or document & reprice. Needs Lens-3.
- **[code · M/H/H] No self-repair re-prompt** (backlog #7): a truncated xl letter (token ceiling) →
  guard-null → silent mock, unrecoverable. Add a one-shot JSON-repair retry.
- **[value · M/H/M] EB-1A section-per-criterion structure** (backlog #8) biases a checklist letter vs
  the final-merits framing draftFraming asks for; no redline. Add Conclusion synthesis + critique gate.
- **[code · M/H/M] No output cache** (backlog #5) + **telemetry misses attempts/reclaimed/source**
  (#10) + **no maxOutputTokens** (#11).
- _Protect:_ exhibit-citation hard-gate, injection fences, citation discipline, charge-then-reclaim.

## L2 live (Opus-low — [[2026-06-23-l2]])
The naive "digest→generic" hypothesis was **refuted**: Opus-low marshals every specific that reaches
the prompt, with correct field framing, and **invents nothing** (all 3 drafts). Real, confirmed defects:
- **[CONFIRMED] Partial/None criteria suppressed → load-bearing facts vanish.** "ONE section per
  Met/Strong" (drafting.ts:250) dropped Ingrid's Helsinki Library (1.2M visitors/yr, filed under
  Original-contribution:Partial) and Noa's press feature (Reviews&press:Partial) entirely. No path to
  carry a strong fact from a weak criterion into the Conclusion/totality. Worst for EB-1A final-merits.
- **[CONFIRMED] qualify→digest compression is the lossy step** — fix is upstream (richer evidence
  capture / pass raw evidence), not the draft prompt.
- **[minor] honest-gap note missing** — Kenji's draft silently skipped Scholarly instead of "papers
  are the gap". _Protect: zero fabrication held under low thinking._

**FIXED 2026-06-23** (drafting.ts, the Partial-criterion fact rescue): `buildDraftPrompt` now computes
`undraftedSupportedCriteria(...)` with non-empty evidence and appends `totalityRule(names)` — names the
"Partial, supporting-not-independently-strong" criteria and instructs the model to weave their concrete
facts into the Introduction/Conclusion totality (no dedicated section, no fabrication, EB-1A final-merits
emphasis). So Ingrid's Helsinki Library no longer vanishes. Pure + unit-tested; backward-compatible
(absent when nothing is sub-threshold-with-evidence).

**1b also FIXED 2026-06-23** (the upstream lever, in [[qualify-screening]]): `buildQualifyPrompt` now
instructs the model to capture the SPECIFIC facts in each criterion's `evidence` (names/numbers/dates/
venues/metrics) and tells it WHY — that field is reused verbatim by drafting, so a dropped specific is
lost to the petition. Together the two fixes close the seam: qualify retains the specifics → draft routes
even sub-threshold ones into the totality.

## DRILL (v2, [[2026-06-23-drill]]) — value curve, judged vs a $10–15k firm letter
**Hardened k=4 (authoritative):** v1 shipped #115 **76.8** (70–81) / moderate / **$2,627** → **v3p
+market-bar framing (PROMPT-ONLY)** **87.8** (82–91) / 3-of-4 light / **$3,575** → v3r +raw evidence 87.8 /
$3,550 (**raw adds nothing — dead**). **SHIP decision: market-bar framing = +11 market / +$948/petition,
non-overlapping distributions → GO → ✅ SHIPPED PR #116** (`marketBarFraming("letter")`, single-sourced with
rfe in criteria-text.ts). Zero fabrication across all 12 generations. The shipped #115 fixes
keep the facts PRESENT (necessary) but argumentation framing (Kazarian step-two + field-norms) is what
reliably clears the market bar. Residual (88→~95+) needs a citable field-norms selectivity dataset, not a
prompt. _(Single-sample exploratory curve was optimistic — see [[2026-06-23-drill]].)_
