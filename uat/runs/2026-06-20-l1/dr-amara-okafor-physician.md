# L1 review — Dr. Amara Okafor (EB-1A physician-scientist)

- **Character:** dr-amara-okafor-physician · **Segment:** beneficiary (EB-1A self-petitioner)
- **Journeys walked:** qualify-verdict, draft-petition-letter, organize-evidence, track-case-progress
- **Date:** 2026-06-20 · **cert_level:** L1 (theoretical, code-grounded, no browser)
- **Engine for the live paths (L2):** real Claude via CLI (`LLM_ENGINE=claude`); L1 judges the *designed* path + grounding only.

## Reachability resolved (before judging)

- Dev-auth `developer@localhost` reaches `/`, `/qualify`, `/dashboard`, `/dashboard/cases/[id]` — all in my surface binding. No attorney gating touches my four journeys (the queue/sign/file wall is out of my path by design).
- **Pack reachability is the load-bearing question for me.** `packFor()` falls back to O-1A for unknown/unset classification (`packs.ts:223-225`). I traced every path that sets classification:
  - **`/qualify` "I already know my visa"** → `QualifyPanel` `<select>` is built from `livePrograms()` (`QualifyPanel.tsx:15,147-151`), which includes EB-1A (`jurisdictions.ts:63,96-98`). Selecting it sends `classification:"EB-1A"` to `/api/qualify`, which validates via `isLiveProgram` and **persists it** to my case (`route.ts:108-110` qualify, `route.ts:97-99` persist `classification: req.classification`).
  - **`/qualify` "Find my best path"** → `BestPathFinder` scores all live programs and `choose("EB-1A")` flows through the one-shot prefill into `QualifyPanel`, which re-hydrates `classification` via `isClassification` (`QualifyPanel.tsx:63-65`, `prefill.ts:36-44`).
  - **`/` InstantVerdict hero** → `<select>` from `livePrograms()` too (`InstantVerdict.tsx:24,119-130`); `goDeeper` carries my chosen EB-1A into `/qualify` (`InstantVerdict.tsx:91-93`).
  - **Case detail** → `CaseDetailView` reads the persisted `classification` and threads EB-1A into the criteria header, `EvidenceVault`, `DraftStudio`, and `RfeStudio` (`CaseDetailView.tsx:75,144,193-209`); the page hydrates it straight from the DB (`[id]/page.tsx:76`).
  - **Verdict:** the dreaded "EB-1A silently swapped for the O-1A 8-pack" does **not** happen on any path where I pick EB-1A. Fallback only fires for unset/garbage input — which my flows never produce. Acceptance criterion #2 **passes at L1**.

---

## Journey 1 — qualify-verdict · **L1-pass**

**Walkthrough (in-character).** I land on `/` or `/qualify`, paste my record (trials, the NCCN-style guideline, JCO/NEJM journals, NIH study-section review, my FASCO-tier fellowship, the lay-press quote), pick **EB-1A**, and submit. The authenticated `/api/qualify` builds the prompt from the **correct EB-1A 10-criterion pack** (`buildQualifyPrompt` → `packFor(req.classification)` → `pack.criteria.map(...)`, `qualification.ts:120-141`) and — critically — feeds the model **my entire pasted profile verbatim** (`qualification.ts:159-162`). The prompt's STRICT RULE #4 explicitly forbids letting one criterion's evidence satisfy another ("publications and citations are scholarly authorship, not by themselves an original contribution") — exactly the discipline I want so my citation count doesn't get smeared across every box. The criteria names are passed verbatim, the threshold is the pack's own (`CriteriaReport` receives `packFor(classification).threshold` = 3 of 10, `QualifyPanel.tsx:270`), and unscored "None" rows render neutral, never green (`CriteriaReport.tsx:20-26`, `criteria.ts:39-48`). The QualifyPanel even surfaces the **validation line** — "Criteria per 8 CFR 204.5(h)(3) · 3 of 10 criteria... · validation & sources" (`QualifyPanel.tsx:159-170`, `validation.ts:103-126`) — and that record states the ten criteria match 8 CFR 204.5(h)(3)(i)-(x) verbatim in set and order. That is the most reassuring thing I have seen from an immigration tool. The `DISCLAIMER` renders first and prominently (`CriteriaReport.tsx:47-48`, `result.ts:37-41`), and a live adjudication report scores the screening against a UPL tripwire + structural invariants in real time (`adjudication-gates.ts:294-313`, qualify route `route.ts:72-83`).

**The one real risk I can see in code:** the **InstantVerdict hero verdict is the deterministic keyword mock**, not the model (`/api/qualify/preview` → `mockQualification`, `preview/route.ts:62-70`). The mock scores by regex. My crown-jewel mapping — **guideline authorship → Original contribution** — is **not** in the ORIGINAL regex (`packs.ts:62-70`: patent/novel/pioneered/open-source/shipped… but **no "guideline"**), so the hero will under-score my single strongest EB-1A argument. This is honestly labeled ("This was an instant keyword read… the full screening reads your whole record in depth", `InstantVerdict.tsx:271-277`) and the depth is explicitly routed to the real model behind sign-in, so it is a **designed mitigation, not a defect** — but it is the felt risk that confirms my central worry, and it is a real L2 quality check on the *model* path: does Claude map my guideline to Original contribution and my trial leadership to Leading/critical role?

**Grounding:** real pasted profile reaches the model prompt (the whole point). Sources the output *should* use: (1) pasted background ✓ verbatim, (2) the EB-1A criteria pack ✓, (3) the threshold ✓, (4) my structured fields N/A at qualify time. **grounding 3/3 of what exists at this step.**
**Est. time-saved-if-it-worked:** the read itself replaces a $0 anchor (firms don't sell a 3-minute read) but de-risks the $7.5k–$15k commitment — call it the "should I even self-petition" decision, in under 5 minutes.

---

## Journey 2 — draft-petition-letter · **L1-conditional**

**Walkthrough.** From my EB-1A case I hit "Draft the petition" in `DraftStudio`. On the DB path the route ignores the inline body and rebuilds the request from my **persisted criteria** + the **vault exhibits** (`draftOperation.ts:147-162`, `attachExhibits`), prompts with hard citation discipline ("Use ONLY the facts provided… Do NOT invent awards, publications, employers, dates, citation counts", `drafting.ts:180-208`), forbids case-law cites, fences applicant data against prompt injection, and only cites `(Exhibit N)` numbers that resolve to real on-file documents (`drafting.ts:160-166`; `auditCitations` quarantines any hallucinated exhibit, `drafting.ts:593-608`). Every output carries the `DISCLAIMER` + a "work product for the attorney to review & sign" frame (`DraftStudio.tsx:444,587`). Per-section **regenerate now preserves the rest of the letter** — the client's current sections ride along as read-only continuity context (`draftOperation.ts:173-181`, `buildSectionPrompt(..., otherSections)`, `drafting.ts:222-267`), and the merge keeps my unsaved edits to other sections (`pickMergeBase`, `draftOperation.ts:75-93`). The live adjudication gate scans the generated prose for fabricated specifics, leaked visa codes, and case law (`draftOperation.ts:213-229`, `adjudication-gates.ts:300`). Drafts persist versioned and the case detail re-opens hydrated from the latest (`[id]/page.tsx:89`, `CaseDetailView.tsx:202-209`).

**Why conditional, not pass — two issues that matter to me specifically:**

1. **The fabrication scanner is numbers-only; it cannot catch a garbled *medical* fact (my #1 pet peeve).** `fabricatedSpecifics` flags money, %, 4-digit years, and integers ≥100 (`adjudication-gates.ts:83-127`). It would catch an invented enrollment number ("1,240 patients") or a fabricated citation count — good. But it would **not** catch: an invented or misnamed **trial**, a **wrong phase** ("Phase III" is roman / "Phase 3" is the integer 3, < 100 and ignored as "argument scaffolding", `adjudication-gates.ts:88-90`), or a **society I don't belong to** (a textual noun, not a number). My acceptance criterion #4 ("zero fabricated trials, phases, enrollment numbers, citations, or societies") is therefore only *partially* machine-guarded. The prompt instruction not to fabricate is the real defense; the live gate is a weaker backstop than it looks for qualitative medical facts. This is the single thing I'd most want L2 to probe with a real adversarial paste.

2. **The Studio's own intro copy hard-codes "O-1A petition letter" for my EB-1A case** (`DraftStudio.tsx:374` body text + the section comment `:40`). The generated letter and headings use my real classification (the prompt is parameterized, `drafting.ts:177`), and the case header says EB-1A (`CaseDetailView.tsx:144`) — but the affordance paragraph I read *before* clicking says "Draft a full **O-1A** petition letter from your scored criteria." For an oncologist who is acutely worried the tool will mishandle her category, reading the wrong visa name on the draft button is a credibility ding. Note: the project's own `EVALUATION.md:72` flags the *model-output* O-1A leak as a gate target — but that gate scans generated `outputText`, not this static React copy, so this instance is **uncovered**.

**Grounding (the heart of my adoption decision).** Real context the draft *should* use, and what reaches the prompt:
1. my scored EB-1A criteria (name/status/**evidence/rationale**) — ✓ (`draftOperation.ts:149-153`)
2. my vault exhibits + extracted facts — ✓ (`attachExhibits`, `draftOperation.ts:160-161`)
3. the correct classification — ✓ (persisted EB-1A)
4. the rest of the letter on a section regen — ✓ (now passed, `draftOperation.ts:178`)
5. **my full pasted CV / trial designations / guideline title / journal names** — **✗ not directly.** The draft argues from the *per-criterion evidence/rationale the qualify model captured*, not the raw CV. → **grounding 4/5.**

That 5th gap is **BACKLOG G1.3 / PN-DRAFT-01 — RESOLVED (accepted 2026-06-19, no code change):** L2 proved the live draft already names the supplied specifics because the qualify model persists them into the criteria evidence/rationale, and the "populate the vault first" nudge shipped (`DraftStudio.tsx:378-387`). I do **not** re-report it; I flag only that for *medical* evidence this is the exact seam where my guideline/trial specifics could thin out, and it is the headline L2 quality check. (G1.1/dc-draft-02 — section continuity — I confirm **FIXED** in code; a strength, see "What passed".)

**Est. time-saved-if-it-worked:** the firm anchor for a physician/researcher EB-1A is **$7.5k–$15k + 2–3 months** of drafting plus the labor of teaching a generalist why a guideline outranks a citation count. A correctly-mapped first draft in an afternoon my own attorney refines saves the **drafting weeks** and that teaching tax — *if* the model maps guideline→Original contribution and trial→Leading/critical role on real prose. That "if" is L2's to settle.

---

## Journey 3 — organize-evidence · **L1-pass**

**Walkthrough.** In the EvidenceVault I paste a document (my guideline PDF text, a trial protocol, my NIH study-section appointment letter). The categorize route follows **my case's classification pack** (`categorize/route.ts:58-59,80` → `buildCategorizePrompt(req, classification, existingBuckets)` → `criteriaNames(classification)`, `evidence.ts:106-143`), feeds the model **the real document name + content** (`evidence.ts:136-139`), forbids invented facts, and now also passes a **read-only whole-vault summary** so a new doc is placed consistently with its siblings (`summarizeVaultBuckets`, `evidence.ts:84-101`; route `categorize/route.ts:64-75` — G2.1/PN-EVID-01 partially shipped). The result is gated to a real pack bucket or "Unsorted" (`coerceBucket`, `evidence.ts:145-148`), exhibit numbers are assigned monotonically by the data layer (per accepted scope, text-paste path), coverage/gaps are derived from real placement against the EB-1A ten (`summarizeVault`, `evidence.ts:226-244`), and the adjudication gate asserts the bucket is in the EB-1A pack (`adjudication-gates.ts:271-279`). DISCLAIMER present (`buildCategorizeResult`, `evidence.ts:201-206`).

**The pet-peeve check — "Artistic exhibitions: Met" for an oncologist.** The EB-1A pack genuinely contains an **"Artistic exhibitions"** criterion (`packs.ts:153-158`) because 8 CFR 204.5(h)(3) lists all ten and the pack mirrors them verbatim (`validation.ts:124-125`). That is **legally correct**, not a defect — and the keyword mock would only bucket a doc there on the regex `/exhibit|exhibition|showcase|gallery|display|showing/i` (`packs.ts:155`). None of my oncology evidence trips that, so I won't see a nonsensical "Met". The honest concern is the inverse of my crown jewel: the keyword **mock** for ORIGINAL doesn't match "guideline" (`packs.ts:67`), so on the keyless path my guideline could land in Unsorted; on the **model** path (the live UAT engine) the prompt sees the full text and the criterion names, so this is an L2 quality check, not an L1 structural gap.

**Grounding:** real doc name ✓ + real content ✓ + the case's pack ✓ + existing-bucket context ✓. **grounding 4/4.**
**Est. time-saved-if-it-worked:** the index + gap read replaces hours of manual exhibit assembly and tells me what to chase before I pay anyone to draft — call it the upstream half-day per evidence pass.

---

## Journey 4 — track-case-progress · **L1-pass**

**Walkthrough.** `/dashboard` lists my **real** EB-1A case *above* the illustrative mock portfolio, with its real classification badge and status (`CaseFileDashboard.tsx:31,136-171`); the empty state points me to `/qualify` (`:112-132`). The case detail shows status + a roadmap stepper derived purely from real state — `caseRoadmap(status, {hasEvidence: documents.length>0, hasDraft})` (`roadmap.ts:38-59`, `RoadmapStepper.tsx:31`, wired `CaseDetailView.tsx:133-137`) — so adding evidence / drafting / submitting actually advances me through Qualified→Evidence→Drafted→Review→Filed→Decision. Deep link "Open case file →" resolves to `/dashboard/cases/[id]` hydrated from the DB (`QualifyPanel.tsx:284-291`, `[id]/page.tsx:62-69`). I'm never stranded — every state has a next action. The mock "Dr. Anya Krishnan · O-1A · Phase III of IV" header is the **accepted illustrative demo** (`accepted-gaps.md`: "Mock demo case file"), so its O-1A label is by-design, not a finding.

**Grounding:** N/A (not an AI surface) — roadmap derives from real persisted state. **grounding n/a.**
**Est. time-saved-if-it-worked:** replaces the "email the firm and wait for a status update" loop with an at-a-glance stage read — minutes per check, and the peace of mind I'm actually paying for.

---

## Findings table

| id | journey | type | severity | dimension | impact (f/r/t) | title | code_check | verdict |
|---|---|---|---|---|---|---|---|---|
| ao-draft-01 | draft-petition-letter | trust | major | trust | med/med/high | Fabrication gate is numbers-only — can't catch a garbled trial name, wrong phase, or invented society | present-broken | confirmed |
| ao-draft-02 | draft-petition-letter | confusion | minor | clarity | high/high/med | DraftStudio intro copy hard-codes "O-1A petition letter" for my EB-1A case | present-broken | confirmed |
| ao-qual-01 | qualify-verdict | quality-gap | minor | senior-quality | high/med/med | InstantVerdict keyword mock doesn't map guideline→Original contribution (under-scores my crown jewel) | by-design | confirmed |
| ao-evid-01 | organize-evidence | quality-gap | minor | senior-quality | med/low/low | Keyword-mock categorize has no "guideline" signal for Original contribution | by-design | confirmed |
| ao-pack-01 | qualify-verdict | strength | polish | trust | — | EB-1A 10-pack reaches end-to-end; no silent O-1A fallback on my paths | by-design | confirmed |
| ao-grnd-01 | qualify-verdict | strength | polish | trust | — | Qualify prompt receives my full pasted profile verbatim + criterion-isolation rule | by-design | confirmed |
| ao-adj-01 | draft-petition-letter | strength | polish | trust | — | Live UPL/case-law/disclaimer adjudication on every paid generation | by-design | confirmed |
| ao-cont-01 | draft-petition-letter | strength | polish | senior-quality | — | Section regenerate now preserves the rest of the letter (G1.1 fixed) | by-design | confirmed |
| ao-val-01 | qualify-verdict | strength | polish | trust | — | EB-1A pack validated verbatim vs 8 CFR 204.5(h)(3)(i)-(x), surfaced in-UI | by-design | confirmed |

---

## First-person review — in my voice

I came in braced to be reduced to an h-index, and the bones of this thing are better than I expected. The single fact that earns my trust is structural: when I pick EB-1A, I am actually scored on the **ten** statutory criteria, the threshold is **3 of 10**, and the panel tells me to my face that the pack matches **8 CFR 204.5(h)(3)(i)-(x) verbatim** with a link to sources. No tool has ever shown its work to me like that. The qualify prompt eats my **whole pasted record**, not a summary, and it explicitly refuses to let my citation count masquerade as an original contribution — that is the exact discipline a good physician-immigration attorney brings, written into the prompt. The disclaimer rides on every output, my own attorney signs, and there is a live tripwire watching for legal-advice drift on every paid call. On a tumor board I'd accept this as a sound *protocol*.

Two things stop me short of "adopt without supervision." First — and this is the one that would make me hover my pen — **the fabrication backstop only watches numbers.** It will catch an invented enrollment count, but it will *not* notice if the draft calls my Phase III trial "Phase II," renames it, or attributes me to a society I don't belong to. Those are the errors that get a physician's petition laughed out of an RFE, and they're precisely the textual, qualitative facts the gate is blind to. The prompt *tells* the model not to fabricate, and L2 with real Claude may well behave — but at L1 I can only say the automated guarantee is thinner than the marketing implies for *medical* evidence. Second, smaller but it nicks the same nerve: the draft button still reads **"Draft a full O-1A petition letter"** on my EB-1A case. I notice that immediately, and it makes me wonder what *else* assumed O-1A under the hood. (Nothing did — but the copy plants the doubt.)

The deepest open question is one only L2 can answer: does the real model, drafting from the *captured criteria* rather than my raw CV, actually argue **guideline authorship as Original contribution of major significance** and **trial leadership as a leading/critical role** — or does it bury them under "scholarly articles"? The team already wrestled this (G1.3/PN-DRAFT-01) and accepted the grounding because L2 proved the model names supplied specifics; I'll trust that for engineering specifics, but a *guideline* is a subtler mapping than a patent number, and I want to see it on real prose before I tell a colleague to use this. Would I adopt it? **For the qualify read and the evidence sort, today, yes** — they're honest and they're fast. For the draft, **conditionally**: I'd run it, then read every section against my own record with the assumption it can garble a medical fact silently. If L2 shows the guideline mapping lands and no trial gets mis-phased, this saves me the drafting weeks *and* the tax of teaching a generalist my field — which is the whole reason I'd pay. Would I tell a peer? "Use the screener and the vault now; treat the draft as a smart intern's first pass, not a senior's." That's still a real afternoon vs. the firm's two months.

## What passed (protect these)

- **EB-1A pack correctness, end-to-end.** Ten statutory criteria, 3-of-10 threshold, persisted classification threaded into qualify → case → criteria UI → evidence buckets → draft → RFE with **no O-1A fallback on any reachable path** (`packs.ts:223-225` only fires on garbage; `QualifyPanel.tsx:147-151`, `route.ts:97-99`, `CaseDetailView.tsx:144,193-209`).
- **Validation transparency.** The verified 8 CFR 204.5(h)(3) record, surfaced in-product with "validation & sources" (`validation.ts:103-126`, `QualifyPanel.tsx:159-170`) — exactly the citizenship-of-sources an evidence-driven user demands.
- **Real grounding at qualify + categorize.** Full pasted profile and full document text reach the model prompts, with a criterion-isolation rule that stops citation-count smear (`qualification.ts:120-164`, `evidence.ts:106-143`).
- **Live adjudication on every paid generation** — disclaimer + UPL tripwire + case-law flag + classification-consistency + fabrication scan, one shared source of truth with the eval harness (`adjudication-gates.ts:294-313`).
- **Citation discipline + exhibit audit** — the draft can only cite `(Exhibit N)` numbers that resolve to real on-file documents; hallucinated exhibits are quarantined (`drafting.ts:160-166,593-608`).
- **Section regenerate continuity (G1.1 fixed)** — the rest of the letter is now passed as read-only context and unsaved edits survive the merge (`draftOperation.ts:75-93,173-181`).
- **Honest self-labeling** — InstantVerdict openly calls itself "an instant keyword read," the keyless draft stamps "Placeholder output," and the roadmap derives from real state. The build flags its own boundaries instead of hiding them.
