# L1 review — Kenji Watanabe (OSS engineer, O-1A self-petitioner)

- **Character:** kenji-watanabe-oss-engineer · **Segment:** beneficiary
- **Journeys walked:** qualify-verdict, draft-petition-letter, organize-evidence, track-case-progress, share-verdict
- **Date:** 2026-06-20 · **cert_level:** L1 (theoretical, no browser)

> Lens (held identically): an honest O-1A read that scores OSS evidence on its own terms — adoption,
> maintainer status, keynote — not a researcher rubric; Original-contribution = my project/adoption,
> Critical-role = my maintainer seat / named adopters, Judging = PR/RFC review; the draft argues my
> GitHub metrics as comparable evidence under 8 CFR §214.2(o)(3)(iii) and flags Scholarly articles
> honestly as my thin criterion; **zero fabricated** stars/downloads/company-names/talks.

## Reachability resolution (before judging)

Dev-auth synthetic user `developer@localhost`; my whole surface set is reachable as a beneficiary:
`/` (hero InstantVerdict), `/qualify` (best-path + authenticated QualifyPanel), `/api/qualify`,
`/dashboard`, `/dashboard/cases/[id]`, `/c/[token]`. None of my journeys touch the attorney
review **queue** or sign/file (those fail closed on `isConfiguredAttorney` — by design, not mine to
walk). **Pack correctness:** I am O-1A, and `packFor("O-1A")` returns the correct 8-criterion pack
with threshold 3 (`packs.ts:90-98`); the protocol's "silent fallback-to-O-1A" risk is *neutral* for
me — O-1A is genuinely my pack. With `LLM_ENGINE=claude` the authenticated `/api/qualify`,
`/api/draft`, `/api/evidence/categorize` run a **real model**; the hero preview, the best-path
finder, and any keyless/CI build run the **deterministic keyword mock** by design.

---

## qualify-verdict — **L1-conditional**

**Grounding (real model path): 4/4** — the authenticated `/api/qualify` prompt receives my full
pasted `profile` verbatim (`qualification.ts:120-164`, route `:43-83`), with explicit Rule 2 (score
only what's described, invent nothing) and Rule 4 (publications ≠ original contribution — criterion
isolation). The report reuses `summarizeCriteria`, so a "None" never renders green and the ≥3
threshold comes from my pack (`CriteriaReport.tsx:40-43, 85-87`). The DISCLAIMER rides first and
non-dismissible. This is a strong, well-grounded read for an OSS record — Rule 4 is exactly the
discipline that stops my conference talks being laundered into "Scholarly: Met."

**Grounding (hero/preview + best-path): keyword-only.** Here is the rub. My **first impression** is
the hero InstantVerdict, which calls `/api/qualify/preview` → `mockQualification` (keyless, no model,
honestly labelled "an instant keyword read" in the SoftGate, `InstantVerdict.tsx:270-277`). The mock
scores each criterion by a regex, and **the SCHOLARLY regex contains `conference`**
(`packs.ts:71-76`). My record says "KubeCon keynote" and "two conference talks" — so the word
`conference` lights up **Scholarly articles → Met** with evidence "Mentions publications, papers, or
citations." That is precisely the pet peeve: a *talk* hallucinated into a *publication*, by a
keyword, on the very first screen I see (**kw-qualify-01**, major/trust). The same keyword engine
backs the cross-program **best-path** ranking (mock-only, `best-path.ts:96-153`), so a misfire can
tilt the O-1A vs EB-1A recommendation (**kw-qualify-02**, minor). The authenticated model fixes both
— but the funnel leads with the keyword read.

**Est. time-saved if it worked:** the screening + correctly-mapped score in well under five minutes,
vs my LLM-less anchor of a firm's intake call — a real win, *conditional on the model path, not the
hero, being what I trust.*

## draft-petition-letter — **L1-conditional**

**Grounding: 3/5** of the sources a senior drafter would use actually reach the prompt — the per-
criterion `evidence` + `rationale` (the qualify model's capture of my words), the criterion
`status`, and any **vault exhibit facts** (`drafting.ts:174-208`, `criteria-text.ts:35-40`,
`draftOperation.ts:147-162`). What does **not** reach it: my **full pasted CV** (there is no
persisted profile column — `petitions.ts` stores petitioner/classification/likelihood/criteria
only) and any sibling-section prose *on the full-letter pass*. So the draft can name my 38k stars,
the Helm pulls, and Datadog/Shopify only if the qualify model captured them into the
Original-contribution / Critical-role `evidence` (cap 4000 chars — generous) or if I add them to the
Evidence Vault first (**kw-draft-01**). This is the **accepted/resolved backlog item PN-DRAFT-01 /
G1.3**: 2026-06-19 decided no code change because L2 proved the live draft already names supplied
specifics, and the "populate the vault first" nudge ships (`DraftStudio.tsx:378-387`). I record it
only to confirm the *same* boundary governs an OSS record — and to flag it as the **single biggest
L2 question for me**: does the real draft argue my stars/adopters as comparable evidence, or fall
back to generic "extraordinary ability" filler?

What I trust here: the anti-fabrication machinery is exactly what a metrics-allergic engineer wants.
The draft prompt forbids inventing awards/citations/employers (Rule 1), and every paid draft runs
`runAdjudication` — `fabricationGate` **warns** on any number/year/$ in the output not traceable to
my input (an invented star count or fake adopter gets surfaced), `classificationGate` fails on a
leaked wrong visa code, the CITATION_RULE + `auditCitations` quarantine any `(Exhibit N)` that
doesn't resolve to a real on-file document (**kw-draft-02**, strength). Per-section **Regenerate**
sends my current sections as read-only continuity context (G1.1 shipped, `drafting.ts:222-278`,
`DraftStudio.tsx:213`), so a regenerated section won't duplicate the intro or lose my edits.

**Est. time-saved if it worked:** my drafting weeks → an afternoon. This is the whole bet, and it
turns entirely on the L2-only question of whether the grounded prose actually reads my code impact
as research-grade evidence.

## organize-evidence — **L1-pass**

**Grounding: 3/3** for the doc-placement task — categorize is fed the document's full `content`, my
case `classification` (so it sorts into MY eight O-1A buckets via `packFor`), and a read-only summary
of what's already filed (`summarizeVaultBuckets`, G2.1/PN-EVID-01 shipped — `evidence.ts:84-143`,
route `:62-75`) so a new doc is placed consistently with its siblings. Coverage/gaps derive from the
real pack; exhibit numbers are monotonic in the store; and the UI states plainly "documents present
≠ criterion proven; refiling moves a document without re-checking its fit" (dc-evidence-02 addressed,
`EvidenceVault.tsx:210-216`) — honesty I respect (**kw-evidence-02**, strength). One keyless-path
wart: the categorize **mock** shares the same `conference`-in-SCHOLARLY collision, so on a keyless/CI
build a "KubeCon keynote" doc could land in Scholarly (**kw-evidence-01**, minor) — but with
`LLM_ENGINE=claude` the real model categorizes, and refile is a one-click manual override.

**Est. time-saved if it worked:** the exhibit-indexing + gap read I'd otherwise hand-build — hours
saved, and the gap badges tell me what to chase before drafting.

## track-case-progress — **L1-pass**

**Grounding: n/a (no AI surface).** The roadmap is a pure derivation of real state —
`caseRoadmap(status, {hasEvidence, hasDraft})` fed `documents.length>0` and the real draft sections
(`roadmap.ts:38-59`, `CaseDetailView.tsx:133-137`). My real cases show in `YourCasesCard` at the top
of `/dashboard`; the empty state routes to `/qualify`; qualify's "Open case file" deep-links to the
hydrated detail route (**kw-track-02**, strength). The one friction for *me*: the dashboard
*always* also renders the mock "Dr. Anya Krishnan · Senior Research Engineer · 92% approval
likelihood" researcher masthead next to my real case (`CaseFileDashboard.tsx:31-105`). It is the
**accepted** "Mock demo case file" gap (accepted-gaps.md:24-25), so not a new defect — but from my
distrust-of-theater seat, a fabricated researcher persona with a hardcoded 92% reads like the tool
defaulting me into the very mold I came to escape (**kw-track-01**, minor clarity, refuted as a
defect / logged as a felt-clarity nit).

**Est. time-saved if it worked:** marginal but real — I never wonder "what now?"

## share-verdict — **L1-pass**

**Grounding: n/a (codec, no AI).** Privacy-by-construction: `encodeSnapshot` puts only
name/classification/likelihood/per-criterion-status into a base64url token — **never my profile
text** (`letters-patent.ts:21-29, 69-77`). `decodeSnapshot` rejects a tampered token whose status
count doesn't match the live pack; `/c/[token]` renders from the token alone (no DB), stamps
"Qualifies" only at/above threshold else "In progress," and carries "Informational only · not legal
advice" (`c/[token]/page.tsx:43-137`) — credible enough to forward to my counsel, not cheesy
(**kw-share-01**, strength). The one caveat: the same `LettersPatentShare` mounts on the **hero**
mock result too, so a certificate minted *before I sign in* can encode the keyword mock's inflated
"Scholarly: Met" (**kw-share-02**, minor) — fixed at the source by fixing kw-qualify-01.

**Est. time-saved if it worked:** seconds; a clean way to give counsel a structured starting point.

---

## Findings table

| id | journey | type | severity | dimension | impact | title | code_check | verdict |
|---|---|---|---|---|---|---|---|---|
| kw-qualify-01 | qualify-verdict | trust | **major** | trust | H/H/H | Mock scores "Scholarly: Met" from the word "conference" (talk→publication) | present-broken | confirmed |
| kw-qualify-02 | qualify-verdict | quality-gap | minor | senior-quality | M/H/M | Best-path ranking is mock/keyword-only for an OSS record | by-design | confirmed |
| kw-draft-01 | draft-petition-letter | quality-gap | minor | senior-quality | H/H/M | Draft argues from criterion paraphrases, not my full CV (= accepted PN-DRAFT-01) | by-design | refuted |
| kw-draft-02 | draft-petition-letter | trust | polish | trust | M/H/L | STRENGTH: adjudication flags invented numbers/companies + UPL | by-design | confirmed |
| kw-evidence-01 | organize-evidence | quality-gap | minor | senior-quality | M/H/M | Categorize mock can drop a keynote doc into Scholarly (same collision) | present-broken | confirmed |
| kw-evidence-02 | organize-evidence | quality-gap | polish | trust | L/H/L | STRENGTH: vault uses my pack, sees siblings, frames coverage honestly | by-design | confirmed |
| kw-track-01 | track-case-progress | confusion | minor | clarity | H/H/M | Mock researcher masthead + fake 92% beside my real case (accepted gap) | by-design | refuted |
| kw-track-02 | track-case-progress | broken-flow | polish | completion | M/H/L | STRENGTH: roadmap/deep-link/empty-state from real state | by-design | confirmed |
| kw-share-01 | share-verdict | trust | polish | trust | M/H/L | STRENGTH: token leaks nothing private, DB-free, pack-validated, honest | by-design | confirmed |
| kw-share-02 | share-verdict | trust | minor | trust | M/H/M | Hero-minted share can carry mock-inflated "Scholarly: Met" | confirmed-absent | confirmed |

Severity counts: **major 1 · minor 4 · polish 5** (5 of the 10 are strengths). No blockers.

---

## First-person review — in Kenji's voice

I came in braced. Every calculator and ChatGPT prompt I've tried reads "no papers" and quietly
concludes I'm weak, because they can't parse a 38k-star repo, a Helm chart pulled millions of times,
or a KubeCon keynote as evidence. So the first thing I do is paste my real record into the box on the
landing page and hit "Reveal my verdict" — and the very first card hands me **"Scholarly articles:
Met."** I didn't claim a single paper. It scored it off the word *conference* in "KubeCon keynote."
That's not a small thing for me; that's the exact failure mode I'm allergic to, served as my opening
impression. I read the fine print — "an instant keyword read," with a "go deeper" button to the real
screening — and credit where due, the tool is **honest that the hero is a keyword pass**, which is
more than the calculators ever were. But honesty about being shallow doesn't undo a wrong "Met" on
the card, and if I'd shared that card to my counsel before signing in, it would carry the same lie.
Fix the heuristic — drop `conference` from the scholarly bucket — and most of my distrust evaporates,
because it's one keyword across qualify, best-path, categorize, and the share token.

Past the hero, the real machine is genuinely good, and I can see it in the code. The authenticated
screening sends my whole paste to the model and tells it in plain terms not to let publications count
as original contribution and not to invent anything — that's the right rubric for me. The draft
side is where I'd normally lose weeks, and the anti-hallucination posture is exactly what I'd build:
it forbids invented awards and employers, and then a live adjudicator **flags any number or company
in the output that isn't in my input** and quarantines any exhibit citation that doesn't resolve to
a real document. If the model tries to gift me "50k stars" I never claimed, it gets surfaced before
my attorney wastes a minute on it. That's a tool that respects provenance.

My one real reservation — and it's the whole ballgame — is that the draft argues from the
per-criterion summary the screening captured, plus whatever I put in the Evidence Vault, **not my
raw CV**. There's no profile stored anywhere; the draft only knows what the screening distilled. The
team already decided this is acceptable because the live draft demonstrably names the supplied
specifics, and there's a clear nudge to load the vault first. I believe the architecture; I just
can't *prove* from static code that the Original-contribution section will say "38k GitHub stars,
adopted in production by Datadog and Shopify" instead of generic "sustained acclaim" filler. That's
the one thing I need L2 to show me on my own record.

Would I adopt it? **Conditionally yes** — if the hero stops calling my talks publications and the
grounded draft reads my adoption metrics as comparable evidence, this collapses my $8k–$12k / 6–10
week firm cycle into an afternoon my own attorney can red-line, which is the only reason I'd use it.
Would I tell a peer? Not until that one keyword is fixed — because a maintainer who sees "Scholarly:
Met" off a conference talk closes the tab, exactly like the character note says, and never reaches
the good part underneath.

## What passed (protect these)

- **Real-model qualify grounding + Rule 4 criterion isolation** — full profile to the prompt; "None"
  never renders green; pack threshold honored (`qualification.ts:120-164`, `CriteriaReport.tsx:40-87`).
- **Live adjudication on every paid generation** — fabrication warn (invented metrics/companies),
  wrong-code fail, case-law warn, disclaimer fail (`adjudication-gates.ts:122-127, 211-241`).
- **Citation discipline** — CITATION_RULE + `auditCitations` quarantine any unresolved `(Exhibit N)`
  (`drafting.ts:160-166, 593-608`).
- **Per-section regenerate continuity** (G1.1 shipped) and the "populate the vault first" nudge
  (G1.3) (`drafting.ts:222-278`, `DraftStudio.tsx:378-387`).
- **Evidence vault**: my-pack buckets, whole-vault consistency (G2.1), honest coverage framing
  (dc-evidence-02), monotonic exhibits (`evidence.ts:84-143`, `EvidenceVault.tsx:210-216`).
- **Roadmap from real state** + deep-link hydration + empty-state to /qualify
  (`roadmap.ts:38-59`, `CaseDetailView.tsx:133-137`).
- **Share token**: no profile leaked, DB-free, pack-validated, honest informational framing
  (`letters-patent.ts:21-102`, `c/[token]/page.tsx:43-137`).
- **The DISCLAIMER** rides on every AI payload, first and non-dismissible (`result.ts:37-41`).
