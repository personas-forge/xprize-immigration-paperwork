# L1 review — Derek Tan, Global Mobility / People-Ops manager

- **Character:** `derek-tan-mobility-manager` · segment: prospect-buyer (non-lawyer operational buyer)
- **Journeys walked:** evaluate-as-prospect, qualify-verdict, share-verdict
- **Date:** 2026-06-20 · **cert_level:** L1 (theoretical, code-grounded, no browser)
- **Reachability:** Every surface in Derek's binding (`/`, `/billing`, `/pricing`→`/billing`, `/faq`,
  `/qualify`, `/c/[token]`, `/validation`, `/landing-claude`) is public/unauthed and reachable.
  The one nuance that shapes his verdict: the **free, no-signup screener** Derek runs to triage
  candidates is the deterministic **keyword mock** (`/api/qualify/preview` + best-path), NOT the real
  model — the model-backed screening is gated behind sign-in at `/api/qualify`
  (`src/app/api/qualify/route.ts:42`). That gate is by-design and honestly labelled, but it's the
  line between what Derek can do cold and what needs an account.

---

## Journey 1 — evaluate-as-prospect · **L1-pass**

**Surface model (code-grounded).** Marketing surfaces are all server-rendered and read pricing from
the canonical token config, so numbers can't drift:
- `/` (`src/app/page.tsx`) — hero anchors the firm comparison verbatim ("$8,000 to $15,000 to
  assemble", `page.tsx:154`), pricing block maps `BUNDLES` from `economy.ts` (`page.tsx:13,326-368`),
  positioning triple ("Pay only for what you draft" / "Your attorney signs — you own the filing" /
  "never legal advice", `page.tsx:240-256`).
- `/billing` (`src/app/billing/page.tsx`) — balance ledger + `BundleGrid` from `BUNDLES`
  (`billing/page.tsx:108`); the "What a token buys" list is driven from the `OperationRegistry`
  (`billing/page.tsx:24-30,146-156` → `registry.ts:37-44`) so per-op prices can't drift from what
  metering charges; "Not legal advice" + "Refunds" footnotes (`billing/page.tsx:162-169`).
- `/pricing` → permanent redirect to `/billing` (`pricing/page.tsx:8`) — exactly what Derek wants
  (he just wants the price; no dead copy).
- `/faq` (`src/app/faq/page.tsx`) — eight Q&A. Q4 states the full price table in plain language: "150
  free tokens… screening costs 3 tokens, a full petition-letter draft 12, a single-section regenerate
  or an RFE response 5, and evidence categorization 1. Top up… from $5" (`faq/page.tsx:39`); Q3 spells
  out the RFE path with NO separate legal-service fee (`faq/page.tsx:35`); Q7 refunds; Q8 data
  security (`faq/page.tsx:51,55`).
- `/validation` (`src/app/validation/page.tsx`) — renders real `PROGRAM_VALIDATIONS` /
  `COMPLIANCE_VALIDATIONS` records: legal basis, last-reviewed date, a freshness meter, and clickable
  primary-source citations (`validation/page.tsx:186-257`); two-layer "verified ≠ counsel-approved ≠
  legal advice" framing (`validation/page.tsx:62-69`).
- `/landing-claude` (`src/app/landing-claude/page.tsx`) — same $8K–15K anchor + "never legal advice"
  promise (`landing-claude/page.tsx:59-63,201`).

**Walkthrough (in Derek's head).** Cold from a Slack link, in two minutes I get exactly the four
things I came for. Cost-per-case is *right there* and self-serve — no "contact sales" on the core
offer (Enterprise contact-sales is correctly fenced to SSO/invoicing/high-volume only,
`billing/page.tsx:111-134`). The headline price math is honest: a screening is 3 tokens, a full draft
12 (~$0.60–$1.20 at the 0.5–1.0¢ bundle rates in `economy.ts:43-50`), an RFE 5 — versus the firm's
$8K–15K I can paste into a spreadsheet the same minute, because the page hands me that exact firm
anchor. Crucially for me, **there is no hidden RFE surcharge**: the FAQ says the RFE drafter is just
another 5-token op with "no separate legal-service fee" (`faq/page.tsx:35`) — that's the line that
usually balloons a firm bill, and here it's flat. "Who signs" is unmistakable on every surface: *my/the
candidate's own attorney of record* reviews and signs; the tool is a drafting tool, not a law firm
(`page.tsx:254-256`, `faq/page.tsx:31`, `landing-claude:201`). I can paste the FAQ answers straight to
a candidate without translating.

Two things make me raise an eyebrow rather than walk. First, the homepage hero card is a hardcoded
sample petition stamped **"Approved · 92% likelihood"** (`page.tsx:228`) — it's a decorative
`aria-hidden` ornament on a fake "Dr. A. Krishnan" case, but as a buyer who's been burned by HR-tech
that demoed beautifully, a 92%-Approved hero reads a hair like the "file in minutes!" theater I
distrust. (Already on the backlog as **PN-QUAL-01 / G3.1** — softening "Approved/Certificate"
framing.) Second, the alt masthead claims **"The statute asks for three. *Most of our candidates meet
seven.*"** with all eight criteria pre-ticked green (`landing-claude/page.tsx:90-114`) — that's a
flatter-everyone marketing line on a static page, the kind of "everyone qualifies" tell that's exactly
my pet peeve. Neither blocks adoption (both are marketing flourish, not a product claim, and the real
screener behaves honestly — see J2), so this journey passes; I'm logging them as the trust nits a
senior buyer would clock.

**Grounding score:** n/a (non-AI surfaces). Pricing-fidelity grounding = **2/2** (homepage + billing
both source from `BUNDLES`/`registry`; no drift possible).
**Est. time-saved-if-it-worked:** the whole adopt-or-walk decision in ~3 minutes with no sales call,
vs. days of back-and-forth scoping a firm engagement — and a per-case tool cost of dollars vs $8K–15K.

---

## Journey 2 — qualify-verdict · **L1-conditional**

**Surface model (code-grounded).** Two entry points, two different engines:
- Homepage hero `InstantVerdict` (`page.tsx:98`, `InstantVerdict.tsx`) and `/qualify`
  `BestPathFinder` (`QualifyEntry.tsx:45`, `BestPathFinder.tsx`) → POST `/api/qualify/preview` and
  `/api/qualify/preview/best-path`. Both routes run ONLY the deterministic, keyless
  `mockQualification` (`preview/route.ts:69`, `preview/best-path/route.ts:57` → `best-path.ts:145`):
  no model, no charge, no signup, always labelled `source:"mock"`, always carries `DISCLAIMER`.
- `/qualify` "I already know my visa" → `QualifyPanel` (`QualifyEntry.tsx:38`) → POST `/api/qualify`,
  which IS the real model (`route.ts:36-57`, `buildQualifyPrompt` at `qualification.ts:120`) and
  **requires sign-in** (`route.ts:42`), costs 3 tokens (button shows `costOf("qualify")`,
  `QualifyPanel.tsx:209`), and persists a case.

**Grounding audit (the mock path — what Derek actually gets cold).** Sources the screen *should* use,
and what reaches the scorer:
1. Pasted background text — **yes** (the whole `profile` is the input, `qualification.ts:226`).
2. The correct per-visa criteria pack (8 O-1A / 6 O-1B / 10 EB-1A) — **yes**; `packFor()` selects by
   classification (`packs.ts:223`) and the preview validator gates to live programs
   (`qualification.ts:108`); for the O-1A Derek screens, the right 8 criteria load.
3. ≥3 threshold honoured, "None" never green — **yes**; `CriteriaReport` reuses `summarizeCriteria`/
   `statusTone` so unscored rows render neutral and the summary can't disagree with the rows
   (`CriteriaReport.tsx:40,137` + comments at :16-17).
4. Per-criterion reasoning grounded in *his* words — **partial**; the mock returns a templated
   `evidence`/`rationale` per matched criterion (`qualification.ts:233-236`, `packs.ts:38-88`), not a
   read of his specific text. It does NOT name his real evidence — that's the model path.
5–6. The model's depth (whole-record read, calibrated likelihood, real gap plan) — **not on the cold
   path** (it's behind sign-in).
**Grounding for the cold mock path = 3/6.** This is "honest machinery fed thin context by design":
the mock is a keyword read, and the `SoftGate` says so verbatim — "This was an instant keyword read.
The full screening reads your whole record in depth" (`InstantVerdict.tsx:273-277`). For the
authenticated model path, the prompt is well-built and faithful (rule 2: "Base every score ONLY on
what the user actually describes"; rule 4 anti-double-counting; `qualification.ts:131-138`), so its
grounding on the pasted profile is **4/6** — L2 must confirm the live output actually names his
specifics.

**Calibration check (the "flatter everyone" pet peeve — the make-or-break for triage).** The mock is
NOT a yes-machine: each criterion is `hit ? "Met" : "None"` on a keyword regex, likelihood =
`38 + qualifying*8` capped 95 (`qualification.ts:240-242`). A thin profile lands ~38% with mostly
"None"; a strong one climbs. So it *does* discriminate — good enough to triage. BUT one calibration
soft spot a senior would catch: the `ORIGINAL` criterion regex is very broad — `product | launched |
shipped | github | framework | library | adopted | downloads | stars` (`packs.ts:67`) — so virtually
any engineer's blurb trivially scores it "Met," inflating the count by one for the whole population.
It won't make *everyone* qualify (you still need 3), but it pads the read for exactly Derek's segment
(engineers), nudging borderline candidates over the line and eroding triage sharpness. Minor, and the
honest model path is the real read, but it's the one place the cold screener over-credits.

**Walkthrough.** I paste a real engineer's CV highlights, no signup, ~20 seconds, and get a yes/no/
maybe with the eight criteria scored and a gap list — clean, plain-language, "Not legal advice"
stamped first and prominent (`DisclaimerStamp.tsx`). The best-path comparison is genuinely useful:
it ranks O-1A/O-1B/EB-1A with a reasoned rationale (clears-threshold → margin → gaps → likelihood,
`best-path.ts:105-135`) and flags EB-1A as a green card — not a coin-flip. "What happens next" tells
me create account → upload evidence → attorney reviews (`QualifyPanel.tsx:299-303`), so the lawyer's
seat is unmistakable. What stops this from a clean pass: (a) the cold screener I'd run on five
engineers is the *keyword* read, not the model — fine for a first cut but I should know my afternoon
triage is keyword-grade unless each candidate signs in; (b) the `ORIGINAL`-regex over-credit above.
Both are L2-verifiable on the live model path.

**Grounding score:** cold mock path **3/6**; authenticated model path **4/6**.
**Est. time-saved-if-it-worked:** screen five engineers in an afternoon for $0 (or 3 tokens each
signed-in) vs. paying a firm to pre-assess or guessing — easily a week of triage and a four-figure
pre-screen fee collapsed to minutes.

---

## Journey 3 — share-verdict · **L1-pass**

**Surface model (code-grounded).** Result → `LettersPatentShare` (`InstantVerdict.tsx:201`,
`QualifyPanel.tsx:271`) mints a token client-side via `encodeSnapshot`
(`letters-patent.ts:69`): base64url of `{name, classification, likelihood, per-criterion status
chars}` — **never the profile text** (`letters-patent.ts:70-77`, comment :22-29). `/c/[token]`
(`src/app/c/[token]/page.tsx`) decodes with `decodeSnapshot`, which **rejects** a tampered/wrong-pack
token (non-live program, or status count ≠ pack length → `notFound()`, `letters-patent.ts:93-97`,
`c/[token]/page.tsx:46`), renders from the real pack, and the corner Stamp reads "Qualifies" only when
`qualifying >= threshold`, else "In progress" (`c/[token]/page.tsx:126`). The OG card
(`opengraph-image.tsx`) is server-drawn from the same decoded token with a generic fallback.

**Walkthrough.** A candidate can mint a clean, public certificate link and forward it to a manager or
their own attorney without embarrassment: it shows name, likelihood, criteria-supported count, and a
coat-of-arms of criterion badges — and carries "Informational only · not legal advice · no account
needed" right under the CTA (`c/[token]/page.tsx:118-120`). Nothing private rides in the URL (no DB,
no profile text), so I'd let a candidate share it. It's framed as a screening verdict, not a legal
grant — honest. The only thing I'd flag for taste, not safety: it's branded "Letters Patent /
Certificate of Extraordinary Ability" with a wax seal and guilloché — engraved and a touch
ceremonial. For my crowd it lands as a fun, credible card; for a more sober candidate it skirts the
"diploma-mill" edge — but the *content* is sober (real counts, "In progress" when below threshold),
so it clears my bar. This is the same "ceremony vs sober screening" tension already logged as
**PN-QUAL-01 / G3.1**; I won't double-count it.

**Grounding score:** 5/5 facts that should ride in the token do, and nothing extra leaks (name,
classification, likelihood, statuses; profile excluded by construction).
**Est. time-saved-if-it-worked:** a forwardable credibility artifact per candidate in one click — vs.
me writing a "here's where this engineer stands" summary by hand for each manager/attorney.

---

## Findings table

| id | journey | type | severity | dimension | impact (f/r/t) | title | code_check | verdict |
|---|---|---|---|---|---|---|---|---|
| dt-eval-01 | evaluate-as-prospect | strength | polish | trust | h/h/— | Pricing can't drift — homepage + billing + FAQ all source the canonical `BUNDLES`/registry; full price table is plainly stated, no contact-sales on the core offer | present-broken→n-a (strength) | confirmed |
| dt-eval-02 | evaluate-as-prospect | strength | polish | trust | h/h/— | "Who signs / not legal advice / not a law firm" is consistent across every marketing surface and the FAQ is paste-ready for candidates | by-design | confirmed |
| dt-eval-03 | evaluate-as-prospect | trust | minor | trust | med/high/med | Alt masthead's "Most of our candidates meet seven" + all-eight-pre-ticked is a flatter-everyone marketing line — Derek's exact pet peeve | confirmed-absent (no data backing; marketing copy) | confirmed |
| dt-eval-04 | evaluate-as-prospect | trust | minor | trust | med/high/low | Homepage hero card hardcodes "Approved · 92% likelihood" on a sample petition — reads as "file in minutes" theater to a burned buyer | by-design (decorative, aria-hidden) — backlog PN-QUAL-01/G3.1 | confirmed |
| dt-qual-01 | qualify-verdict | quality-gap | minor | senior-quality | high/high/med | Cold no-signup screener is the keyword MOCK, not the model — Derek's "triage 5 engineers in an afternoon" runs on keyword-grade reads unless each signs in | by-design (honestly labelled in SoftGate) | confirmed |
| dt-qual-02 | qualify-verdict | quality-gap | minor | trust | med/high/med | `ORIGINAL` criterion regex is so broad nearly any engineer scores it "Met", padding the mock count by one for Derek's whole segment | present-broken | confirmed |
| dt-qual-03 | qualify-verdict | strength | polish | trust | h/h/— | Mock is NOT a yes-machine (base 38, +8/criterion, "None" for un-matched) and DISCLAIMER + "≥3 to qualify" + "None never green" all hold | by-design | confirmed |
| dt-share-01 | share-verdict | strength | polish | trust | h/h/— | Share token carries only postable facts (no profile text, no DB), tamper-rejects wrong-pack tokens, and is framed informational-not-a-grant | by-design | confirmed |

---

## First-person review — Derek Tan

Honestly? This is the first one of these that didn't make me close the tab in the first thirty
seconds. I came in cold from a recruiter's Slack expecting another "file your visa in minutes!" toy
with a "contact sales" wall hiding the real price, and instead the number I care about is sitting
right there: a screening is 3 tokens, a full draft is 12, an RFE is 5, 150 free to start, bundles from
$5. I can put that in a spreadsheet next to the firm's $8K–15K — and the site *hands me that firm
anchor itself*, which tells me they're not pretending to be something they're not. The thing that
actually won me over is the RFE line: with the outside firm, an RFE is where the bill quietly doubles,
and here the FAQ flat-out says it's just another 5-token op with no separate legal fee. That's the
hidden-fee trap, closed. And "who signs" is everywhere — *my* attorney of record reviews and signs,
they're a drafting tool not a law firm, never legal advice. I never once worried I'd accidentally have
People-Ops giving immigration advice to a hire. I can paste the FAQ answers straight to a candidate.

Where I narrow my eyes: two bits of marketing theater that don't match the honesty of the rest. The
hero card stamps a fake "Approved · 92%" and the alt landing brags "most of our candidates meet seven"
with every criterion pre-checked green. On a static page that's just copy, but it's the exact tell I've
been burned by, and a sharper sober framing would make me trust the whole thing more, not less. The
real screener underneath is honest — a thin résumé gets a thin score, "None" stays grey, you still
need three — so it's a packaging problem, not a product lie. My one real operational catch: the free,
no-signup screen I'd run on five engineers in an afternoon is a *keyword* read, not the deep model
read (which sits behind a sign-in). The tool is upfront about that — it literally says "instant keyword
read" — but it means my fast triage is keyword-grade, and that broad "original contribution" keyword
will over-credit basically every engineer by one criterion. For a first cut that's fine; I'd just sign
each promising candidate in for the real read before I trust the number.

Would I adopt it? For drafting + triage at dollars-per-case instead of five figures, with the lawyer's
seat unmistakable and the candidate experience clean enough to forward without cringing — yes, I'd run
a pilot. Would I tell a peer? Yes, with the caveat: "the price and the honesty are real; just know the
free screen is a keyword first-pass and ignore the cheesy hero stamp." That's a strong verdict from
me.

---

## What passed (protect these)

- **Pricing can't drift** — `/`, `/billing`, and the FAQ all derive from canonical `BUNDLES`
  (`economy.ts:43`) and the `OperationRegistry` (`registry.ts:37`); the full per-op price table is
  stated plainly; Enterprise contact-sales is correctly fenced off the core self-serve offer.
- **No hidden RFE surcharge** — RFE is a flat 5-token op with "no separate legal-service fee"
  (`faq/page.tsx:35`); the headline doesn't balloon.
- **UPL line is load-bearing and consistent** — "drafting tool, not a law firm / your attorney of
  record signs / never legal advice" on every surface; `DISCLAIMER` rides on every AI payload via the
  single factory (`result.ts:37`) and renders first, prominent, accessible
  (`DisclaimerStamp.tsx`, `CriteriaReport.tsx:48`).
- **Honest free screener** — the no-signup mock discriminates (not a yes-machine), keeps "None" grey,
  honours ≥3, and the `SoftGate` truthfully labels itself a keyword read vs. the deeper model.
- **Clean, private, tamper-resistant share card** — token carries only postable facts, no DB, no
  profile leak; rejects wrong-pack tokens; framed informational-not-a-grant.
- **Reasoned best-path** — multi-program ranking with a plain-language rationale and a green-card flag,
  not a coin-flip.
