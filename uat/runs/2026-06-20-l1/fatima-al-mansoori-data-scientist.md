# L1 review — Fatima Al-Mansoori (industry ML scientist, O-1A self-petitioner)

- **Character:** fatima-al-mansoori-data-scientist · **segment:** beneficiary
- **Journeys walked:** qualify-verdict, draft-petition-letter, organize-evidence, track-case-progress
- **Date:** 2026-06-20 · **cert_level:** L1 (theoretical, code-grounded, no browser)
- **Reachability:** all four journeys land on surfaces reachable to a beneficiary under dev-auth
  (`developer@localhost`). O-1A is a live program (`jurisdictions.ts:63`), so her pack is offered
  and accepted (`qualification.ts:108`). No attorney-gated surface is on her critical path; the
  review **queue** + sign/file are walled out by design (`roles.ts` fail-closed) — not her job.

---

## Surface model (the import chain I actually followed)

- **Landing `/` → InstantVerdict** (`src/app/page.tsx:98` → `InstantVerdict.tsx:64`) posts to
  `/api/qualify/preview` (`preview/route.ts:69`) which runs **only** `mockQualification`
  (`qualification.ts:225`) — deterministic keyword regex, never the model, labelled `source:"mock"`,
  honestly framed as an "instant keyword read" in the SoftGate (`InstantVerdict.tsx:274`).
- **`/qualify` → QualifyEntry → QualifyPanel** (`QualifyPanel.tsx:89`) posts to `/api/qualify`
  (`qualify/route.ts:36`) → `executeAiOperation` → `buildQualifyPrompt` (`qualification.ts:120`),
  which embeds the **full pasted profile verbatim** (`qualification.ts:159-161`) and the correct
  O-1A pack criteria names (`packs.ts:91`). Result persists as a case with its scored criteria
  (`qualify/route.ts:86-102` → `pglite-store.ts:391-398`).
- **DraftStudio** (`DraftStudio.tsx:78`) posts to `/api/draft` → `draftSpec`
  (`draftOperation.ts:95`). On the **DB path** it loads persisted criteria
  (`draftOperation.ts:147`) and fuses vault exhibits via `attachExhibits` (`draftOperation.ts:160`,
  `drafting.ts:509`); `buildDraftPrompt` (`drafting.ts:174`) enforces strict citation discipline
  (rules 1-6) + prompt-injection fencing. Per-section regenerate now passes the letter's other
  sections as read-only continuity (`draftOperation.ts:176-178`, `drafting.ts:222-267`).
- **EvidenceVault** (`CaseDetailView.tsx:193`) posts to `/api/evidence/categorize`
  (`categorize/route.ts:42`) → `buildCategorizePrompt` (`evidence.ts:106`) with the real doc text,
  the case's classification pack buckets, and a whole-vault sibling summary
  (`evidence.ts:84`, `categorize/route.ts:64-74`). Exhibit numbers are monotonic + never-reused
  (`pglite-store.ts:652-664`).
- **Roadmap** (`CaseDetailView.tsx:133` → `roadmap.ts:38`) derives stage from real status +
  `hasEvidence` (`documents.length>0`) + `hasDraft` (`initialSections`). Dashboard lists her real
  cases above the mock masthead (`CaseFileDashboard.tsx:31`); empty state points to `/qualify`
  (`CaseFileDashboard.tsx:124`).
- **Trust layer:** every paid generation is scored live by `runAdjudication`
  (`adjudication-gates.ts:294`) and surfaced via `AdjudicationBadge` (`AdjudicationBadge.tsx:27`);
  the `DISCLAIMER` (`result.ts:37`) rides on every AI payload (`DisclaimerStamp.tsx`).

**Criteria-pack correctness (the protocol's critical check):** Fatima is **O-1A**, the default
pack — `packFor` (`packs.ts:223`) returns the 8-criterion O-1A pack (threshold 3) directly, no
silent fallback risk for her. The eligibility math counts only Met/Strong, never Partial/None
(`criteria.ts:27,74`), and the pack threshold is passed through everywhere
(`CriteriaReport.tsx:41`, `QualifyPanel.tsx:270`). **No false-green path exists.**

---

## Journey 1 — qualify-verdict · **L1-pass** · grounding (real path) **4/4**, (landing) **1/4**

**Walkthrough.** On `/qualify` I paste my industry record once and the prompt sends my *whole*
profile to the model (`qualification.ts:159-161`) against the exact 8 O-1A criteria. The report
renders evidence + rationale per criterion, the ≥3 threshold is honoured, unscored criteria render
neutral (never green), the likelihood is informational, and the disclaimer stamps first
(`CriteriaReport.tsx:48`). The live adjudicator asserts all 8 canonical criteria in order, valid
statuses, likelihood range, and a **UPL tripwire** that fails "you will qualify / you should file"
(`adjudication-gates.ts:244-267, 236`). This is structurally exactly the honest read I wanted.

**The one wrinkle that matters for me:** the **landing `/`** certificate runs the *keyword mock*,
which emits only `Met`/`None` and templated generic evidence strings (`qualification.ts:227-238`),
not my words. It would likely score me ~6/8 Met (my "wins/award", "reviewer", "patents/product",
"papers", "Lead", "equity" all hit the regexes — `packs.ts:38-88`) — but the certificate says
"Mentions a patent…", not "two granted patents on training-efficiency" or "Kaggle Grandmaster."
The SoftGate is honest that this is a keyword scan and the deep read is behind sign-in
(`InstantVerdict.tsx:274`), so it's labelled, not deceptive — but a rigor-person could read the
engraved "certificate" framing as more than a regex (the open PN-QUAL-01 / BACKLOG G3.1 theater
note). **Acceptance criterion 1 ("names MY patents/Kaggle/comp") is met only on the authenticated
path** — and *whether the real Claude actually surfaces "Kaggle Grandmaster" as a selective
distinction and weights patents over a modest citation count* is invisible in code → an L2 item.

**Est. time-saved if it works:** the honest yes/no/maybe in <5 min replaces a paid consult to even
learn if I'm in range. Real.

## Journey 2 — draft-petition-letter · **L1-conditional** · grounding **4/5**

**Walkthrough.** From my saved case, "Draft the petition" generates an Introduction + one section
per *qualifying* criterion (heading = criterion name) + Conclusion (`drafting.ts:202-205`). The
crosswalk I care about is **structurally correct**: patents land in whatever criterion the qualify
model scored them under (Original contribution), comp under High remuneration — each becomes its own
section. Citation discipline forbids inventing awards, citation counts, comp figures, or venues
(`drafting.ts:181`), case law is banned (rule 4), and the live fabrication gate flags any
money/percentage/year/big-integer in the draft **not traceable to my record**
(`adjudication-gates.ts:83-93,122-127,212`) — which is precisely my pet-peeve guard against a
fabricated citation count or invented patent number. I can edit any section and regenerate one
without losing the others (the regen merges into my *current* sections — `draftOperation.ts:254`,
`DraftStudio.tsx:213`), and the continuity context stops a regenerated section repeating the intro
(`drafting.ts:250-267` — G1.1/dc-draft-02 fixed). Edits stay local until "Save edits", clearly
stated (`DraftStudio.tsx:585-589`). Disclaimer + CitationNote + compliance badge on every output.

**Where my senior bar bites (majors carried to L2):**
1. **High remuneration is not required to carry a peer comparison.** My whole comp argument is an
   RFE magnet unless it's framed "top-decile vs. field peers." The draft prompt enforces
   *no-fabrication* but never instructs the model to argue comp **against peers** with the right
   comparison framing (`drafting.ts:174-208` has no remuneration-specific guidance). The fabrication
   gate would even *flag my real $320K* if it isn't byte-present in the persisted criterion evidence
   — protective, but it means the number only survives if qualify captured it. Whether the live
   draft argues comp credibly (not bare assertion) is the single thing I most need L2 to verify.
2. **The draft argues from per-criterion paraphrases, not my full CV.** On the DB path the prompt
   gets the persisted `evidence`/`rationale` per criterion + vault exhibit facts, *not* my raw paste
   (`draftOperation.ts:147-161`). This is the **accepted** PN-DRAFT-01 (BACKLOG G1.3): L2 previously
   proved the live draft does name the captured specifics because qualify persists them
   (`pglite-store.ts:391-398`). For *my* industry record specifically — does "patent on
   training-efficiency" and "Kaggle Grandmaster" survive the qualify→criteria→draft hop, or get
   flattened to "an original contribution"? That fidelity is the L2 question. Not re-reporting the
   accepted gap; flagging the *industry-evidence* angle on it.

**Est. time-saved if it works:** turns my pasted record into a criterion-mapped, citation-disciplined
first draft in an afternoon vs. the firm's 2-3 months + $8-15k — *if* the comp/patent argument
clears my bar. The machinery is here; the prose quality is L2's call.

## Journey 3 — organize-evidence · **L1-pass** · grounding **3/3**

**Walkthrough.** I paste a document; it's categorized into one of my **O-1A** buckets (the case's
pack, not a generic set — `evidence.ts:111,190`) or honestly "Unsorted", facts extracted **only from
the content** (`evidence.ts:120`), exhibit number monotonic and never-reused
(`pglite-store.ts:652-664`), and `summarizeVault` derives real coverage/gaps from what's actually
filed (`evidence.ts:226-244`). The whole-vault sibling summary now rides on the prompt so a patent
grant and a patent abstract don't split across buckets (`evidence.ts:84-101` — G2.1/PN-EVID-01
fixed). The categorize result is range-clamped to allowed buckets (`evidence.ts:145-147`) and the
adjudicator asserts the bucket is in my pack (`adjudication-gates.ts:271-278`). The DraftStudio nudge
tells me to populate the vault first so the draft cites my real exhibits (`DraftStudio.tsx:378-387`).
This is the part that lets a patent be filed as Original-contribution evidence rather than buried.

**Minor (uncertain):** refile is a manual override with no sanity-check — moving a doc to a bucket it
doesn't support silently counts toward that criterion's coverage (`lib/data/evidence.ts:61`,
`evidence.ts:233-237`). This is the open BACKLOG G2.2/dc-evidence-02; referencing it, not re-filing.

**Est. time-saved if it works:** an exhibit index + gap read I could hand an attorney, in minutes.

## Journey 4 — track-case-progress · **L1-pass** · grounding **n/a** (state-derived)

**Walkthrough.** My dashboard lists my real cases above the mock demo masthead, each deep-linking to
`/dashboard/cases/[id]` (`CaseFileDashboard.tsx:31,149`); the empty state points to `/qualify`
(`CaseFileDashboard.tsx:124`). The case detail shows status + a roadmap stepper marking done/current/
upcoming from **real** state — status drives post-submission stages, and `hasEvidence`/`hasDraft`
pick the pre-filing step (`roadmap.ts:38-58`, fed live at `CaseDetailView.tsx:133-137`). Deep links
hydrate from saved state (`cases/[id]/page.tsx:62-111`). I'm never stranded — every state has a next
action (draft, add evidence, submit for review).

**Minor (clarity):** in pre-submission the roadmap shows "Evidence" as *current* until a document
exists, even after I've drafted — `current = !hasEvidence ? EVIDENCE : !hasDraft ? DRAFTED : REVIEW`
(`roadmap.ts:51`). A self-petitioner who drafts straight from the screening (no vault yet) sees the
stepper sitting on "Evidence" while a full draft is on screen — mildly contradictory, but the draft
card itself is unambiguous, so it's a nit, not a block.

---

## Findings table

| id | journey | type | severity | dimension | impact (f/r/t) | title | code_check | verdict |
|----|---------|------|----------|-----------|----------------|-------|------------|---------|
| fam-draft-01 | draft-petition-letter | quality-gap | major | senior-quality | high/high/high | High remuneration not prompted to argue a peer comparison | confirmed-absent | confirmed |
| fam-draft-02 | draft-petition-letter | quality-gap | major | senior-quality | med/high/med | Industry specifics (patent topic, Kaggle rank) may flatten to generic across qualify→criteria→draft | by-design | uncertain |
| fam-qual-01 | qualify-verdict | quality-gap | minor | senior-quality | high/high/low | Landing `/` certificate is a keyword mock with generic (non-named) evidence | by-design | confirmed |
| fam-qual-02 | qualify-verdict | trust | minor | trust | med/high/low | "Certificate/Approved" framing over a regex read risks a horoscope read (BACKLOG G3.1) | by-design | uncertain |
| fam-evid-01 | organize-evidence | quality-gap | minor | trust | low/med/low | Refile to a wrong bucket silently inflates coverage (BACKLOG G2.2) | present-broken | uncertain |
| fam-track-01 | track-case-progress | confusion | minor | clarity | med/med/low | Roadmap shows "Evidence" current even after a draft exists when vault is empty | present-broken | confirmed |
| fam-str-01 | draft-petition-letter | strength | polish | trust | — | Live fabrication/UPL/wrong-code adjudication on every paid generation, surfaced with reasons | by-design | confirmed |
| fam-str-02 | qualify-verdict | strength | polish | trust | — | Met/Strong-only threshold math; unscored never renders green | by-design | confirmed |
| fam-str-03 | draft-petition-letter | strength | polish | effort | — | Section regenerate preserves other edits + continuity context (G1.1 fixed) | by-design | confirmed |

---

## First-person review — in Fatima's voice

Signal-to-noise: high. I came in braced for a tool built for a professor — 30 papers, an h-index
recited like a mantra — and instead the machinery is criterion-agnostic in the right way. The
qualify prompt sends my *whole* paste to the model, not a citation count it would over-weight, and
the eight criteria are the real ones with the ≥3 threshold honoured and **no green badge on anything
I didn't supply**. That last part is the thing most of these tools get wrong, and this one is
provably right in the code. The draft is structured one-section-per-criterion, so my **patents get
their own Original-contribution section** instead of being demoted as "not papers" — exactly the
weighting I wanted — and the fabrication gate means it physically cannot stamp my draft with a
citation count or a patent number I didn't give it. As a guard against my worst RFE fear, that's
elegant.

Two things keep me from "adopt today." First: **my comp.** High remuneration is the criterion I most
clearly clear, and it's worthless asserted bare — "top-decile" is an RFE magnet without "vs. field
peers." Nothing in the draft prompt tells the model to *argue the comparison*; it only tells it not
to lie. So I can't tell from the code whether the draft says "$X, which exceeds the 90th percentile
for ML scientists per [source]" or just "commands a high salary." That's the difference between a
senior AI/ML drafter and a generalist, and it's exactly what I'm paying to skip — L2 has to put my
real comp band in and read what comes out. Second, and related: the draft argues from the
*paraphrases* qualify captured, not my raw CV, so whether "patent on training-efficiency methods" and
"Kaggle Grandmaster" survive intact or flatten to "an original contribution" is a fidelity question
the static code can't answer. The team already proved (prior L2) that captured specifics *do* survive
for a research profile; I need it proven for an **industry** profile, where the strongest evidence is
the least academic-looking.

Would I tell a peer? Yes — with the caveat "do the real `/qualify` read, ignore the landing
certificate's generic copy, and check that it argues your comp against peers before you trust the
draft." The disclaimer is everywhere, I'm never confused that *my* attorney signs, and the compliance
badge telling me *why* a section needs review is more honesty than I expected. It clears the bar to be
worth an afternoon. It hasn't yet proven it clears my **senior** bar on the two arguments that are my
whole case — and those are L2's to settle.

---

## What passed (protect these)

- **Full pasted profile reaches the real qualify prompt verbatim** (`qualification.ts:159-161`) — the
  grounding that lets it read *me*, not a template.
- **Correct O-1A pack, threshold 3, Met/Strong-only counting, unscored-never-green**
  (`packs.ts:91`, `criteria.ts:27,74`) — no false "Met" badge is structurally possible.
- **Citation discipline + live fabrication/UPL/wrong-code/case-law adjudication** on every paid
  generation, surfaced to the user with exact reasons (`drafting.ts:181`,
  `adjudication-gates.ts:294`, `AdjudicationBadge.tsx:27`) — directly guards my patent/citation/comp
  pet peeves.
- **One section per qualifying criterion, heading = criterion name** (`drafting.ts:202-205`) — patents
  get an Original-contribution section instead of being buried.
- **Section regenerate preserves other edits + has continuity context** (`draftOperation.ts:254`,
  `drafting.ts:250-267`) — G1.1 landed.
- **Evidence categorizes into the case's own pack with whole-vault context + monotonic exhibits**
  (`evidence.ts:111,84`, `pglite-store.ts:652-664`) — G2.1 landed.
- **Roadmap + dashboard derive from real case state**, empty-state routes to `/qualify`
  (`roadmap.ts:38`, `CaseFileDashboard.tsx:31,124`).
- **DISCLAIMER on every AI payload, rendered first and non-dismissible** (`result.ts:37`,
  `DisclaimerStamp.tsx`).
