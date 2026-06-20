# L1 review — Yuki Tanaka (indie game director, O-1A self-petitioner, path genuinely ambiguous)

- **Character:** yuki-tanaka-gamedev · **Segment:** beneficiary · **Date:** 2026-06-20 · **cert_level:** L1 (theoretical, no browser)
- **Journeys walked:** qualify-verdict, draft-petition-letter, evaluate-as-prospect, share-verdict
- **Surface binding:** `/` (InstantVerdict hero), `/qualify` (BestPathFinder → QualifyPanel), `/pricing`→`/billing`, `/dashboard/cases/[id]`, `/c/[token]`

## Reachable surface set (resolved before judging)

Yuki is a **beneficiary** (`developer@localhost`, the dev-auth synthetic user). Everything in her binding is reachable:
- `/` and `/qualify` are public; the best-path + single-screening funnel needs no auth (`src/app/qualify/page.tsx`, `QualifyEntry.tsx`).
- `/pricing` 301-redirects to `/billing` (`src/app/pricing/page.tsx:7`) — canonical token ledger; reachable.
- `/dashboard/cases/[id]` resolves owner-only via `petitions.resolveCase` (`page.tsx:46`) — she owns the case the qualify flow persists, so reachable; the **sign/file/queue attorney affordances are walled out by `isConfiguredAttorney` fail-closed** (`roles.ts`), which is *by design* and not in Yuki's job (she's not the attorney). Not a finding.
- `/c/[token]` is fully public, DB-free (`src/app/c/[token]/page.tsx:43-46`).

No surface she needs is gated away. The pack live-gating (`livePrograms()` → `["O-1A","O-1B","EB-1A"]`, `jurisdictions.ts:96`) **includes both her candidate paths**, so the O-1A-vs-O-1B comparison she came for is structurally in scope.

---

## Journey 1 — qualify-verdict · **L1-conditional**

**Grounding score: 2/6.** Est. time-saved-if-it-worked: high — replaces the **path-consult spend** ($/several-hundred just to settle O-1A-vs-O-1B) plus the screening; ~minutes vs a firm consult.

**Surface model (real code).** `/` hero `InstantVerdict` (`InstantVerdict.tsx`) defaults `classification="O-1A"` (`:35`) and POSTs `/api/qualify/preview` → `mockQualification` (`preview/route.ts:69`) — keyless keyword mock, **honestly labelled** "instant keyword read" (`InstantVerdict.tsx:273`) and `source:"mock"`. `/qualify` leads with `BestPathFinder` (`QualifyEntry.tsx:18,45`) → POST `/api/qualify/preview/best-path` → `recommendBestPath` (`best-path/route.ts:57`). Picking a program writes a one-shot prefill (`prefill.ts:49`) and mounts `QualifyPanel`, whose **authenticated** `/api/qualify` runs the **real model** (`api/qualify/route.ts:36-83`) and persists a case carrying the chosen `classification` (`:86-102`).

**Grounding audit (best-path AI surface) — 2/6.** The user context that *should* reach a path recommendation: (1) her pasted background — **reaches the scorer but only as keyword regex tests**, not as model reasoning; (2) the O-1A pack; (3) the O-1B pack; (4) the EB-1A pack — all three packs are scored (`scoreAllPrograms`, `best-path.ts:96`) ✓; (5) the *hybrid trade-off* (which evidence argues sciences vs arts) — **never reaches any prompt: there is no prompt**; (6) a model. `recommendBestPath` is **100% deterministic** — `scoreProgram` calls `mockQualification` for every program (`best-path.ts:71-93`) and the route comment is explicit: *"no model"* (`best-path/route.ts:17`). The `source` param defaults `"mock"` and nothing ever overrides it. So the one decision Yuki came for — *which visa* — is answered by keyword counting, not reasoning.

**Walkthrough (in her head).** "Game director, O-1A or O-1B? That's literally my question." I land on `/qualify`, which promises to "score it against every program — O-1A, O-1B, and EB-1A — then recommend the strongest path" (`qualify/page.tsx:30-38`). Good — it *acknowledges* the choice exists. I paste my record (IGF **nomination**, ~250k Steam units, "Overwhelmingly Positive" on 12k reviews, IGN/Polygon, a GDC talk on my procedural-animation tech). The finder ranks three cards and crowns one with a one-line rationale (`RecommendationBanner`, `BestPathFinder.tsx:176-205`). **But the rationale is `rationaleFor` (`best-path.ts:120-135`) — a mechanical "You clear X on your current evidence (n/criteria)."** It never says *why* a game director is O-1A-vs-O-1B, never maps my tech→Original-contribution against my game→Lead-role + commercial-success. It just reports keyword margins.

I simulated the actual mock against my profile (regexes verbatim from `packs.ts`): **O-1A 3/8, EB-1A 3/10, O-1B 1/6** → ranked `EB-1A > O-1A > O-1B`, recommended **EB-1A**. That's three ways wrong for me: (a) it never *names* my real dilemma (O-1A vs O-1B), (b) it scores **O-1B last** even though my game (commercial + critical success, reviews, lead creative role) is arguably my *strongest* O-1B story — because the O-1B regexes miss "Steam/units/Overwhelmingly Positive/IGN/Polygon" (`packs.ts:104-139`), and (c) it steers me to EB-1A purely because the green-card tiebreak floats it on an identical margin (`rankPrograms`, `best-path.ts:105-117`). My **250k-unit commercial-success story matches *nothing* in the O-1A pack** (no "sales/units" keyword anywhere in O-1A — `packs.ts:91-98`), and my IGN/Polygon **press fails the O-1A PRESS regex** unless I happen to type the word "press" (`packs.ts:50`). The IGF *award nomination* fires `AWARDS` on the literal substring "award" (`packs.ts:38`) — a hair from treating a **nomination as a met award**, my #1 pet peeve, though it's the keyword teaser not the real model.

**Mitigation (refuting my own alarm).** The mock is *honestly labelled* a keyword read on the hero (`InstantVerdict.tsx:273`) and "Free · informational" on the finder (`BestPathFinder.tsx:91`), and the **real model runs on the authenticated single-screening** (`api/qualify/route.ts`) once I pick a path — where my full paste IS the prompt (`buildQualifyPrompt`, `qualification.ts:120-165`, grounding 1/1 there). So the *single-classification* screening is well-grounded; what's mock-only and reason-free is the **path-choice** step — exactly the part Yuki's JTBD #1 hinges on. Net: the journey **completes** (I can pick O-1A and get a real, grounded screening), but the best-path is a coin-flip dressed as a recommendation → **L1-conditional**, major.

**Findings:** YT-QV-01 (major), YT-QV-02 (minor, by-design — references OA-QV-02 / lf-qual-02), YT-QV-03 (strength).

---

## Journey 2 — draft-petition-letter · **L1-pass**

**Grounding score: 4/6** (criteria evidence/rationale + vault exhibits + classification + petitioner; not the raw paste — the **accepted G1.3/PN-DRAFT-01** decision). Est. time-saved-if-it-worked: very high — the drafting weeks an arts-and-tech firm bills.

**Surface model.** `DraftStudio` (`DraftStudio.tsx`) → POST `/api/draft` → `draftSpec` (`draftOperation.ts`). DB path loads the case's `classification` + persisted `criteria` (`draftOperation.ts:147-153`) and fuses vault exhibits (`attachExhibits`, `:160-161`). `buildDraftPrompt` (`drafting.ts:174-208`) carries strict citation discipline (rule 1: "do NOT invent awards… argue generally"; rule 4: no case law) and `<<<CASE_DATA>>>` injection-fencing (rule 5). Per-section regenerate now passes the letter's other sections as read-only continuity context (`buildSectionPrompt`, `drafting.ts:222-278`; G1.1 **shipped**), and the client sends its current sections so unsaved edits survive the merge (`DraftStudio.tsx:213`, `pickMergeBase`/`mergeRegeneratedSection`). Live `runAdjudication` scores every paid draft (`draftOperation.ts:213-229`).

**Pack-correctness end-to-end (the protocol's critical check for non-default Characters).** Verified: qualify persists my chosen `classification` → case detail reads `stored.classification` (`page.tsx:78`) → DraftStudio receives it (`QualifyPanel.tsx:280`, `CaseDetailView` prop) → `buildDraftPrompt` uses it → only the **correct pack's** qualifying criteria become sections (`mockDraft`/the prompt's "ONE section for each criterion scored Met/Strong"). Evidence Vault buckets use `criteriaNames(classification)` too (`EvidenceVault.tsx:55`, categorize route reads the case classification, `categorize/route.ts:58-59`). **Yuki's situation is the inverse of the fallback risk:** she *wants* O-1A and the system honors O-1A all the way down — no silent fallback-to-O-1A misfires here because O-1A is genuinely her pick. Her O-1A path maps tech→Original-contribution, IGN/Polygon→Press, sales→(argued via Press/Original-contribution, **not** an O-1A "commercial-success" criterion that doesn't exist) — which is exactly the honest O-1A framing her brief asks for, *provided the live model preserves it* (L2).

**Walkthrough (in her head).** From my O-1A case I hit "Draft the petition" (`DraftStudio.tsx:389`). With an empty vault I get the **"add your CV and evidence first"** nudge (`:378-387`) — honest about thin grounding. The draft argues from the per-criterion evidence/rationale the qualify model captured (not my raw paste), so if the qualify model recorded "IGF nomination / 250k units / IGN+Polygon / GDC talk on procedural animation," the draft inherits those specifics. Citation discipline forbids inventing a sales number or review score, and the **numeric** fabrication gate (`fabricatedSpecifics`, `adjudication-gates.ts:122`) catches a money/percent/year/≥100-int that's in the output but not the input — so a *wrong unit count* or *invented review %* can't ship unflagged.

**The one thing that worries a senior here (an L2 question, not an L1 block):** my #1 pet peeve — IGF **nomination upgraded to a "win"** — is a *qualitative* inflation. The fabrication gate scans **numbers, not the word "won" vs "nominated"** (`specifics`, `:83-93`). So nomination→win rests entirely on (a) the prompt's "do not invent awards" instruction and (b) whether "nomination" survived into the criteria evidence text. That's exactly an L2 grounded-output assertion. Structurally the draft is sound, criterion-mapped, persisted/versioned, disclaimer-stamped → **L1-pass** with a sharp L2 priority.

**Findings:** YT-DR-01 (minor, senior-quality — qualitative-inflation gate gap, L2 priority), YT-DR-02 (strength — pack-correct end-to-end + citation discipline).

---

## Journey 3 — evaluate-as-prospect · **L1-pass**

**Grounding score: n/a** (non-AI). Est. time-saved-if-it-worked: the path-consult spend she'd otherwise pay just to be told "you need a lawyer."

**Surface model.** `/` landing (`app/page.tsx`), `/billing` (canonical pricing, `/pricing`→redirect), `/faq` (`app/faq/page.tsx`), `/validation`. Positioning line is **consistent and unmistakable** across all of them: "a drafting tool, not a law firm," "your own attorney of record reviews and signs," "never legal advice" (landing `page.tsx:254-256,156,373`; FAQ `faq/page.tsx:27,31,43`; pricing copy). The `DISCLAIMER` (`result.ts:37-41`) rides on every AI payload by contract (qualify/draft/rfe/categorize all attach it). Pricing is sourced from canonical `economy.ts` BUNDLES (`page.tsx:13,357`) so landing/billing can't drift. FAQ cites primary sources (8 CFR 214.2(o)(3)(iii), 204.5(h)(3)) and the validation page (`faq/page.tsx:47`).

**Walkthrough (in her head).** Cold from a link, I need to know fast: is this a law firm pretending, or an honest tool? The answer is clear in under a minute — it's a *drafting* tool, *my* attorney signs, not legal advice, and it says so everywhere. The FAQ even names O-1A/**O-1B**/EB-1A and answers RFE/refund/data-security plainly. **The one snag for *me* specifically:** the landing is relentlessly **O-1 / "sciences" framed** — "Your O-1 visa," "the eight O-1 criteria," hero card "O-1A · Sciences," "For founders · engineers · researchers · designers" (`page.tsx:125,133,210,154`). A game director who self-identifies as *arts* could bounce, thinking "this isn't for me." It's mitigated because `/qualify` explicitly compares all three and FAQ names O-1B — but the **first read** under-signals that arts/O-1B is supported. Not a blocker (the product clearly handles arts downstream), a clarity nit. → **L1-pass**.

**Findings:** YT-EP-01 (minor, clarity — landing under-signals O-1B/arts to a creative prospect), YT-EP-02 (strength — positioning + pricing consistency).

---

## Journey 4 — share-verdict · **L1-pass**

**Grounding score: n/a** (non-AI). Est. time-saved-if-it-worked: a credible artifact to send a publisher/attorney, free, no DB.

**Surface model.** `LettersPatentShare` (`LettersPatentShare.tsx`) mints `encodeSnapshot` (`letters-patent.ts:69-77`) → `/c/[token]` (`c/[token]/page.tsx`) + per-result OG image (`opengraph-image.tsx`). The token carries **only** name, classification, likelihood, and per-criterion statuses in pack order — **never the profile text** (`letters-patent.ts:21-29,70-76`; comment `:6`). Decode validates `isLiveProgram` and that the status count matches the pack (`:93-97`) so a tampered token can't render a bogus coat-of-arms. The page renders the **correct pack's** criteria with `statusTone` (`c/[token]/page.tsx:103-104`) — an unscored criterion renders neutral, never green. Framing: "Informational only · not legal advice · no account needed" (`:118-120`) and a "Qualifies / In progress" stamp bound to the real threshold (`:126`).

**Walkthrough (in her head).** A positive O-1A result offers "Share your Letters Patent" → copy-link / LinkedIn (`LettersPatentShare.tsx:46-69`). The card shows my name, my **O-1A** classification, my likelihood, and my criteria — and crucially **nothing I pasted leaks** (no game title, no sales numbers in the URL). Safe to send a publisher. The only thing I'd raise an eyebrow at is the "Certificate of Extraordinary Ability" / award-ceremony skin — for a rigor-minded reader it edges toward theater — but that's **PN-QUAL-01 / lf-share-02**, already a known polish/uncertain item, not new. → **L1-pass**.

**Findings:** YT-SH-01 (strength — privacy-safe, DB-free, pack-faithful, honestly framed).

---

## Findings table

| id | journey | type | severity | dimension | impact (freq/reach/trust) | title | code_check | verdict |
|----|---------|------|----------|-----------|---------------------------|-------|-----------|---------|
| YT-QV-01 | qualify-verdict | quality-gap | **major** | senior-quality | high/high/high | Best-path never *names or reasons* the O-1A-vs-O-1B trade-off for a hybrid creative; keyword mock scores O-1B **worst** and recommends EB-1A — steers an arts-eligible game director away from her real choice | confirmed-absent | confirmed |
| YT-QV-02 | qualify-verdict | quality-gap | minor | trust | med/high/med | Best-path runs the keyword mock with **no model path at all** even in the live env (`source` hardcoded "mock"); all three programs share threshold 3 + flat likelihood — related OA-QV-02, lf-qual-02 | by-design | confirmed |
| YT-QV-03 | qualify-verdict | strength | polish | trust | — | Hero + finder are **honestly labelled** keyword reads; the real model runs on the authenticated single-screening where her full paste IS the prompt | by-design | confirmed |
| YT-DR-01 | draft-petition-letter | quality-gap | minor | trust | med/med/high | Fabrication gate scans **numbers only** — a *qualitative* inflation (IGF **nomination → "win"**, her #1 peeve) is not caught by `fabricatedSpecifics`; rests on prompt discipline + the captured evidence text | present-but-missed | confirmed |
| YT-DR-02 | draft-petition-letter | strength | polish | senior-quality | — | Classification flows **pack-correct end-to-end** (qualify→case→criteria UI→draft→vault buckets); strict citation discipline + injection-fencing + exhibit audit | by-design | confirmed |
| YT-EP-01 | evaluate-as-prospect | confusion | minor | clarity | med/high/low | Landing `/` is relentlessly **O-1/"sciences"** framed (hero, card "O-1A · Sciences", "founders·engineers·researchers·designers") — under-signals arts/O-1B to a creative prospect on first read | confirmed-absent | confirmed |
| YT-EP-02 | evaluate-as-prospect | strength | polish | trust | — | Positioning ("drafting tool, not a law firm" / own attorney signs / not legal advice) consistent across landing/FAQ/billing; pricing canonical (can't drift); FAQ names O-1B + cites primary sources | by-design | confirmed |
| YT-SH-01 | share-verdict | strength | polish | trust | — | Share token carries **no profile text**, DB-free, validates pack/status count, renders correct pack with neutral-for-unscored, framed informational | by-design | confirmed |

---

## First-person review (Yuki's voice)

I came in with one honest question: am I "sciences" or "arts"? Overwhelmingly Positive on 12k reviews, 250k units, an IGF nomination, IGN and Polygon, a GDC talk on tech I actually built — half of that screams O-1A original-contribution, the other half screams O-1B arts. I was told different things by different people. I wanted the tool to *reason the path*. And the funnel **says** it will — "score it against O-1A, O-1B, and EB-1A, then recommend the strongest path." That line is the whole reason I'd pay.

Then it… counts keywords. It doesn't tell me *why* a game director is the borderline case I know I am. It hands me a one-liner — "you clear X, needs 3" — and, on my real words, it ranks **O-1B dead last** and pushes me to **EB-1A**. That's backwards. My commercial-and-critical success — the single most O-1B-shaped thing about me — is invisible to it because "Steam," "units," and "Overwhelmingly Positive" aren't in its word list, and my Steam sales don't even register on the O-1A side. If I'd trusted that card, I'd have walked into a consult convinced of the wrong visa. A senior arts-and-tech drafter who'd done game cases would *open* with the O-1A-vs-O-1B trade-off and reason it from my evidence; this opens by hiding it behind a keyword tally. That's the gap between "informational read" and "the path answer I came for."

What saves it from a fail: once I *pick* O-1A myself, the rest is genuinely good. The real screening reads my whole record, the draft is correctly O-1A all the way down — buckets, criteria, sections, exhibits — with hard rules against inventing my numbers, and a live gate that won't let a fabricated unit-count or review-% ship. The honesty everywhere else is real: it's a drafting tool, *my* lawyer signs, it says so on every screen, and my share card doesn't leak a single thing I didn't choose. My one quiet worry on the draft is the thing I'd fire a drafter over — calling my IGF *nomination* a *win* — and the number-scanner won't catch that word swap; I'd want to see the live draft keep "nominated." 

Would I adopt it? For the **drafting**, yes — it'd save me the weeks. For the **path decision I actually arrived for**, not yet — and that's the more valuable thing it advertises. Fix best-path so it *reasons* O-1A-vs-O-1B from a hybrid record (and stops burying O-1B), and I'd tell every indie dev I know.

## What passed (protect these)

- **Pack-correctness is airtight end-to-end** for a chosen classification — qualify→case→criteria UI→draft→evidence buckets→share all read the case's real pack (`packs.ts`, `EvidenceVault.tsx:55`, `draftOperation.ts:147-161`, `letters-patent.ts:95-97`). No fallback-to-O-1A misfire on her path.
- **Citation discipline + injection-fencing + exhibit audit** on the draft (`drafting.ts:160-208`, `auditCitations`) and the **numeric** fabrication gate (`adjudication-gates.ts:122`).
- **Honest mock labelling** — keyword reads are flagged as such; the real model is gated to the authenticated path (`InstantVerdict.tsx:273`, `preview/route.ts:17`).
- **Positioning + pricing consistency** (landing/FAQ/billing) and the FAQ naming O-1B + citing primary sources.
- **Privacy-safe, DB-free share** — token carries only postable statuses, validates the pack, never the profile (`letters-patent.ts:21-29,93-97`).
