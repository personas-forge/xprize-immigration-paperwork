# L1 report — Sofia Iglesias (independent non-attorney immigration consultant)

- **Character:** sofia-iglesias-consultant · **segment:** prospect-buyer (UPL-sensitive intermediary)
- **Journeys walked:** evaluate-as-prospect, qualify-verdict
- **Date:** 2026-06-20 · **cert_level:** L1 (theoretical, code-grounded, no browser)
- **Reachability:** Both journeys sit on fully PUBLIC surfaces (`/`, `/qualify`, `/faq`, `/validation`,
  `/billing`, `/pricing`, `/landing-claude`, `/c/[token]`) and the dev-auth `developer@localhost` user.
  Nothing Sofia needs is behind the attorney `isConfiguredAttorney` wall. No `unreachable` tags apply.

---

## Surface model (built from code, import chain followed)

**Hero / anonymous client-facing verdict (the load-bearing UPL surface):**
`/` (`src/app/page.tsx:14,98`) → `InstantVerdict` (`InstantVerdict.tsx`) → `POST /api/qualify/preview`
(`src/app/api/qualify/preview/route.ts`) → `parseQualifyRequest` → `mockQualification` →
`buildQualifyResult(assessment, "mock")` (attaches `DISCLAIMER`, `qualification.ts:251`) → rendered by
`CriteriaReport` (`CriteriaReport.tsx:48` renders `DisclaimerStamp text={result.disclaimer}` FIRST).
The preview is **deterministic mock only** — no model, no charge, no DB, no PII leak (route comment + body).

**Authenticated screening (the deeper read):**
`/qualify` (`src/app/qualify/page.tsx`) → `QualifyEntry` → `QualifyPanel` / `BestPathFinder` →
`POST /api/qualify` (`src/app/api/qualify/route.ts`) via `executeAiOperation` →
`buildQualifyPrompt(req)` (`qualification.ts:120`, fed the user's FULL pasted `req.profile`) →
real Claude (`LLM_ENGINE=claude`) or mock → `parseQualifyResponse` → `buildQualifyResult` +
`runAdjudication` (`adjudication-gates.ts:294`) → `CriteriaReport` + `AdjudicationBadge`.

**Shared certificate:** `/c/[token]` (`src/app/c/[token]/page.tsx`) decodes a `letters-patent.ts` token
that carries ONLY name/classification/likelihood/per-criterion status — **never the profile text**
(`letters-patent.ts:21-29,69-77`).

### Grounding audit — qualify AI surface (the only AI surface in scope)
Sources a screening output *should* use, and whether they reach the prompt (`buildQualifyPrompt`):

| Source the output should use | Reaches the prompt? | Evidence |
|---|---|---|
| User's full pasted free-text background/CV | **Yes** (verbatim, not a thin summary) | `qualification.ts:159-161` |
| The selected visa's criteria pack (names) | **Yes** | `qualification.ts:121,140-141` |
| The selected classification | **Yes** (`packFor(req.classification)`) | `qualification.ts:121` |
| Applicant name | **Yes** | `qualification.ts:159` |
| Qualifying threshold (3-of-N) | **Deliberately not in prompt** — applied as deterministic post-hoc math by `summarizeCriteria`, not model-judged | `CriteriaReport.tsx:40`, `case-file/criteria.ts:101` |

**Grounding = 4/4 applicable sources** (the 5th, threshold, is by-design deterministic, not a gap — it's a
strength: the qualify/no-qualify line is never the model's to declare). The qualify machinery is fed the
user's *real* words, not sample data. L2 should still confirm the live Claude output actually *names* the
pasted specifics, but the wiring is correct.

---

## Journey 1 — evaluate-as-prospect → **L1-pass**

**Walkthrough (in Sofia's head):** I arrive cold and go straight for the line that protects *me*. The
landing hero says it plainly: "We're a drafting tool, not a law firm — and never legal advice"
(`page.tsx:255`), "work product, ready for *your* attorney of record to review and sign … informational
drafting, never legal advice" (`page.tsx:156`). The FAQ answers my exact objections head-on — "Is any of
this legal advice? No … we are not a law firm. Every AI output carries that disclaimer, and an attorney of
record must review and sign" (`faq/page.tsx:42-43`) and a dedicated "Who reviews and signs" entry
(`faq/page.tsx:30-31`). `/billing` keeps the same footnote (`billing/page.tsx:163-164`), `/pricing`
permanently redirects to `/billing` (`pricing/page.tsx:8`) — no drift, and I note the consistency
approvingly. The alt masthead carries the identical line in its footer: "not a law firm, never legal
advice" (`landing-claude/page.tsx:201,154`). The validation page is the clincher: it cites **8 CFR
214.2(o)(3)(iii)** as the O-1A legal basis, the **USCIS Policy Manual Vol. 2 Part M Ch. 4**, the **3-of-8
threshold**, a last-reviewed date and a freshness countdown, and an honest **"Counsel pending"** badge
(`validation.ts:55-78`, `validation/page.tsx:203-204`) — real evidence with live primary-source links, not
adjectives. This is substance I could defend to a regulator.

**Findings:** one minor (SI-EVAL-01, the `/c/[token]` "Qualifies" stamp is more declarative than the rest
of the hedged language), one polish (SI-EVAL-02, the hero sample card's decorative "Approved" stamp). No
majors. **Grounding:** n/a (non-AI marketing journey). **Est. time-saved-if-it-worked:** the positioning
lets a client get an honest free screen in minutes instead of a $300–$600 firm consult — and, critically,
lets *me* place it in my workflow without raising my UPL exposure.

## Journey 2 — qualify-verdict → **L1-pass (with one minor)**

**Walkthrough:** I run a real client through the screener. The output is *informational and hedged*: the
result header reads "{N} of {M} criteria **supported** — need {threshold} to qualify" and a
"**Meets threshold** / **Below threshold**" badge (`CriteriaReport.tsx:58-60,85-86`) — never "you qualify"
or "criteria met". An unscored ("None") criterion never renders green (`CriteriaReport.tsx:20-26`, reuses
the case-file eligibility math). The **`DISCLAIMER` rides on the live AI payload** — `DisclaimerStamp`
renders FIRST in `CriteriaReport` (`:47-48`), and it's the same `result.disclaimer` the anonymous preview
attaches via `buildQualifyResult` (`qualification.ts:251-255`). So the disclaimer is on the actual output a
client sees, not just marketing — my single most important check, and it passes by construction.

Two things genuinely reassured me beyond what I expected. First, a **live UPL tripwire**: every
authenticated screening is scored by `runAdjudication`, whose `legalAdviceGate` FAILS the output on advice/
outcome language — "you will qualify", "you should file", "I recommend you", "your best option is"
(`adjudication-gates.ts:135-142,236-241`) — and whose `disclaimerGate` FAILS if the DISCLAIMER is missing
or even altered (`:204-209`). A failure flips the visible "Attorney-ready" badge to "Not attorney-ready"
(`AdjudicationBadge.tsx:19-23`). That is machinery built around exactly my fear. Second, the best-path
comparison is framed as an *informational comparison* — "Recommended path", "You clear X on your current
evidence", "X is your closest path" (`best-path.ts:120-135`) with the `DISCLAIMER` attached
(`best-path.ts:149-152`) and the page copy "general information to help you screen yourself; it is never
legal advice, and an attorney of record reviews everything" (`qualify/page.tsx:36-37`). It compares; it
doesn't tell my client which form to file as advice.

The one wrinkle: the **anonymous preview** path a prospect/client hits with no signup does NOT run the live
adjudication tripwire (`/api/qualify/preview/route.ts` — deterministic mock, no `runAdjudication`). That's
defensible — the mock can't drift into advice language (its rationale strings are fixed,
`qualification.ts:225-238`) and it still attaches the disclaimer — so the free read is safe *by
construction*, just not by the same runtime guard. I record it as clarity, not a defect.

**Findings:** SI-QUAL-01 (minor · the `/c/[token]` "Qualifies" stamp), SI-QUAL-02 (minor/clarity · the
anonymous preview path is unguarded by the live UPL tripwire — safe-by-construction, flagged for L2 to
confirm the mock can never emit advice copy). **Grounding:** 4/4 applicable. **Est. time-saved-if-it-worked:**
a $300–$600 consult collapsed to a free, minutes-long, hedged read I can stand behind.

---

## Findings table

| id | journey | type | severity | dimension | impact (freq/reach/trust) | title | code_check | verdict |
|---|---|---|---|---|---|---|---|---|
| SI-QUAL-01 | qualify-verdict | trust | minor | trust | med/high/low | `/c/[token]` "Qualifies" stamp is declarative vs the hedged in-app language | present-broken | confirmed |
| SI-QUAL-02 | qualify-verdict | trust | minor | trust | high/high/low | Anonymous preview path runs no live UPL adjudication tripwire (safe-by-construction via fixed mock) | by-design | uncertain |
| SI-EVAL-01 | evaluate-as-prospect | trust | minor | trust | med/high/low | Shared certificate `/c/[token]` shows only a microprint disclaimer line, not the full `DisclaimerStamp` | confirmed-absent | confirmed |
| SI-EVAL-02 | evaluate-as-prospect | trust | polish | trust | low/high/low | Hero sample card's decorative "Approved" stamp on a fictional I-129 | by-design | refuted |
| SI-STR-01 | qualify-verdict | strength | polish | trust | — | DISCLAIMER rides on the live AI payload via single `buildQualifyResult` chokepoint + a runtime `disclaimerGate` that fails on any alteration | present-broken (verified present) | confirmed |
| SI-STR-02 | qualify-verdict | strength | polish | trust | — | Live `legalAdviceGate` UPL tripwire fails the output on "you will qualify"/"you should file"/"I recommend you" | by-design | confirmed |
| SI-STR-03 | evaluate-as-prospect | strength | polish | trust | — | Validation page cites 8 CFR 214.2(o)(3)(iii) + USCIS PM Vol.2 Part M, 3-of-8 threshold, review dates, honest "Counsel pending" | by-design | confirmed |
| SI-STR-04 | qualify-verdict | strength | polish | trust | — | Share token carries no profile text (only name/class/likelihood/statuses) — no client PII in the URL | by-design | confirmed |

---

## First-person review — Sofia's felt verdict

I came in expecting to walk. I have watched colleagues lose their bond over half a step across this line, and
I do not have a bar card to absorb a mistake. So I went straight for the one thing marketing pages almost
always fudge: **is the not-legal-advice disclaimer on the actual output a client would see, or only on the
homepage?** Here it is on the payload — `CriteriaReport` stamps it first, every time, from the same factory
that builds the result, and there is a *runtime gate that fails the whole thing if anyone weakens the
wording*. I did not expect to find a compliance tripwire that bans the exact phrases I'm forbidden to say —
"you will qualify," "you should file," "I recommend you" — but it's there in the live path. The verdict
language informs ("criteria supported," "meets threshold"), it does not determine. The validation page cites
the regulation and the Policy Manual with dates and a candid "counsel pending," not vibes. "Who signs" is
unmistakable across landing, FAQ, billing, and the alt masthead — the client's *own* attorney of record, and
the tool never pretends to be the lawyer. The share certificate carries no client PII in the URL.

What I'd still want fixed before I put it in front of a client, and what L2 must confirm: the shared
`/c/[token]` certificate stamps "**Qualifies**" when the threshold is met — that's the one word in the whole
product that *declares* rather than *informs*, and it's on the surface most likely to be forwarded and
screenshotted. Soften it to "Criteria supported" / "Meets threshold," and give it the full disclaimer stamp
(today it carries only a one-line "informational only · not legal advice" microprint, `c/[token]:118-120`).
And the free hero read — the one a client touches first — relies on the fixed mock rather than the live UPL
gate; that's safe today, but I'd want L2 to prove the mock can never drift.

Net: this is the first tool of its kind I would actually consider adopting. It protects the *intermediary*,
not just the company. **I'd tell a peer to look at it — with the one caveat about the "Qualifies" stamp.**

## What passed (strengths worth protecting — do not touch)

- **DISCLAIMER on the live AI payload, enforced two ways:** one `buildQualifyResult` chokepoint attaches it
  (`qualification.ts:251-255`); `DisclaimerStamp` renders it first (`CriteriaReport.tsx:47-48`); and
  `disclaimerGate` fails any output where it's missing or altered (`adjudication-gates.ts:204-209`). This is
  the load-bearing AC#2 and it is airtight.
- **Live UPL tripwire** — `legalAdviceGate` + `ADVICE_PATTERNS` ban advice/outcome language at runtime
  (`adjudication-gates.ts:135-142,236-241`), surfaced as an "Attorney-ready / Not attorney-ready" badge.
- **Hedged, informational verdict** — "criteria supported," "Meets/Below threshold," no "you qualify"/"met"
  anywhere (`CriteriaReport.tsx:58-86`; grep confirmed no declarative strings in output paths).
- **"Who signs" is consistent and unmistakable** across `/`, `/faq`, `/billing`, `/landing-claude`, with
  `/pricing` redirecting to `/billing` (no drift).
- **Validation page = real evidence** — primary-source citations, threshold, dates, "Counsel pending"
  honesty (`validation.ts:55-126`, `validation/page.tsx`).
- **Share token leaks no client PII** — name/class/likelihood/statuses only, never the profile text
  (`letters-patent.ts:21-29`).
- **Best-path = informational comparison**, attorney owns the legal judgment, disclaimer attached
  (`best-path.ts:120-152`) — it does not "tell the client which visa to file" as advice.
