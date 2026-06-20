# L1 report — Ravi Menon (EB-1A physics postdoc)

- **Character:** ravi-menon-postdoc · **segment:** beneficiary (EB-1A self-petitioner)
- **Journeys walked:** qualify-verdict, draft-petition-letter, organize-evidence, track-case-progress
- **Date:** 2026-06-20 · **cert_level:** L1 (theoretical, code-grounded, no browser)
- **Reachable surface set:** `/` (InstantVerdict hero), `/qualify` (BestPathFinder → QualifyPanel),
  `/dashboard`, `/dashboard/cases/[id]` (criteria · EvidenceVault · DraftStudio · RoadmapStepper).
  Dev-auth synthetic user `developer@localhost` owns his cases. Attorney **queue**/sign/file are
  walled out by `isConfiguredAttorney` fail-closed — by design, out of Ravi's set (he's the
  beneficiary, not the attorney). RFE Studio only mounts on a Filed case (`CaseDetailView.tsx:224`).

## Headline: the pack-correctness fear is answered in code

Ravi's single worst outcome is "the EB-1A 10-pack silently replaced by the O-1A 8-pack because the
classification defaulted." I followed the whole chain and it holds end-to-end, and there is even a
**live runtime tripwire** that fails closed if it ever broke:

- The EB-1A pack is exactly the 10 criteria of 8 CFR 204.5(h)(3)(i)-(x) — Awards, Membership, Press,
  Judging, Original contribution, Scholarly articles, Artistic exhibitions, Leading/critical role,
  High remuneration, Commercial success in the arts (`packs.ts:142-168`); threshold 3
  (`packs.ts:145`). The validation record confirms "ten criteria … match … verbatim in set and
  order; threshold 3 of 10" (`validation.ts:103-126`).
- `packFor()` *does* default to O-1A on unset (`packs.ts:223-225`) — but `isLiveProgram("EB-1A")` is
  true (`jurisdictions.ts:63,101-103`), so when the UI sends `classification:"EB-1A"`,
  `parseQualifyRequest` keeps it (`qualification.ts:108-110`) and the prompt/parser/mock all read
  `packFor("EB-1A")` (`qualification.ts:121,202,227`).
- EB-1A is selectable at all three entry points: the hero dropdown (`InstantVerdict.tsx:24,125`),
  the BestPathFinder cards (`BestPathFinder.tsx:166,249` pass the real `p.classification`), and the
  QualifyPanel dropdown (`QualifyPanel.tsx:15,147`). BestPathFinder → `onContinue` → `writeQualifyPrefill`
  → QualifyPanel reads it and `isClassification("EB-1A")` accepts it (`QualifyPanel.tsx:63-65`).
- Persistence keeps it: `createCase` stores `req.classification` (`api/qualify/route.ts:98`,
  `petitions.ts:76`), case detail loads `stored.classification` and threads it to the criteria
  header, EvidenceVault, and DraftStudio (`cases/[id]/page.tsx:76`, `CaseDetailView.tsx:143,195,204`).
- **The tripwire:** the live qualify adjudication asserts the returned criteria equal
  `criteriaNames(classification)` in canonical count AND order — "expected 10 … got 8" is a hard
  **fail** that renders a "blocked" badge (`adjudication-gates.ts:244-253,302`). A drafted letter
  that leaked "O-1A" into his EB-1A petition would hard-fail `classificationGate`
  (`adjudication-gates.ts:163-171,227-233,300`). Ravi's nightmare is actively policed at runtime.

So acceptance criterion #2 (scored on the correct EB-1A 10-pack, ≥3 threshold, not the relabeled
O-1A 8-pack) **landed in code**. The default fallback only bites if classification is never set —
which on Ravi's reachable paths it always is.

---

## Journey 1 — qualify-verdict · **L1-pass**

**Walkthrough (in-character).** I land on `/` or `/qualify`. The best-path finder scores my profile
against O-1A · O-1B · EB-1A in one pass and tells me EB-1A is a green card (`best-path.ts:29,120-135`)
— exactly the comparison I want, since the whole point is I need permanent status, not another temp
visa. I pick EB-1A, my pasted record carries over untyped (`prefill.ts`), and the full screening runs
on the real Claude engine (`LLM_ENGINE=claude`). The prompt is fed my **actual pasted background**
(`qualification.ts:159-163` interpolates `req.profile`), instructs criterion-specific scoring and no
fabrication (`:128-138`), and lists the **exact 10 EB-1A criterion names** (`:140-141`). The report
renders with the EB-1A threshold of 3 (`QualifyPanel.tsx:270` passes `packFor(classification).threshold`),
denominator `criteria.length` is dynamic (=10), and an unscored "None" never renders green
(`CriteriaReport.tsx:20-26,40-43`). The disclaimer renders first and is non-dismissible
(`CriteriaReport.tsx:47-48`). Likelihood is clamped 0-100 and validated by an adjudication gate
(`adjudication-gates.ts:261-266`).

**Grounding 6/6** (profile text ✓, EB-1A pack/criteria ✓, threshold ✓, name ✓, gaps derived from
real coverage ✓, disclaimer ✓). The qualify prompt receives the full pasted record — this is the
richest-grounded surface in the app.

**Honest caveat I'd want L2 to prove:** my Membership pet peeve. The keyless MOCK is pure keyword —
any "society/member/fellow/fellowship" string flips Membership to "Met" (`packs.ts:44-49`,
`qualification.ts:229-232`), which is exactly the dues-only rubber-stamp I hate. But that path is the
no-engine fallback; under `LLM_ENGINE=claude` the model is told to score "Met" only when "clear,
well-evidenced" and to score each criterion from its own evidence (`qualification.ts:128-147`).
Whether the *live* model actually assesses my society against the "outstanding-achievement,
judged-by-experts" bar (vs. waving it through on the word "society") is genuinely an L2 question — L1
can only confirm the prompt instructs it, not that the prose delivers it.

**Est. time-saved if it works:** an honest EB-1A go/no-go + scored 10-pack in ~2 min vs. a
$7.5k–$15k / 2–3-month firm intake. Massive against the J-1 clock — *if* the live read is candid.

---

## Journey 2 — draft-petition-letter · **L1-pass** (one minor)

**Walkthrough.** From my EB-1A case I hit "Draft the petition." The DB path loads my case's real
petitioner + **classification ("EB-1A")** + persisted criteria and fuses my vault exhibits in
(`draftOperation.ts:147-162`). The prompt forbids inventing awards/citations/venues/dates
(`drafting.ts:181-183`), fences my data against injection (`:189-192`), and — when I have exhibits —
enforces inline `(Exhibit N)` citing only listed numbers, never an invented one (`:160-166`). After
generation, `auditCitations` quarantines any hallucinated exhibit number as `unresolved`
(`drafting.ts:593-607`, surfaced in `ExhibitIndex` via `DraftStudio.tsx:447-454`). I can edit each
section inline and regenerate one section; the regenerate now passes the letter's **other current
sections** as read-only continuity context so a regenerated section won't duplicate the intro or
contradict siblings (`DraftStudio.tsx:213` → `draftOperation.ts:178` → `drafting.ts:222-267`) —
this is backlog **G1.1/dc-draft-02 shipped**. Drafts persist versioned and re-hydrate
(`page.tsx:89`, `CaseDetailView.tsx:207`). The disclaimer + a CitationNote ride on the output
(`DraftStudio.tsx:444-445`), and a live adjudication scores fabrication / wrong-code / case-law
(`draftOperation.ts:213-229`).

**Grounding 4/6.** The draft prompt is fed: my persisted **criteria** (name/status/evidence/rationale)
✓, my **vault exhibits + facts** ✓, classification ✓, petitioner ✓ — but NOT my full pasted CV and
NOT free-text press/grant detail beyond what the qualify step captured into the criteria evidence.
This is the accepted, by-design grounding (backlog **G1.3/PN-DRAFT-01 — RESOLVED, accepted**: L2
already proved the live draft names the supplied specifics because qualify persists them into the
criteria evidence/rationale, which *is* the petition's argument). I'm recording it as the grounding
ceiling, not a defect.

**Minor (clarity/trust):** DraftStudio's idle blurb hardcodes "Draft a full **O-1A** petition letter"
(`DraftStudio.tsx:374-377`) even when `classification` is "EB-1A". For a self-critical petitioner
already anxious about being shown the wrong product, reading "O-1A" while drafting my EB-1A case is a
small doubt-seed. The actual prompt/heading use the dynamic classification correctly — it's only this
one hardcoded sentence (and the module docstring). Cheap copy fix.

**Est. time-saved if it works:** a correctly-EB-1A-packed first draft mapping papers→Scholarly
articles, peer review→Judging, grants→Awards, novel results→Original contribution, in an afternoon I
can hand to counsel — vs. the firm's months. Criterion #7 plausibly met *structurally*; L2 owns the
prose-quality proof.

---

## Journey 3 — organize-evidence · **L1-pass**

**Walkthrough.** In my EB-1A case the Evidence Vault buckets follow MY pack: `BUCKETS` and the
coverage summary use `criteriaNames("EB-1A")` / `summarizeVault(docs, "EB-1A")`
(`EvidenceVault.tsx:55-56`), so I sort into the EB-1A ten (Scholarly articles, Judging, Awards…),
not the O-1A eight. The categorize POST sends my classification (`:72`); the route resolves it and
also passes a read-only summary of what's already filed so a new doc is placed consistently with its
siblings — backlog **G2.1/PN-EVID-01 shipped** (`evidence.ts:84-143`,
`api/evidence/categorize/route.ts:64-75`). The prompt bases facts only on the document and may pick
"Unsorted" honestly (`evidence.ts:118-119`); a live gate fails any bucket not in the EB-1A pack
(`adjudication-gates.ts:270-278`). Exhibit numbers are monotonic and assigned server-side
(`lib/data/evidence.ts`), and the coverage meter shows covered/total with the gaps as warning badges
(`EvidenceVault.tsx:127-208`). The **honest-coverage line** is present: "documents present — not that
a criterion is proven … Refiling moves a document without re-checking its fit"
(`EvidenceVault.tsx:210-216`) — directly addresses backlog dc-evidence-02 (refile-inflates-coverage)
as a clarity note. Disclaimer rides on the AI output (`evidence.ts:201-206`).

**Grounding 4/4** for what this surface needs: document text ✓, EB-1A pack ✓, existing-vault context
✓, disclaimer ✓. Coverage/gaps are derived from real on-file buckets, not sample data.

**Est. time-saved if it works:** an EB-1A-bucketed, gap-flagged exhibit index in minutes vs. a
paralegal afternoon — and it tells me which of my thin criteria (press, exhibitions, commercial
success) to stop chasing before I draft.

---

## Journey 4 — track-case-progress · **L1-pass** (one polish)

**Walkthrough.** My dashboard lists my **real** EB-1A case in `YourCasesCard` ABOVE the mock demo
masthead, showing my real file number, classification, status, and likelihood
(`dashboard/page.tsx:30-38`, `CaseFileDashboard.tsx:31,136-172`); the empty state points to
`/qualify` (`:112-132`). Opening it, the roadmap derives purely from real state —
`caseRoadmap(status, {hasEvidence: documents.length>0, hasDraft: initialSections>0})`
(`CaseDetailView.tsx:133-137`, `roadmap.ts:38-59`) — Qualified → Evidence → Drafted → Review → Filed
→ Decision, with done/current/upcoming marked correctly as I add evidence and draft. The deep link
`Open case file →` (`QualifyPanel.tsx:287`) lands on `/dashboard/cases/[id]`, hydrated from saved
state. I'm never stranded: every state has an obvious next action.

**Polish (trust nit):** `newFileNumber()` hardcodes the **"O1-"** prefix for every case regardless of
classification (`petitions.ts:54-55`), so my EB-1A case shows `File № O1-4821` in the masthead and
dashboard row. The "EB-1A" classification label sits right beside it, so it's cosmetic — but for a
petitioner primed to fear the wrong-product swap, an "O1-" number on an EB-1A file is a momentary
"wait, am I in the O-1 flow?" flicker. A classification-aware prefix (or a neutral "IC-") would
remove it. Cosmetic only — the pack is correct everywhere.

**Scope note (not a defect):** the dashboard masthead + topbar still render the mock "Dr. Anya
Krishnan · O-1A" demo portfolio below my real case (`CaseFileDashboard.tsx:40-49`,
`DashboardView.tsx:32`, `page.tsx:206-228`). That's the accepted "Mock demo case file" gap — honest,
illustrative, and clearly separate from my real `YourCasesCard`. Recorded as a strength of honesty,
not a gap; suppressed per accepted-gaps.md.

**Grounding n/a** (no AI surface).

---

## Findings table

| id | journey | type | severity | dimension | impact (f/r/t) | title | code_check | verdict |
|---|---|---|---|---|---|---|---|---|
| rm-qual-01 | qualify-verdict | strength | polish | trust | — | EB-1A 10-pack reaches the whole flow end-to-end; live gate fails closed on a wrong/short pack | by-design | confirmed |
| rm-qual-02 | qualify-verdict | quality-gap | minor | senior-quality | low/med/high | Keyless mock auto-"Met"s Membership on a keyword; only the live model is told to apply the judged-by-experts bar | present-by-design | uncertain |
| rm-draft-01 | draft-petition-letter | confusion | minor | clarity | med/high/med | DraftStudio idle copy hardcodes "O-1A petition letter" on an EB-1A case | present-broken | confirmed |
| rm-draft-02 | draft-petition-letter | strength | polish | trust | — | Citation discipline + unresolved-exhibit quarantine + wrong-code adjudication gate (no fabricated authority) | by-design | confirmed |
| rm-draft-03 | draft-petition-letter | quality-gap | minor | senior-quality | med/high/low | Draft grounds on persisted criteria/exhibits, not the full CV (accepted G1.3) | by-design | refuted |
| rm-evid-01 | organize-evidence | strength | polish | trust | — | Vault is EB-1A-pack-aware; whole-vault consistency context + honest "present ≠ proven" framing shipped | by-design | confirmed |
| rm-track-01 | track-case-progress | confusion | polish | trust | low/high/low | File number hardcodes "O1-" prefix on an EB-1A case | present-broken | confirmed |
| rm-track-02 | track-case-progress | strength | polish | completion | — | Roadmap + real-cases-above-mock derive purely from real case state; never stranded | by-design | confirmed |

No blockers. No majors. 3 minors, 4 strengths, 1 polish-trust nit (+ 1 suppressed accepted-gap).

---

## First-person review — Ravi's felt verdict

I came in braced to be disappointed. Every academic I know who's looked at these tools got fed a
generic "you qualify!" and a draft that read like a chatbot — and the one thing I cannot afford on a
J-1 with under a year left is to file a loser. So I went straight for the thing that would kill it for
me: am I actually being scored on the **EB-1A ten**, or did it quietly drop me into the O-1 eight
because some default fired? I traced it, and it's clean — the ten criteria are the regulation's ten,
the threshold's three, and it carries my classification from the best-path pick all the way through
to the draft and the evidence buckets. What actually moved me is that there's a *guard*: if the model
ever handed back eight criteria for my EB-1A, the thing hard-fails and shows me a blocked badge
rather than smiling and lying. That's the posture I want from a tool I'm trusting with the clock.

The best-path comparison is genuinely the right opening move for me — it knows EB-1A is the green
card and says so, which is the entire reason I'm not just filing O-1A. And the fabrication discipline
reads like someone who's actually been burned by an RFE: it won't invent press I don't have, it won't
cite an exhibit that isn't on file, and it flags case-law cites for the attorney. That maps onto how
I think about my own record — I'd rather be told my membership is thin than be flattered.

Two things keep me from a clean rave, both honest rather than damning. First, the one place I'm still
nervous is exactly my softest criterion: in the no-engine fallback, "Membership" goes green the
instant it sees the word "society," which is the dues-only rubber-stamp I despise. The real model is
*told* to apply the judged-by-experts bar, but I can't see from the code whether the prose actually
does it — that's the test I'd want run live before I trust the verdict on my borderline society.
Second, a paper cut: the draft panel literally says "Draft a full O-1A petition letter" while I'm on
my EB-1A case, and my file number starts "O1-". Cosmetic, yes — but I'm the exact anxious user who
reads "O1" three times and starts doubting which pack I'm in. Fix the copy.

Would I adopt it? For the qualify + organize steps, yes, today — it's an honest, fast, correctly-
packed read that saves me a five-figure firm intake and tells me which criteria to stop chasing. For
the draft, I'd generate it, then sit with my attorney on whether the prose clears a senior's bar and
whether it was candid about my gaps — which is exactly what the product keeps telling me to do. Would
I tell a peer racing the same clock? Yes — with the caveat "check that it scores your membership
honestly, not just on keywords."

---

## What passed (protect these)

- **EB-1A pack correctness end-to-end** — the ten 8 CFR 204.5(h)(3) criteria, threshold 3, reach
  qualify → case → criteria UI → draft → evidence buckets; `packFor`'s O-1A default never fires on a
  reachable path (`packs.ts:142-168`, `validation.ts:103-126`, `CaseDetailView.tsx:143,195,204`).
- **The wrong-pack tripwire** — `qualifyGates` fails closed if the criteria count/order ≠ the
  classification's canonical set; `classificationGate` fails a leaked visa code in a letter
  (`adjudication-gates.ts:244-253,227-233`). Ravi's worst-case is actively policed at runtime.
- **Citation discipline** — no fabricated authority; inline `(Exhibit N)` only for listed numbers;
  `unresolved` quarantine; case-law flagged for attorney (`drafting.ts:160-166,593-607`).
- **Honest coverage framing** — "documents present ≠ criterion proven; refiling doesn't re-check
  fit" (`EvidenceVault.tsx:210-216`); unscored "None" never renders green (`CriteriaReport.tsx:20-26`).
- **The DISCLAIMER as a data contract** — byte-identical, non-dismissible, on every AI payload and
  validated by `disclaimerGate` (`lib/result.ts:37-41`, `adjudication-gates.ts:204-209`).
- **Shipped backlog items confirmed in code** — G1.1 (section continuity context), G2.1 (whole-vault
  categorize context), dc-evidence-02 (honest coverage note).
- **Real cases above the mock, never stranded** — roadmap derives from real state; deep links
  hydrate (`CaseFileDashboard.tsx:31`, `roadmap.ts:38-59`).
