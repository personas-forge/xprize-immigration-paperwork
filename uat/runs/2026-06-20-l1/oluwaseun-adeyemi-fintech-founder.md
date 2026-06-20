# L1 review — Oluwaseun "Seun" Adeyemi (EB-1A fintech founder, self-petitioner)

- **Character:** oluwaseun-adeyemi-fintech-founder · **segment:** beneficiary
- **Journeys walked:** qualify-verdict, draft-petition-letter, evaluate-as-prospect, share-verdict, track-case-progress
- **Date:** 2026-06-20 · **cert_level:** L1 (theoretical, code-grounded, no browser)
- **Reviewer lens:** decisive, ROI-framed founder buying for *permanence* (the green card), who will forward the verdict to his board + counsel and **will check** whether "EB-1A" really shows 10 criteria.

## Headline: the pack-correctness check PASSES end-to-end

The single thing this Character was built to catch — `packFor()` silently falling back to the
O-1A 8-pack for an EB-1A self-petitioner — **does not happen on his path.** I followed the whole
import chain and the EB-1A 10-criteria pack (with its arts-flavored criteria) reaches qualify →
persisted case → criteria UI → draft → share, intact:

- `packs.ts:142-168` — the EB-1A pack is the real **10** criteria: Awards, Membership, Press,
  Judging, Original, Scholarly, **Artistic exhibitions** (`:154`), Leading/critical role, High
  remuneration, **Commercial success in the arts** (`:162`). Threshold 3.
- EB-1A is a **live** program (`jurisdictions.ts:63`), so `isLiveProgram("EB-1A")` is true; the
  qualify validator accepts it instead of defaulting to O-1A (`qualification.ts:108-110`).
- BestPathFinder → `choose("EB-1A")` → `onContinue` prefill carries `classification:"EB-1A"`
  (`BestPathFinder.tsx:80-82,199`) → `writeQualifyPrefill` → QualifyPanel reads it on mount and
  `setClassification("EB-1A")` (`QualifyPanel.tsx:63-65`) → POST body sends it (`:92`).
- `/api/qualify` scores with `packFor(req.classification)` = the 10-pack (`qualification.ts:202,227`)
  and **persists** the case with that classification + all 10 criteria
  (`api/qualify/route.ts:91-101`).
- Case detail renders `§ II — {classification} criteria` and the full persisted criteria, in
  canonical order, with the arts criteria visible (`CaseDetailView.tsx:143,163-185`;
  `getCriteriaForCase` "in canonical order" `petitions.ts:120`). DraftStudio gets the real
  `classification` + criteria + vault docs (`:202-210`); the DB-path draft prompt uses the case's
  stored classification (`draftOperation.ts:152`; `drafting.ts:177`).
- The validation strip even tells him so: "Criteria per **8 CFR 204.5(h)(3) · 3 of 10 criteria** ·
  last reviewed 2026-05-30" (`QualifyPanel.tsx:159-170`; `validation.ts:103-126`, note: "the ten
  criteria… match 8 CFR 204.5(h)(3)(i)-(x) verbatim in set and order").

His acceptance criteria **#2 and #4's structural guards hold.** The remaining findings are about
*reasoning quality* (best-path), *positioning fit* (the landing reads O-1-only), and small clarity
warts (DraftStudio's hardcoded "O-1A" copy) — none of them block the job, but two would dent the
trust of a man who treats this output like a diligence memo.

---

## Journey 1 — qualify-verdict · **L1-conditional**

**Walkthrough (in his head):** I land on `/qualify`; the funnel leads with "Find my best path —
all programs" (`QualifyEntry.tsx`, `BestPathFinder.tsx`) rather than forcing me to guess a visa —
good, that's exactly my open question (O-1A vs EB-1A). I paste my founder record, it scores my
profile against every live program and ranks them, recommending one with a one-line rationale and
flagging the green card. I click "Continue with EB-1A" and the authenticated screening runs the
**real model** against the **correct 10-criteria pack**, persists my case, and shows the report +
DraftStudio. The machinery is right and the pack is right. **But** the best-path *reasoning* is
where a senior would wince: the recommender (`best-path.ts`) scores all three programs with the
**deterministic keyword mock** (`scoreProgram` → `mockQualification`, `:75-93`) even in the live
environment, ranks purely by qualifying **margin** with an **identical threshold of 3** for all
three (`packs.ts:97,142`), and the only EB-1A-specific line it appends is *"It is also a green card
(permanent residence)"* (`rationaleFor`, `:120-121`). That frames EB-1A as an **upside/bonus**, the
exact opposite of "this is the *higher* bar — sustained acclaim, a final-merits 'small percentage at
the top.'" There is **no calibration anywhere** that EB-1A is harder than O-1A: same threshold, same
likelihood formula (`38 + 8×qualifying`, `qualification.ts:241-242`), regardless of classification.
For me — who explicitly wants "the real probability, not the optimistic one" — a recommender that
can rank EB-1A first and sweeten it with "green card!" risks **confidently steering me wrong** on
the one decision worth more than the whole fee. This is my acceptance criterion **#1 not met**.

The under-scoring of the keyword preview for off-keyword founder signals is the prior run's
**SR-QV-01** (referenced, not re-filed); my finding is the *distinct* "no higher-bar reasoning,
green-card-as-lure" angle.

- **Grounding score: 4/6.** The *authenticated* qualify prompt receives his real pasted profile
  verbatim (`buildQualifyPrompt` → `req.profile`, `qualification.ts:160-161`) and the correct pack
  criteria — strong. But the **best-path comparison** he leans on is fed only keyword-mock signals,
  not the model, and **not** any O-1A-vs-EB-1A bar/difficulty reasoning. Missing sources: (a) a
  model-reasoned multi-program read, (b) any encoding that EB-1A's final-merits bar is higher.
- **Est. time-saved if it worked:** ~2–3 months + $7.5k–$15k of firm intake collapses to an
  afternoon — *if* the path call is trustworthy. The path call is the load-bearing part for him,
  and it's the weakest.

**Findings:** OA-QV-01 (major), OA-QV-02 (minor).

## Journey 2 — draft-petition-letter · **L1-conditional**

**Walkthrough:** From my qualified EB-1A case I hit "Draft the petition." The prompt header is
correctly `…U.S. EB-1A immigration petition letter…` (`drafting.ts:177` uses `req.classification`),
the STRICT RULES forbid inventing awards/numbers/dates and fence the case data against injection
(`:180-200`), and a **live fabrication gate** scans the output for money/percent/year/big-int
specifics that appear in the draft but not my input (`adjudication-gates.ts:83-90`) — so a
fabricated ARR or Forbes year is flagged "invented… not in the record." That's real protection on
my acceptance criterion **#4**, and the structure (Intro + one section per Met/Strong criterion +
Conclusion, `mockDraft`/prompt `:204-205`) means "Artistic exhibitions" — which scores **None** for
a payments founder (no gallery/exhibit keywords) — earns **no section**, so the "Met: Met on a
criterion I didn't claim" peeve is structurally prevented. Good.

Two honest caveats I'd want L2 to confirm live: (1) the draft argues from the **qualify-captured
per-criterion evidence/rationale**, not my full raw CV (the draft payload is name/status/evidence/
rationale only, `DraftStudio.tsx:124-134`) — this is the **accepted G1.3 / PN-DRAFT-01** grounding,
which L2 already proved names the supplied specifics because qualify captures them; I reference it,
not re-file. From `/qualify` the studio mounts with `documents=[]`, so my first draft has no exhibit
trail until I populate the vault — and the UI **nudges** me to do exactly that
(`DraftStudio.tsx:378-387`). (2) A small clarity wart: the studio's idle copy is **hardcoded
"Draft a full O-1A petition letter…"** (`DraftStudio.tsx:374-376`) even though it correctly drafts
EB-1A — for a founder who's checking, seeing "O-1A" while building an EB-1A petition is a
double-take. Cosmetic, but it's the same fallback *smell* I'm primed to distrust.

Strength to protect: **per-section regenerate now has narrative continuity** — `buildSectionPrompt`
takes the letter's other sections as read-only LETTER_CONTEXT (`drafting.ts:222-267`;
`draftOperation.ts:176-178`), which is the prior **G1.1/dc-draft-02** backlog item, now landed in
code. Editing/regenerate preserves my other unsaved edits via `pickMergeBase`
(`draftOperation.ts:75-93,249-270`).

- **Grounding score: 4/6.** Receives: petitioner, classification (correct EB-1A), per-criterion
  evidence, per-criterion rationale (and exhibits on the vault path). Missing on the *qualify-path*
  first draft: vault exhibits (empty until populated — by design, nudged), and the raw full CV
  (accepted G1.3).
- **Est. time-saved if it worked:** the $7.5k–$15k firm drafting spend → an afternoon; the
  citation-discipline + fabrication gate is what lets him *trust* it enough to forward to counsel.

**Findings:** OA-DR-01 (minor, hardcoded O-1A copy), OA-DR-02 (strength).

## Journey 3 — evaluate-as-prospect · **L1-conditional**

**Walkthrough:** Cold from a link, I need to know in two minutes: what is this, who signs, is it
credible, what's it cost. The **positioning is unmistakable and consistent** — "drafting tool, not
a law firm," "*your* attorney of record reviews and signs," "never legal advice" repeats across the
landing (`page.tsx:155-156,255,372-373`), FAQ (`faq/page.tsx:27,31,43`), and billing. The single
canonical `DISCLAIMER` (`result.ts:37-41`) rides every AI payload. Pricing is honest and self-serve
— `/pricing` redirects to `/billing` (`pricing/page.tsx:9`), bundles sourced from `economy.ts
BUNDLES` so landing and billing **can't drift** (`page.tsx:13,328,442`). The `/validation` page
cites primary law per program (8 CFR 204.5(h)(3) for my EB-1A, with last-reviewed dates and a
CI-gated freshness check, `validation.ts`). For a diligence-minded founder, that validation page is
the credibility evidence I want — acceptance **#5 fully met.**

**The fit problem:** the entire landing reads as an **O-1 product.** "Your **O-1 visa**, drafted
with care" (`page.tsx:133`), "the eight **O-1** criteria" four times (`:92,154,250,282`), the hero
card stamped "**O-1A** · Sciences" (`:199,210`). The word **"EB-1A" never appears on `/`.** I'm
buying for the **green card**, and the cold read tells me this is a nonimmigrant-visa tool; I'd only
discover EB-1A is supported *inside* `/qualify`'s best-path finder or the FAQ. It doesn't block me
(EB-1A is genuinely reachable and fully built), but it undersells the exact job I arrived for and
makes me work to confirm the product is even for me. A `clarity/missing` finding, minor.

- **Grounding score: n/a (non-AI surface).**
- **Est. time-saved if it worked:** avoids a sales call entirely; ~minutes to a confident
  adopt/no-adopt — strong, modulo the "is this even for EB-1A?" doubt.

**Findings:** OA-EP-01 (minor, O-1-only landing), OA-EP-02 (strength, positioning + validation).

## Journey 4 — share-verdict · **L1-pass**

**Walkthrough:** After a positive screening, "Share your Letters Patent" mints a `/c/[token]` link.
The token encodes **only** name, classification, likelihood, and per-criterion statuses in pack
order — **never my profile text** (`letters-patent.ts:69-77`; `LettersPatentShare.tsx:26-32`). The
public page decodes it with **no DB**, validates the status count matches the pack length (a tampered
EB-1A token must carry exactly 10 statuses or it 404s, `letters-patent.ts:97`), and renders the 10
EB-1A criteria as a coat-of-arms (`c/[token]/page.tsx:103-107`) with footer "Informational only ·
not legal advice · no account needed" (`:119`). The OG card renders server-side and falls back
gracefully (`opengraph-image.tsx`). Nothing private leaks; the framing is honest. This is something
I could post or send my board without it overclaiming a legal grant — acceptance **#6 met.**

The "Certificate of Extraordinary Ability" / award-ceremony framing is the known **PN-QUAL-01 /
G3.1** polish item (by-design, the sober scored data sits underneath) — referenced, not re-filed.

- **Grounding score: 5/5** (only the chosen, non-sensitive snapshot rides the token — exactly right).
- **Est. time-saved if it worked:** instant credible artifact for a board update vs. nothing.

**Findings:** OA-SV-01 (strength).

## Journey 5 — track-case-progress · **L1-pass**

**Walkthrough:** My dashboard lists my **real** EB-1A case above the mock Krishnan demo, with its
classification + status + likelihood (`CaseFileDashboard.tsx:31,136-172`; real cases from
`getCasesForUser`, `dashboard/page.tsx:30-38`); empty state points to `/qualify`
(`:112-130`). Opening it, the roadmap stepper derives done/current/upcoming purely from real status
+ whether evidence/draft exist (`roadmap.ts:38-58`; `CaseDetailView.tsx:133-137`), so the stage
always matches what I actually did. Deep link "Open case file →" from qualify resolves to the
detail route hydrated from saved state (`QualifyPanel.tsx:284-290`; `cases/[id]/page.tsx`). I'm
never stranded without a next action. One cosmetic nit (not unique to me, not re-filed as my own):
the dashboard top bar context is hardcoded `O1-241 · Krishnan · O-1A` (`DashboardView.tsx:32`) —
mock-demo chrome, but a founder scanning fast could misread it as *his* case label for a beat.

- **Grounding score: n/a (non-AI surface).**
- **Est. time-saved if it worked:** removes the "what now?" anxiety that, LLM-less, is a back-and-
  forth with the firm.

**Findings:** OA-TC-01 (strength, roadmap derives from real state).

---

## Findings table

| id | journey | type | severity | dimension | impact (f/r/t) | title | code_check | verdict |
|---|---|---|---|---|---|---|---|---|
| OA-QV-01 | qualify-verdict | quality-gap | major | senior-quality | med/high/high | Best-path gives no "EB-1A is the higher bar" reasoning and frames the green card as a *bonus* — can confidently steer a self-petitioner wrong | confirmed-absent | confirmed |
| OA-QV-02 | qualify-verdict | quality-gap | minor | trust | med/high/med | Best-path comparison runs the keyword mock, not the model, even in the live env (same threshold 3 + flat likelihood for all programs) | by-design | confirmed |
| OA-DR-01 | draft-petition-letter | confusion | minor | clarity | high/high/low | DraftStudio idle copy hardcodes "Draft a full **O-1A** petition letter" while correctly drafting EB-1A | confirmed-absent | confirmed |
| OA-DR-02 | draft-petition-letter | strength | polish | trust | — | Citation discipline + live fabrication gate + section-continuity context (G1.1 landed) | present-broken→fixed | confirmed |
| OA-EP-01 | evaluate-as-prospect | quality-gap | minor | clarity | med/high/med | Landing reads as an O-1-only product; "EB-1A" never appears on `/` though it's fully built | confirmed-absent | confirmed |
| OA-EP-02 | evaluate-as-prospect | strength | polish | trust | — | Positioning (drafting-tool-not-law-firm) + canonical DISCLAIMER + primary-source `/validation` are consistent and credible | by-design | confirmed |
| OA-SV-01 | share-verdict | strength | polish | trust | — | Share token leaks nothing private; pack-length validation + honest informational framing | by-design | confirmed |
| OA-TC-01 | track-case-progress | strength | polish | completion | — | Roadmap + real-case list derive from actual case state; never stranded | by-design | confirmed |

Pack-correctness check: **PASS** end-to-end (no O-1A fallback on his path). Reachability: all five
journeys sit on surfaces a beneficiary `developer@localhost` can open; nothing here is `unreachable`.

---

## First-person review — in Seun's voice

I came here to answer one question: *do I clear EB-1A today, or do I bridge through O-1A first?* —
and to do it without paying a firm $10k to tell me. The good news first, because it's real: when I
actually run the EB-1A screening, this thing **shows me the real EB-1A — all ten criteria, with
Artistic exhibitions and Commercial-success-in-the-arts sitting right there.** I half-expected to
catch it serving me the O-1 eight relabeled — that's the kind of tell that ends a diligence call —
and it didn't. It even quotes me the regulation, 8 CFR 204.5(h)(3), 3 of 10, with a review date.
The draft argues from my own evidence, won't invent a number that wasn't in my input (it literally
flags fabricated specifics), and won't hallucinate "Artistic exhibitions: Met" for a payments
company. That clears my bar on the parts I was most afraid of. I'd forward the *case file* to my
counsel without cringing.

What stops me short is the **"find my best path" step — the one decision I actually came for.** It
ranks O-1A, O-1B, and EB-1A as if they're the same difficulty (all "need 3"), runs a keyword scan
instead of the model, and the only thing it says about EB-1A is *"it's also a green card."* That's
not reasoning — that's a sales line. EB-1A is the *harder* bar; "sustained acclaim," "small
percentage at the very top." A tool that can rank it first and then dangle the green card at me is
doing the opposite of what a senior business-immigration attorney does on intake, which is to talk
me *down* off the optimistic read. I won't bet my filing strategy on that recommender; I'll use the
correct-pack screening + draft and make the O-1A-vs-EB-1A call with my lawyer. And the cold landing
page tells me this is an "O-1 visa" tool — my green card isn't even mentioned — so I had to dig to
trust it was for me at all.

**Would I adopt it?** Yes, as a drafting accelerator and a correctly-packed first draft — that's an
afternoon and a real spend saved. **Would I trust its *advice* on which visa to pursue?** No, not
yet — and that's the more valuable thing it claims. Fix the best-path so it's honest that EB-1A is
the higher bar (not a green-card sweetener), put EB-1A on the front door, and stop saying "O-1A" in
the EB-1A draft studio, and I'd tell every founder in my WhatsApp group to use it.

## What passed (protect these)

- **EB-1A 10-pack correctness, end to end** — qualify → persisted case → criteria table → draft →
  share all carry the real EB-1A criteria, including the arts-flavored ones; no O-1A fallback on his
  path (`packs.ts:142-168`, `qualification.ts:108-110,202`, `CaseDetailView.tsx:143`,
  `letters-patent.ts:97`).
- **Citation discipline + live fabrication gate + section continuity** — `drafting.ts:180-200`,
  `adjudication-gates.ts:83-90`, `drafting.ts:222-267` (G1.1 landed).
- **Positioning + UPL line + validation** — consistent "drafting tool, not a law firm," canonical
  `DISCLAIMER`, primary-source `/validation` with EB-1A verified to 8 CFR 204.5(h)(3).
- **Share privacy** — token carries no profile text; pack-length-validated; informational framing.
- **Roadmap + real-case dashboard** derive from actual case state; clear next action throughout.

## For L2 to verify live

- **OA-QV-01 (highest):** does the live best-path recommendation, on Seun's real founder record,
  actually reason O-1A-vs-EB-1A and acknowledge EB-1A's higher final-merits bar — or does it rank
  EB-1A and append "green card"? Assert the rationale text.
- **G1.3 (accepted):** confirm the live EB-1A draft names his supplied specifics (ARR, Series-A,
  Forbes year) on the grounded path, and that the fabrication gate fires on an injected fake number.
- Confirm the validation strip + correct 10-pack render for a real EB-1A run (screenshot the
  criteria table showing Artistic exhibitions + Commercial-success).
