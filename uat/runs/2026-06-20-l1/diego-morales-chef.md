# L1 review — Diego Morales (executive chef · O-1B arts/culinary)

- **Character:** diego-morales-chef · **segment:** beneficiary
- **Journeys walked:** qualify-verdict, draft-petition-letter, evaluate-as-prospect
- **Date:** 2026-06-20 · **cert_level:** L1 (theoretical, code-grounded, no browser)

## TL;DR (the three probes)

- **(a) Does the app have a "chef" profession?** **No — confirmed-absent.** `PROFESSIONS` holds exactly
  `software-engineer, researcher, founder, designer, artist` (`professions.ts:26-113`). "chef"/"culinary"
  /"Michelin"/"James Beard" appear nowhere in `src`. The closest is the generic `artist`.
- **(b) Does the O-1B pack reach his flow, or fall back to O-1A?** **It reaches him correctly.** O-1B is a
  LIVE program (`jurisdictions.ts:63`), so the visa selector offers it on every entry surface; selecting
  it threads the **arts six** end-to-end (qualify prompt → criteria → draft). **No silent O-1A fallback**
  when he picks O-1B. The fallback in `packFor()`/`parseQualifyRequest` only fires on a *missing/unknown*
  classification, which his explicit `<select>` never sends.
- **(c) What does `/visa/[classification]/[profession]` render for "chef"?** **A hard 404** (`notFound()`,
  `page.tsx:73`) — there is no culinary SEO landing page. `/visa/o-1b/artist` exists but is generic arts.

The headline: **the engine is right for Diego; the marketing front-door tells him it isn't.** The
classification model, the O-1B pack, the validation record, and the disclaimer are all correct and arts-aware.
But the landing masthead literally enumerates "**For founders · engineers · researchers · designers**"
(`page.tsx:125`), brags about drafting from "**GitHub, press and publications**" (`page.tsx:156`), and the
whole marketing layer describes only "**the eight O-1 criteria**" — never the arts six. A distinguished chef
reading the front page is told, in his own words, that this is "just for tech people."

---

## Journey 1 — qualify-verdict · **L1-conditional**

**Walkthrough (in the model).** Diego lands on `/` and sees the Instant Verdict hero. The visa-type
`<select>` is populated from `livePrograms()` (`InstantVerdict.tsx:24,125-129`), so it offers
"**O-1B — Extraordinary achievement — arts, motion picture & TV**" — he recognises "arts" and picks it.
He pastes his record (Beard semifinalist, Michelin mention, NYT/Bon Appétit reviews, guest-chef events,
comp package). The hero posts to `/api/qualify/preview` → **deterministic keyword mock only** (no model,
`preview/route.ts:69`). On `/qualify` proper, the funnel leads with BestPathFinder ("score against every
program — O-1A, O-1B, EB-1A — and recommend"; on-page copy at `qualify/page.tsx:31-37` is genuinely
inclusive and names O-1B), or "I already know my visa" → `QualifyPanel` with the same O-1B option. The
authenticated `/api/qualify` runs the **real model** with `buildQualifyPrompt`, which uses
`packFor("O-1B")` → the six arts criteria by exact name (`qualification.ts:120-141`) and feeds his **full
pasted profile verbatim** (`qualification.ts:159-161`). The result renders in `CriteriaReport` against the
O-1B threshold of 3 (`packFor(classification).threshold`), and "None"/unscored rows never go green
(`CriteriaReport.tsx:20-26,40-43`). The `DISCLAIMER` renders first and non-dismissible (`CriteriaReport.tsx:48`).

So structurally Diego **is** screened as O-1B arts against the six, his evidence reaches the model, and the
verdict is grounded in what he pasted. That clears his acceptance criteria 1, 2, 3 (on the authenticated
path), 6, and the threshold is correct (3 of 6, matching `validation.ts:83`).

**Where it wobbles (majors):**
- **The hero/best-path verdict he sees first is the keyword MOCK, not the model.** Both the anonymous
  Instant Verdict (`preview/route.ts`) and the BestPathFinder (`best-path.ts:76` → `mockQualification`
  for *every* program, even when a model is configured) score by regex keyword presence only. For a chef,
  the O-1B regexes are uneven: "Record of major commercial or critical success"
  (`box office|chart|sales|streams|...`, `packs.ts:124`) and "Recognition from organizations & experts"
  (`guild|academy|society|expert|...`, `packs.ts:130`) will **not** fire on "James Beard" / "Michelin" /
  "guest-chef" wording, and "Lead role in distinguished productions" needs the literal
  "lead role"/"leading role" (`packs.ts:106`) — "executive chef leading the kitchen" misses. So Diego's
  *first* impression verdict can under-count his genuinely strong arts record (a possible hollow read his
  pet-peeve #1 names). The real model fixes this, but he only meets it after signing in.
- **No profession/culinary context ever reaches the prompt.** `buildQualifyPrompt` is profession-agnostic
  — it relies entirely on the model recognising "Michelin"/"Beard" as recognition. There's no scaffolding
  that tells the model "this is a culinary O-1B; map a Michelin mention to recognition, a NYT review to
  reviews & press." Good machinery, but Diego's domain mapping is left to the model's general knowledge.

**Grounding score: 3/5.** Sources that *should* feed the verdict prompt: (1) his full pasted profile —
**reaches it** (`qualification.ts:160`); (2) the correct O-1B criteria names — **reaches it**
(`:140-141`); (3) the threshold/program label — **reaches it** (`:122-124`); (4) any
profession/culinary domain hint — **absent**; (5) the first-impression (hero/best-path) read uses the
**mock, not the model**, so the rich grounding doesn't reach the surface he sees first. (The mock honesty
itself is fine and labeled "mock".)

**Est. time-saved if it all worked:** ~an afternoon vs. the culinary firm's **8–12 weeks / $7k–$10k** — a
real win, *if* he gets past the front-door framing to the authenticated model screen.

---

## Journey 2 — draft-petition-letter · **L1-pass**

**Walkthrough (in the model).** From a positive O-1B screening, `QualifyPanel` mounts `DraftStudio`
with `classification="O-1B"` and his scored criteria (`QualifyPanel.tsx:278-283`). Drafting is
classification-agnostic and honest about it: `buildDraftPrompt` says "drafting a U.S. **O-1B** immigration
petition letter" (`drafting.ts:177`, interpolating `req.classification`) and emits one argument section per
**qualifying** criterion using the criterion *names* as headings (`drafting.ts:204-205`) — i.e. his
sections are "Reviews & press", "National or international recognition", "Lead role in distinguished
productions", etc., the arts six, **not** "Scholarly articles"/"Patent". On the DB path the route loads the
case's real `classification` + persisted criteria + vault exhibits before any charge
(`draftOperation.ts:147-161`), so O-1B threads through end-to-end. Citation discipline is strict — STRICT
RULE 1 forbids inventing awards/specifics, and the `(Exhibit N)` rule only allows on-file exhibit numbers
(`drafting.ts:181-192, 160-166`), with a `CitationAudit` quarantining any hallucinated exhibit
(`drafting.ts:593-608`). The section-regenerate prompt now carries the letter's other sections as read-only
continuity context (`drafting.ts:222-225, 250-267`; the G1.1 backlog fix shipped), and the merge preserves
the client's current sections (`draftOperation.ts:75-93, 249-270`) — so regenerating "Reviews & press"
won't clobber his edits elsewhere. The `DISCLAIMER` rides on every draft payload (`drafting.ts:694`).

This satisfies Diego's acceptance criteria 2 (arts headings, no patent/scholarly section), 4 (no
fabrication, thin evidence argued generally), 6 (disclaimer + work-product framing), 7 (per-section edit/
regenerate without losing the rest).

**Grounding (accepted-baseline note).** The draft argues from the **criteria evidence/rationale** captured
at qualify time + vault exhibits, not the raw CV re-fed (`draftOperation.ts:149-161`). That's the
explicitly **accepted** PN-DRAFT-01 decision (BACKLOG G1.3 — "resolved, no code change"; L2 proved the
live draft names the supplied specifics). I am **not** re-reporting it. For Diego it means his Beard/
Michelin/NYT facts reach the draft only insofar as the qualify model captured them into the criteria
evidence — which, on the correct model path, it does.

**Grounding score: 4/5** (criteria names ✓, per-criterion evidence/rationale ✓, vault exhibits ✓,
section continuity ✓; full-CV re-grounding intentionally not done — accepted).

**Reachability caveat (defer to L2):** I can only certify the draft machinery *landed* correctly for O-1B
in code. Whether the live model prose actually reads like a culinary-immigration senior — mapping a
Michelin mention to recognition without inventing a star — is an L2 judgement on the grounded path.

**Est. time-saved if it worked:** the draft itself is minutes; the whole paste→draft loop plausibly an
afternoon.

---

## Journey 3 — evaluate-as-prospect · **L1-conditional**

**Walkthrough (in the model).** Cold from a link, Diego reads `/` then `/faq`, `/billing` (`/pricing`
301-redirects to `/billing`, `pricing/page.tsx:7-9`), and `/validation`. The compliance story is strong and
consistent: every marketing surface says "a drafting tool, not a law firm; **your** attorney of record
reviews and signs; never legal advice" (`page.tsx:255`, `faq:27,31,43`, `landing-claude:62`). Pricing is
self-serve and transparent — bundles render from the canonical `BUNDLES`/`FREE_SIGNUP_GRANT`
(`economy.ts:11,43-50`; `page.tsx:13,328`), so landing and `/billing` can't drift; no "contact us for
price" wall. The `/validation` page is real evidence, not adjectives: it lists **O-1B as a live, verified
program** with its legal basis (8 CFR 214.2(o)(3)(iv)), threshold "3 of 6 criteria (or a qualifying major
award/nomination)", review date, freshness meter, and primary/agency source links — including USCIS Policy
Manual Vol. 2 Part M, Diego's own cited reference (`validation.ts:79-102`, rendered `validation/page.tsx:77-139`).
That directly answers "do you handle my program?" with a citation. Acceptance criteria 5 and 6 largely pass.

**Where it fails Diego specifically (the pet-peeve hit — major):** the *positioning he reads first* is
tech-only.
- The landing masthead ribbon: "File №O1-241 · **For founders · engineers · researchers · designers**"
  (`page.tsx:125`) — his field is conspicuously absent from the named audience.
- The hero subhead: drafted "from your CV, **GitHub, press and publications**" (`page.tsx:156`). A chef has
  no GitHub or publications; this reads as not-for-me.
- The whole marketing layer describes only "**the eight O-1 criteria**" (`page.tsx:154,250,282`;
  `landing-claude:88`; even the `/qualify` page `<title>`/meta: "An informational **O-1A** self-screening …
  the **eight** … criteria", `qualify/page.tsx:11`). O-1B arts is a **six**-criterion program; the public
  copy never says so, so Diego can't tell from the front door that he'd be screened on the arts six rather
  than the O-1A eight (his single sharpest fear).
- The `SAMPLE` button on every screener is the same research-engineer text (peer-reviewed papers, patent,
  TechCrunch — `InstantVerdict.tsx:27`, `QualifyPanel.tsx:35`, `BestPathFinder.tsx:17`), and the textarea
  hint is "awards, **publications, patents**, roles, salary" — reinforcing the tech tilt at the exact moment
  he's deciding whether to paste.

None of this *breaks* the flow — the FAQ does mention "O-1A/O-1B and EB-1A" and the on-page `/qualify` copy
names O-1B — but it materially raises the chance Diego bounces before discovering the engine is actually
built for him. That's a real adoption risk for the arts segment, not a cosmetic nit.

**Grounding score: n/a** (non-AI journey). **Est. time-saved:** the decision itself is ~2 minutes; the risk
is he decides *wrong* (bounces) on tech-only framing.

---

## Findings table

| id | journey | type | severity | dimension | impact (f/r/t) | title | code_check | verdict |
|----|---------|------|----------|-----------|----------------|-------|------------|---------|
| dm-eval-01 | evaluate-as-prospect | confusion | major | trust | high/high/high | Landing positioning is tech-only ("For founders · engineers · researchers · designers"; "GitHub, press and publications") — a distinguished chef is told this isn't for him | present-broken | confirmed |
| dm-eval-02 | evaluate-as-prospect | quality-gap | major | clarity | high/high/med | Marketing describes only "the eight O-1 criteria" — never the O-1B arts six — so an arts petitioner can't tell from the front door he won't be screened on the O-1A eight | present-broken | confirmed |
| dm-qual-01 | qualify-verdict | quality-gap | major | senior-quality | high/high/high | First-impression verdict (hero + best-path) is the keyword MOCK, whose O-1B regexes under-fire on chef wording (Beard/Michelin/guest-chef), risking a hollow under-read before the real model is reached | present-broken | confirmed |
| dm-qual-02 | qualify-verdict | missing-feature | minor | missing | med/high/med | No profession/culinary context reaches the qualify prompt; arts-domain mapping (Michelin→recognition, NYT→reviews&press) is left entirely to the model's general knowledge | confirmed-absent | confirmed |
| dm-prospect-03 | evaluate-as-prospect | missing-feature | minor | missing | med/med/low | No "chef"/culinary SEO page — `/visa/o-1b/chef` is a hard 404; the 5 generated professions are tech/arts-generic, no culinary | confirmed-absent | confirmed |
| dm-qual-03 | qualify-verdict | strength | polish | trust | — | O-1B pack is correct (arts six, exact criterion names), threshold 3-of-6 matches the verified validation record, no silent O-1A fallback when O-1B is explicitly selected | by-design | confirmed |
| dm-eval-04 | evaluate-as-prospect | strength | polish | trust | — | `/validation` names O-1B as live+verified with 8 CFR 214.2(o)(3)(iv), 3-of-6 threshold, and USCIS Policy Manual Vol.2 Part M (his own reference) — real cited evidence | by-design | confirmed |

(`severity` derived from impact: high/high/high → major-trending; the two "major" framing findings are the
business-critical ones for the arts segment. None rise to `blocker` because the *engine* path is sound and
reachable once he selects O-1B.)

---

## First-person review — Diego's voice

I came in with one question, the same one I always ask: *is this built for someone like me, or just for
tech people?* And the front page answered before I'd typed a word — "For founders, engineers, researchers,
designers." Drafted from "your CV, GitHub, press and publications." I don't have a GitHub. I have a James
Beard semifinalist nod, a Michelin mention, a NYT review that changed my year, and a line of guests out the
door at every pop-up. "The eight criteria," it kept saying. My case is the *six* — the arts six — and
nothing on that page even hinted it knew that. If I were less stubborn I'd have closed the tab and called
the firm that quoted me ten grand, because at least *they* said the word "chef" back to me.

But I'm stubborn, so I clicked through. And here's the twist: under the hood, somebody actually did the
work. The visa dropdown offered me "O-1B — arts, motion picture & TV." The qualify page, once I was on it,
said plainly it'd score me across O-1A, O-1B *and* EB-1A and tell me which fits. The validation page — and I
read it, because I've been burned — cites the exact USCIS policy manual my lawyer quoted, lists O-1B as a
verified program, three of six, with a real date on it. When I pick O-1B, it screens me on *reviews & press*
and *lead role in distinguished productions* and *recognition* — the right shelf for my evidence — and the
draft it would write me has those headings, not "scholarly articles." Nobody asked me for a patent. The
disclaimer's on everything, my employer's attorney signs — that's exactly the deal I want.

So the engine gets me. The storefront doesn't. My one real worry — that it'd shove me into the O-1A business
box — turns out to be unfounded *if I pick the right thing*, but the instant read I see first runs off
keywords and limps right past "Michelin" and "guest-chef," so my very first verdict could come back thinner
than I am. Fix the masthead to say my field exists, say "arts six" out loud once, and let me meet the real
model sooner, and I'd trust this for an afternoon's work over eight weeks and ten thousand dollars. Today
I'd adopt it — but only because I refused to take the front page at its word, and most chefs won't. Would I
tell a peer? Only with a footnote: "ignore the homepage, pick O-1B, it actually knows what it's doing."

## What passed (protect these)

- **The O-1B arts pack is correct and reachable.** Six criteria, exact names matching his record's natural
  buckets, threshold 3-of-6, no silent O-1A fallback when O-1B is explicitly selected
  (`packs.ts:99-141`, `qualification.ts:108-110, 120-141`). This is the whole ballgame for an arts
  Character and it's right.
- **End-to-end classification fidelity.** O-1B threads qualify → persisted criteria → draft headings →
  validation record without leaking into the O-1A eight (`draftOperation.ts:147-161`, `drafting.ts:177,204`).
- **Disclaimer discipline.** Canonical `DISCLAIMER` attached at the factory on every AI payload and rendered
  first/non-dismissible (`result.ts:37-41`, `CriteriaReport.tsx:48`).
- **Validation page is real evidence, arts-aware.** O-1B verified, 8 CFR 214.2(o)(3)(iv), 3-of-6, cited to
  primary law + USCIS Policy Manual Vol. 2 Part M — his own reference (`validation.ts:79-102`).
- **Pricing can't drift / no sales-wall.** Bundles sourced from canonical `economy.ts`; `/pricing`→`/billing`
  redirect keeps old links alive (`economy.ts:43-50`, `pricing/page.tsx:7-9`).
- **Citation discipline + section continuity.** No-fabrication rules, exhibit-number quarantine, and the
  shipped G1.1 continuity context on regenerate (`drafting.ts:160-192,593-608,222-267`).
