# L1 report — Karen Whitfield (cold prospect / buyer)

- **Character:** Karen Whitfield — solo immigration attorney, evaluating cold as an external prospect
- **Segment:** prospect-buyer
- **Journeys walked:** evaluate-as-prospect (HIGH), qualify-verdict, share-verdict
- **Date:** 2026-06-19 · **cert_level:** L1 (theoretical, code-grounded, no browser)

---

## Journey 1 — evaluate-as-prospect → **L1-conditional**

**Walkthrough.** I land cold on `/`. Within the first screen the positioning is exactly what I
need to see: "work product, ready for *your* attorney of record to review and sign before filing —
informational drafting, never legal advice" (`src/app/page.tsx:151-157`), and Promise III states
flatly "We're a drafting tool, not a law firm — and never legal advice"
(`src/app/page.tsx:254-255`). Pricing is genuinely self-serve and transparent: the four prepaid
bundles render straight from the canonical `BUNDLES` in `economy.ts`
(`src/app/page.tsx:13,326-368` ← `src/lib/tokens/economy.ts:43-50`), and `/billing` reads from the
*same* constant (`src/app/billing/page.tsx:10,95`), so the prices structurally cannot drift between
landing and billing. The free grant is one constant too (`FREE_SIGNUP_GRANT`,
`economy.ts:11`), surfaced identically on both pages. Enterprise is the only "contact sales," and
it's correctly scoped to high-volume/SSO/invoicing — the *core* self-serve offer has no
contact-us wall. No "file your visa in minutes" overclaim on the primary masthead; the strongest
claim is "Drafted in minutes" (`page.tsx:249`) qualified immediately by "You and your attorney
refine from there." `/pricing` cleanly 301s to `/billing` (`src/app/pricing/page.tsx:7-9`) so no
dead/stale fee copy survives.

The `/validation` page is the standout — it's *evidence, not adjectives*: real primary-law
citations (eCFR, Cornell LII, USCIS Policy Manual, the Arizona Supreme Court ABS order PDF), the
exact legal basis per program (`8 CFR 214.2(o)(3)(iii)`, `204.5(h)(3)`), thresholds, review dates,
a freshness countdown, and — crucially — an honest two-layer model that separates "verified
(matches primary sources)" from "counsel-approved (cleared to file)"
(`src/app/validation/page.tsx:62-69`, data in `src/features/qualification/validation.ts:54-202`).
It even flags its own UK program as `needs-review` with a "MODEL MISMATCH" note
(`validation.ts:127-147`). A CI gate enforces that no live program ships unverified
(`validation.ts:6-9`). This is the credibility artifact I came to find.

**But it has two real problems.** First and biggest: the **FAQ describes a different company than
the rest of the site** — a full-service law firm on a flat-fee retainer, not a self-serve drafting
tool. It says "the same attorney listed as counsel of record" reads your petition, "we coordinate
the Application Support Center appointment," "it's part of the flat fee," "the attorney portion of
the flat fee is non-refundable," and "your attorney of record answers directly"
(`src/app/faq/page.tsx:22,26,30,38,46,68`). That is the *opposite* of "we're a drafting tool, not a
law firm; *your* attorney signs" — and it's the surface where a careful buyer goes to kill her UPL
objection. For an attorney evaluating the compliance story, this contradiction is a trust blocker:
it reads as if the platform *is* the firm of record and bills a flat legal fee, which is the exact
UPL/positioning ambiguity the rest of the site works hard to avoid. Second: the **excellent
`/validation` page is unreachable from any cold-prospect surface** — it's linked only from inside
the authenticated `/qualify` panel (`src/features/qualification/components/QualifyPanel.tsx:165`),
never from the landing/billing/faq/landing-claude nav or footer (confirmed: no `/validation` href
in `src/app/page.tsx`). The one page that would most move my adoption decision is the one I'd never
find in my 90-second scan.

---

## Journey 2 — qualify-verdict → **L1-pass**

**Walkthrough.** The hero screener (`InstantVerdict`) lets me paste a background with zero signup
and returns a per-criterion verdict. It POSTs to `/api/qualify/preview`
(`InstantVerdict.tsx:64`), which deliberately runs the **deterministic, keyless** screen — no
model, no charge, no DB, no leak of a paid engine to anonymous traffic
(`src/app/api/qualify/preview/route.ts:14-28,69-70`). The verdict genuinely reflects my input: the
mock keys each O-1A criterion off regex matches against *my pasted text*, names the matched
evidence, and only marks a criterion "Met" when the text actually supports it
(`qualification.ts:225-248`, packs at `packs.ts:38-94`). It renders through the *same*
`CriteriaReport` the authenticated funnel uses, so the eligibility math is shared: "None" never
renders green, unscored criteria never count, and the 3-of-8 threshold is honored via
`summarizeCriteria(..., threshold)` (`CriteriaReport.tsx:40-43,85-87`). The `DISCLAIMER` renders
**first** and prominently as a non-dismissible `role="note"` block (`CriteriaReport.tsx:47-48`,
`DisclaimerStamp.tsx:8-29`). The SoftGate is honest about what I just got — "This was the instant
read. Run the full screening..." — and carries my input forward without re-typing
(`InstantVerdict.tsx:255-286`). The *real* model path behind `/qualify` is properly grounded too:
`buildQualifyPrompt` injects my actual profile text and forbids fabrication ("Base every score ONLY
on what the user actually describes," `qualification.ts:131-138,159-162`).

**Honest nuance (carry to L2, not a blocker):** the *free* hero verdict is keyword-driven, so a
strong candidate who describes achievements without the trigger words (e.g. "ran the standards
committee" without "judge/review/panel") could be under-scored on the free read. It's a useful,
input-reflecting verdict — not a husk — but it is the floor, not the model. L2 should fill real
inputs on the authenticated `/qualify` and confirm the live model output names the supplied
evidence and crosswalks the right criterion.

---

## Journey 3 — share-verdict → **L1-pass**

**Walkthrough.** A positive screen offers `LettersPatentShare`, which mints a `/c/[token]` link by
encoding *only* the postable facts — name, classification, likelihood, per-criterion status chars —
and **never the profile text** (`letters-patent.ts:21-29,69-77`; component comment
`LettersPatentShare.tsx:8-11`). The certificate page and its OG card decode the token alone, no DB,
and render from the real criteria pack so the card can't drift from the product's criteria
(`src/app/c/[token]/page.tsx:43-49`, `opengraph-image.tsx:23-31`). Tampering is handled: a token
naming a non-live program or with a mismatched criteria count returns `null` → 404
(`letters-patent.ts:84-97`). The framing is honest — "Informational only · not legal advice · no
account needed" (`page.tsx:118-120`) and the stamp reads "Qualifies / In progress" against the pack
threshold, not a legal grant (`page.tsx:124-131`). Nothing private leaks; nothing overclaims. This
is something I'd be comfortable having a client or peer see.

---

## Findings table

| id | journey | type | severity | dimension | title | code_check | verdict |
|----|---------|------|----------|-----------|-------|------------|---------|
| kw-eval-01 | evaluate-as-prospect | trust | major | trust | FAQ contradicts the "drafting tool, not a law firm" positioning (flat-fee firm-of-record voice) | confirmed-broken | confirmed |
| kw-eval-02 | evaluate-as-prospect | missing-feature | major | missing | `/validation` (the evidence page) is unreachable from any cold marketing surface | confirmed-absent | confirmed |
| kw-eval-03 | evaluate-as-prospect | confusion | minor | trust | FAQ names "Gemini" as the drafter; engine label is inconsistent with the product's stated engine | present-broken | confirmed |
| kw-eval-04 | evaluate-as-prospect | quality-gap | minor | clarity | `/landing-claude` carries no FAQ/validation/pricing link and no footer disclaimer block (inline only) | confirmed-absent | uncertain |
| kw-qual-01 | qualify-verdict | quality-gap | minor | senior-quality | Free hero verdict is keyword-only; can under-score a strong record phrased off-keyword | by-design | confirmed |
| kw-eval-05 | evaluate-as-prospect | strength | polish | trust | Pricing + free grant sourced from canonical `economy.ts` BUNDLES — cannot drift landing↔billing | n-a | confirmed |
| kw-eval-06 | evaluate-as-prospect | strength | polish | trust | `/validation` shows real primary-source citations + verified/counsel-approved two-layer honesty + CI gate | n-a | confirmed |
| kw-qual-02 | qualify-verdict | strength | polish | trust | DISCLAIMER rides first/non-dismissible on every screening; mock is grounded in real pasted input | n-a | confirmed |
| kw-share-01 | share-verdict | strength | polish | trust | Share token carries only postable facts, never profile text; tamper-checked; honest framing | n-a | confirmed |

---

## First-person review (Karen's voice)

I came in jaded, thumb on the back button, and the front door mostly held. The headline doesn't
promise me a visa in minutes — it tells me it drafts *work product* that *my* attorney signs, and
it says "not a law firm" out loud. Good. The pricing is right there, in tokens, self-serve, with a
free grant — no "book a demo to learn the price" wall on the core offer, which is the single fastest
way overhyped legaltech loses me. And then I found the validation page and actually exhaled: real
CFR citations, the Arizona ABS order, review dates, and an honest line between "we verified this
against the sources" and "counsel has signed off." That's a team that understands the difference
between *correct* and *cleared to file*. That page is the reason I'd give them a second look.

Two things stopped me short of "start today." First, the FAQ reads like a different company wrote
it — a flat-fee immigration *firm* with an attorney of record, biometrics coordination, and a
non-refundable legal fee. That's precisely the page where I go to settle my "who's liable, who
signs, is this UPL" worry, and instead it muddied the exact line the homepage drew so carefully. If
a client read the homepage ("not a law firm") and then the FAQ ("the attorney listed as counsel of
record"), they'd be confused about what they're buying and who's responsible — and a confused
client near a bar license is my problem, not theirs. Fix the FAQ to match the self-serve drafting
model and I move from "interested" to "trialing." Second, the best evidence you have is buried: I
only stumble onto `/validation` if I'm already deep in the qualify flow. Put it in the footer next
to FAQ and you'd convert skeptics like me on the first visit.

The free screener earned trust rather than spending it. It read what I pasted, scored each of the
eight criteria honestly, never colored an empty criterion green, led with the not-legal-advice
stamp, and was upfront that the instant read is a floor with the real model a click away. The share
certificate is tasteful and honest — it brags on likelihood and criteria, not on a legal outcome,
and it leaks nothing I didn't choose to post. Would I tell a peer? Yes — with the caveat "ignore
the FAQ, read the validation page." That's a fixable caveat, and the bones underneath are the most
honest I've seen in this category.

---

## What passed (strengths worth protecting)

- **Canonical pricing.** Landing + billing both read `BUNDLES` / `FREE_SIGNUP_GRANT` from
  `economy.ts` — prices and the free grant cannot drift (`page.tsx:13`, `billing/page.tsx:10`).
- **The UPL line is load-bearing and consistent on the AI path.** One `DISCLAIMER` constant
  (`src/lib/result.ts:37-41`), attached in one factory (`buildQualifyResult`), rendered first and
  non-dismissibly by `DisclaimerStamp` on every screening output.
- **`/validation` is genuine evidence.** Primary-law citations, thresholds, review dates, freshness,
  the verified-vs-counsel-approved two-layer model, self-flagged UK mismatch, CI-enforced.
- **The free verdict reflects real input** and shares the funnel's eligibility math (no green on
  "None," 3-of-8 honored). Useful, not a teaser husk.
- **Share is privacy-safe and honest** — token encodes only postable facts, tamper-checked, framed
  as informational not a legal grant; no DB required.
- **No dark patterns** on the core funnel: free grant is real, "no" costs nothing
  (`page.tsx:394-397`), enterprise contact-wall is correctly limited to the enterprise tier only.
</content>
</invoke>
