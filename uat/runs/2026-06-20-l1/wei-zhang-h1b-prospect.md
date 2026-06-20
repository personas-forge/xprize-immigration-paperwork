# L1 review — Wei Zhang (H-1B-stuck engineer, O-1A prospect-buyer)

- **Character:** wei-zhang-h1b-prospect · **Segment:** prospect-buyer (external, price-sensitive, eligibility-seeker)
- **Journeys walked:** qualify-verdict, evaluate-as-prospect, share-verdict
- **Date:** 2026-06-20 · **cert_level:** L1 (theoretical, no browser)

> Lens (held identically): the free/keyless verdict must tell me the **honest truth** — including an
> honest "not yet" — on my *real* pasted record; no flatter-to-sell "yes," no signup/paywall before
> value; the eight criteria scored against what I wrote with unscored ones **neutral, never green**;
> price plainly in dollars vs a $300–$600 consult; credibility (real sources, straight FAQ); the
> verdict carries the not-legal-advice disclaimer and makes clear my **own attorney signs**; and a
> positive share leaks **nothing private**. A self-serving "yes" is the failure; the honest "not yet"
> is the feature.

## Reachability resolution (before judging)

I arrive cold and unauthenticated. My actually-reachable set is the **public** surface: `/` (the
hero `InstantVerdict`), `/qualify` (BestPathFinder + the authenticated `QualifyPanel`), `/faq`,
`/validation`, `/billing`, `/pricing` (→ redirects to `/billing`, `pricing/page.tsx:7-9`),
`/landing-claude`, and `/c/[token]`. I do **not** reach the dashboard, the review queue, or sign/file
(fail-closed on `isConfiguredAttorney` — by design, not mine to walk).

**The free path is the deterministic mock — and that is exactly what I judge.** As a keyless visitor
the hero hits `/api/qualify/preview` → `mockQualification` (no model, no charge, no DB, always
labelled `source:"mock"`, `preview/route.ts:62-70`). The "deep" model-backed read sits behind
`/api/qualify`, which `Sign in to run a qualification assessment` (`api/qualify/route.ts:42`). So my
entire first interaction — the trust test — runs on the **keyword engine**, never the real Claude
read the senior reviewers verify on the authed path. **Pack correctness** is neutral for me: I'm
O-1A and `packFor("O-1A")` returns the right 8-criterion pack, threshold 3 (`packs.ts:90-98`,
`criteria.ts:8`) — no silent fallback risk in my journey.

---

## qualify-verdict — **L1-conditional**

**Grounding (the path I actually see — hero preview): keyword-only.** This is the crux. The mock
scores each O-1A criterion by a regex against my paste (`qualification.ts:225-248`, `packs.ts:38-88`)
and a criterion is **`Met`** the instant its keyword fires — nothing else. I'm the thin-record case
the screener is supposed to be honest with: staff title, some adopted open-source, a couple of
conference talks, decent comp, **no awards, no press**. Walk my likely paste through the regexes:

- `Awards` → no match → **None** ✓ (honest)
- `Membership` → no → **None** ✓
- `Press` → no → **None** ✓ (correctly catches that I have no press)
- `Judging` → no → **None** ✓
- `Original contribution` → `open[- ]?source|github|library|widely[- ]?used|stars?` → **Met** (`packs.ts:62-70`)
- `Scholarly articles` → the regex includes **`conference`** (`packs.ts:71-76`) → my "conference talks" light it **Met** — a *talk* scored as a *publication*
- `Critical role` → matches `lead|principal|director|...` but **not `staff`** → **None** (so a staff engineer is *under*-scored here)
- `High remuneration` → `equity|\$\s?\d|compensation` → **Met**

That's **3 × Met → `summarizeCriteria.meetsThreshold = true` → a green "Meets threshold" badge and
likelihood `38 + 3×8 = 62%`** (`qualification.ts:240-242`, `criteria.ts:74-102`,
`CriteriaReport.tsx:85-87`). The screener hands me the **eager "yes"** I came braced against —
assembled with a brand Seal, Guilloché watermark, and "Certificate · Extraordinary-ability" framing
(`InstantVerdict.tsx:190-216`) — off keyword presence, with a *talk* miscounted as scholarship. For
**me specifically** this is the worst failure mode in the product: a flattering "you meet the bar"
that could lure me into paying 12 tokens for a draft I can't actually use yet — which my character
note calls *"worse than worthless."* This is the **same keyword defect Kenji logged as `kw-qualify-01`
(major/trust)**; I'm recording it from the inverse seat (a *thin* record falsely inflated, not a
strong one mislabeled) and tagging the prospect-specific harm (**WZ-QUAL-01**). It also overlaps the
**backlog G3.1 / PN-QUAL-01** "Certificate/Approved theater" framing concern, but the live mechanism
(a keyword producing a wrong `Met` + a green threshold badge) is sharper than "branding."

**What genuinely protects me here (and softens the above to conditional, not fail):**
1. **The build is honest that the hero is shallow.** The result badge reads **"Template"** (neutral
   tone, `label.ts:13-17`, `CriteriaReport.tsx:64`), and the SoftGate under the certificate says in
   plain words *"This was an instant keyword read. The full screening reads your whole record in
   depth…"* (`InstantVerdict.tsx:270-277`). That's more honesty than any "are you eligible?!"
   calculator I've been burned by — it doesn't *pretend* the keyword pass is the real read.
2. **No signup/paywall before the read.** The hero form is name(optional)+visa+profile, POSTs, and
   renders inline — **no email field, no account gate** (`InstantVerdict.tsx:105-216`). AC #1's
   "no signup/paywall before the free read" passes cleanly.
3. **Unscored criteria render neutral, never green — structurally guaranteed.** `None` →
   `classifyStatus`="other" → `statusTone`="neutral" *and* excluded from the qualifying count, from
   the *same* classifier so tone and count can't disagree (`criteria.ts:27-48, 74-102`). My three
   honest `None`s (Awards/Membership/Press) will **not** fake-green to pad my odds — AC #2's
   never-green clause holds. The "X of 8 — need 3 to qualify" line is legible, not a black-box %
   (`CriteriaReport.tsx:57-62`).
4. **Disclaimer first + attorney-of-record.** The `DisclaimerStamp` renders first, non-dismissible,
   `role="note"` (`CriteriaReport.tsx:47-48`, `DisclaimerStamp.tsx:8-30`); the text names that an
   attorney of record must review before filing (`result.ts:37-41`). AC #3 holds; I'm never told the
   tool "files my visa."

So the **honesty *infrastructure* is right** (no paywall, neutral-not-green, honest "Template" label,
disclaimer) — but the **honesty of the keyword *content*** fails my central test: it can tell a thin
record it meets the threshold. The fix is one keyword (drop `conference` from `Scholarly`) plus,
ideally, surfacing the "keyword read" caveat *inside* the certificate card, not only in the gate
below it.

**Est. time-saved if it worked:** an honest, specific free read in minutes vs a **$300–$600 consult +
a week of scheduling** just to learn whether O-1A is worth pursuing — a real, decision-grade win,
**entirely contingent** on the read being honest. The 12-token (~$0.60–$1.20) draft vs $8k–$15k firm
bill is a strong downstream value *if* the verdict that sent me there was true.

## evaluate-as-prospect — **L1-conditional**

**Grounding: n/a (non-AI trust surfaces).** I'm cold-reading the marketing/credibility surfaces to
decide *funnel or tool?* — and mostly it holds up.

- **Positioning is consistent and non-overclaiming across surfaces.** Landing, FAQ, billing, and
  alt-masthead all say the same thing: a **drafting tool, not a law firm**; *your own* attorney of
  record reviews and signs; **never legal advice** (`page.tsx:150-157, 254-256, 373-374`,
  `faq/page.tsx:27,31,43`, `billing/page.tsx:163-165`, `landing-claude/page.tsx:62-63, 154, 201`).
  No "get your O-1 in minutes!" — the petition is framed as *work product* my attorney signs. AC #7
  largely passes.
- **Price is transparent and obviously self-serve.** 150 free signup tokens, qualify 3 / draft 12 /
  RFE 5 / categorize 1, bundles from $5 — and crucially these are **driven from the canonical
  `registry.ts`/`economy.ts` so the per-op prices and bundle prices can't drift** between landing,
  FAQ, and `/billing` (`billing/page.tsx:24-30, 146-154`, `economy.ts:43-50`, `registry.ts:37-44`,
  `page.tsx:357-367`). FAQ states the numbers verbatim (`faq/page.tsx:39`). The only "contact sales"
  is the **Enterprise** band (high-volume firms) — the **core offer is fully self-serve**, no
  contact-sales wall (`billing/page.tsx:112-134`). This crushes my "$500 just to talk to me" anchor —
  AC #4 passes.
- **Credibility — real sources, not adjectives.** `/validation` lists each program/compliance claim
  with a **legal basis, primary/agency sources with live URLs (eCFR, Cornell LII, USCIS Policy
  Manual, the AZ Supreme Court order PDF), a last-reviewed date, and a freshness countdown** —
  pulled from a real validation layer, CI-gated (`validation.ts:54-202`, `validation/page.tsx`). The
  FAQ answers my exact objections straight — what it does, who signs, cost, "is this legal advice"
  (no), accuracy (→ validation), refunds, data security (`faq/page.tsx:24-57`). AC #5 passes; this
  reads like a tool with receipts, not a lead magnet.

**The one thing that trips my funnel-radar (WZ-PROSPECT-01, minor/trust):** the alt-masthead
`/landing-claude` claims **"The statute asks for three. *Most of our candidates meet seven.*"**
(`landing-claude/page.tsx:90-91`) — an **unsubstantiated, statistically implausible** boast (if most
candidates met 7 of 8, O-1A would be trivial; there's no data behind "our candidates," and on a
90-day MVP there *are* no candidates). It's exactly the over-eager line that makes me suspect a
funnel. Right beside it, all eight criteria render a decorative green `✓` (`landing-claude:92-115`) —
harmless as a static list, but to a fast skeptical scan it rhymes with the "everything's green!" pet
peeve. This surface is reachable from the main footer ("Alt. masthead", `page.tsx:431`) and I'm told
to re-read it for consistency — and it's the *one* place the otherwise-disciplined copy slips into a
claim it can't back. Not in `accepted-gaps.md` or `BACKLOG.md`; a fresh finding.

**Est. time-saved if it worked:** decides "trust-and-proceed or walk" in ~2 minutes instead of a
consult — and on price/positioning/sources it earns the "proceed."

## share-verdict — **L1-pass**

**Grounding: n/a (pure codec, no AI).** Privacy-by-construction and honest framing.

- **Nothing private leaks.** `encodeSnapshot` puts only `name / classification / likelihood /
  per-criterion status` (in pack order) into a base64url token — **never my pasted profile text**
  (`letters-patent.ts:21-29, 69-77`; the component comment says it explicitly, `LettersPatentShare.tsx:9-12`).
  My CV highlights stay on my screen. AC #6's "nothing private leaks" passes cleanly.
- **DB-free + tamper-resistant.** `/c/[token]` and the OG image decode from the token alone, no DB;
  `decodeSnapshot` rejects a non-live program or a status count that doesn't match the live pack, so a
  hand-edited token can't render a bogus coat-of-arms (`letters-patent.ts:84-102`, `c/[token]/page.tsx:43-51`).
- **Framing is informational, not a legal grant.** The cert stamps **"Qualifies"** only at/above
  threshold, else **"In progress"** (`c/[token]/page.tsx:124-131`), reuses the same `statusTone` so a
  `None` criterion is neutral on the shared card too (`:104`), and carries *"Informational only · not
  legal advice · no account needed"* (`:118-120`). Credible enough to forward to counsel, not cheesy.

**The one caveat (WZ-SHARE-01, minor — same root as WZ-QUAL-01):** `LettersPatentShare` mounts on
**any** hero result, including the inflated keyword-mock one (`InstantVerdict.tsx:201-206`). So a
"Meets threshold / 62%" certificate minted **before I sign in** can encode the keyword mock's false
`Met`s — including the talk-as-scholarship one — and I'd share *that*. Fixing the heuristic at the
source (WZ-QUAL-01) fixes this too. Minor caveat: the **OG social card** itself carries no
"informational/not legal advice" line (only "Screen yourself free", `opengraph-image.tsx:104-106`) —
the page has it, the unfurled card doesn't; low-impact since the destination page is honest.

**Est. time-saved if it worked:** seconds — a clean, private, structured artifact to hand counsel.

---

## Findings table

| id | journey | type | severity | dimension | impact | title | code_check | verdict |
|---|---|---|---|---|---|---|---|---|
| WZ-QUAL-01 | qualify-verdict | trust | **major** | trust | H/H/H | Keyless mock can hand a thin record a false "Meets threshold / 62%" eager-yes (keyword `Met`, talk→Scholarly) | present-broken | confirmed |
| WZ-PROSPECT-01 | evaluate-as-prospect | trust | minor | trust | M/M/M | `/landing-claude` "Most of our candidates meet seven" — unsubstantiated overclaim trips funnel-radar | confirmed-absent | confirmed |
| WZ-SHARE-01 | share-verdict | trust | minor | trust | M/M/M | Hero-minted share token can carry the mock's inflated `Met`s (incl. OG card has no disclaimer line) | present-broken | confirmed |
| WZ-QUAL-02 | qualify-verdict | strength | polish | trust | H/H/L | STRENGTH: free read has NO signup/paywall; "Template" badge + "instant keyword read" gate are honest about shallowness | by-design | confirmed |
| WZ-QUAL-03 | qualify-verdict | strength | polish | trust | H/H/L | STRENGTH: `None` renders neutral & is excluded from count via one shared classifier — unscored never fake-greens | by-design | confirmed |
| WZ-PROSPECT-02 | evaluate-as-prospect | strength | polish | trust | M/H/L | STRENGTH: pricing/positioning canonical & consistent (no drift, no contact-sales wall on core offer); validation page = real primary sources | by-design | confirmed |
| WZ-SHARE-02 | share-verdict | strength | polish | trust | M/H/L | STRENGTH: share token leaks no profile text, DB-free, pack-validated, honest "Qualifies/In progress" framing | by-design | confirmed |

Severity counts: **major 1 · minor 2 · polish 4** (4 of 7 are strengths). **No blockers.**

---

## First-person review — in Wei's voice

I came in expecting a scam. I've closed a dozen "Are you eligible?!" tabs that exist only to grab my
email and sell me a $5k consult, and I half-believe O-1 is a Nobel-laureate thing I have no business
touching. So the test is simple: paste my real story — staff engineer, an open-source project people
actually use, a couple of conference talks, decent comp, *no awards, no press* — and see if it tells
me the truth or blows smoke.

First, the good surprise: there's **no wall**. No "enter your email to see your result." I type my
background, hit a button, and the verdict assembles right there, free. And it's *honest about being a
free thing* — the badge literally says "Template," and under the certificate it tells me, in plain
English, "this was an instant keyword read, the real screening reads your whole record." That's the
opposite of every funnel I've hit; those pretend the cheap read is the deep one. I exhale a little.

Then the bad surprise, and it's the one that matters to me. The card says I **meet the threshold —
62%** — and one of my green "Met" rows is **Scholarly articles**, scored off my *conference talks*. I
have never published a paper. A talk is not a paper, and the thing I most needed this tool to be
honest about — am I actually there, or am I kidding myself — it got *flatteringly* wrong in my favor.
That's the exact shape of the lie I came to avoid, just pointed at me instead of away. If I believed
it, I'd pay 12 tokens for a petition draft I can't use, because I don't qualify yet — which is worse
than the tool just telling me "not yet, here's what's missing." It *should* have said: you've got
Original-contribution and maybe High-remuneration, your Scholarly and Awards and Press are empty,
that's two real criteria, not three — close the gap. The machinery to be that honest is *right there*
(the "None" rows are correctly grey, the threshold line is legible) — it's one over-eager keyword
poisoning the read. Drop "conference" from the scholarly bucket and most of my distrust is gone.

On everything else, I'm pleasantly disarmed. The price is **dollars on a page**, not a $500 phone
call — 150 free tokens, a draft is ~a dollar, bundles from $5, and the numbers are the same on the
landing page, the FAQ, and the billing page (I checked, because drift is a tell). The validation page
isn't adjectives — it's eCFR and Cornell and USCIS Policy Manual links with review dates. The FAQ
answers "who signs" and "is this legal advice" straight: my own attorney, and no. That's a tool, not
a funnel. The *one* place it slips is the alt masthead bragging "most of our candidates meet seven" —
that's a made-up number on a 90-day MVP with no candidates, and it's exactly the kind of line that
makes me reach for the close button. Cut it.

Would I adopt it? **Not on today's free read — but close.** If the verdict stops calling my talks
publications and gives me the sober "you're at two, here's the third to chase," I'd trust it enough
to keep going, and at a dollar-a-draft vs an $8k firm it'd be a no-brainer once I *actually* qualify.
Would I tell a peer in the lottery? Only after the keyword fix — because a guy as skeptical as me sees
a too-eager "you qualify!" and assumes the whole thing's a sales trick, and never reaches the genuinely
honest parts underneath.

## What passed (protect these)

- **No signup/paywall before the free read** — hero is name+visa+profile → inline result, no email
  harvest (`InstantVerdict.tsx:105-216`, `preview/route.ts:62-70`).
- **Honest-about-shallow keyless path** — `source:"mock"` → "Template" badge + the SoftGate's
  "instant keyword read … the full screening reads your whole record" (`label.ts:13-17`,
  `InstantVerdict.tsx:270-277`).
- **Unscored criteria never fake-green** — `None` is neutral *and* excluded from the qualifying
  count via one shared classifier so tone and count can't drift (`criteria.ts:27-102`,
  `CriteriaReport.tsx:40-87`).
- **DISCLAIMER first + attorney-of-record** on every AI output, non-dismissible (`result.ts:37-41`,
  `DisclaimerStamp.tsx:8-30`).
- **Pricing/positioning canonical & consistent** — per-op + bundle prices sourced from
  `registry.ts`/`economy.ts`, identical across landing/FAQ/billing; core offer fully self-serve, no
  contact-sales wall (`registry.ts:37-44`, `economy.ts:43-50`, `billing/page.tsx:24-30, 146-154`).
- **Validation page = real primary sources** with legal basis, dated review, freshness, CI-gated
  (`validation.ts:54-202`, `validation/page.tsx`).
- **Share token leaks nothing private** — name/class/likelihood/statuses only, DB-free,
  pack-validated, honest "Qualifies/In progress" framing (`letters-patent.ts:21-102`,
  `c/[token]/page.tsx:43-137`).
