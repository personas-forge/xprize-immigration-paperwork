# L1 review — Aria Castellanos · product designer / design leader

- **Character:** Aria Castellanos — senior product/UX designer & design leader, O-1A (business) self-petitioner unsure O-1B (arts) fits better
- **Segment:** beneficiary
- **Journeys walked:** qualify-verdict, draft-petition-letter, evaluate-as-prospect, share-verdict
- **Date:** 2026-06-20 · **cert_level:** L1 (theoretical, code-grounded, no browser)
- **Reachability:** All four journeys live on surfaces Aria can actually open — the anonymous hero (`/`), the `/qualify` funnel, her own case (`/dashboard/cases/[id]`, dev-auth `developer@localhost`), the `/visa/O-1A/designer` SEO page, and the DB-less `/c/[token]` share. None of her journeys touch the attorney-gated queue, so the fail-closed RBAC wall is not in scope for her.

---

## Journey 1 — qualify-verdict → **L1-conditional**

**Walkthrough (in-character).** I land on the hero, and the first real decision the tool offers me is exactly the one I came for: `/qualify` leads with "Find my best path · all programs · Compares O-1A · O-1B · EB-1A" (`BestPathFinder.tsx:88-139`), not a forced classification guess. Good — that's the question. I paste my hybrid record and hit "Find my best path." I follow the import chain to see what it actually does, and my heart sinks: `/api/qualify/preview/best-path` runs `recommendBestPath → scoreAllPrograms → mockQualification` — the **deterministic keyword regex**, with no model, even though L2 runs real Claude (`best-path.ts:75-98`; `route.ts:11-18,57-61`). Then the "Recommended path" banner shows me a one-line rationale that is *only* a count: "You clear O-1A on your current evidence (n/8, needs 3)" or "O-1A is your closest path — n/8 today, m more criteria" (`best-path.ts:120-135`). There is **no reasoning** about *why* O-1A vs O-1B. Nowhere does it say "your Webby/Awwwards/press profile is what USCIS literally describes under O-1B arts; O-1A would score the same evidence as business." All three programs share threshold 3 and an identical likelihood formula (`packs.ts:97-142`, `qualification.ts:241-242`), so the "comparison" is a margin sort over keyword hits — and on a tie the recommendation falls to alphabetical (`best-path.ts:115`), which means O-1A. This is precisely the "tool picked a default with no rationale" pattern I distrust, and it's the same confident-but-unreasoned answer ChatGPT already gave me.

Worse for me specifically: the keyword scoring **drops my strongest distinctly-design evidence**. My open-sourced design system adopted by 3 companies matches nothing in O-1B's "Record of major commercial or critical success" (`/box office|sales|streams|gross/`, `packs.ts:122-127`); "Recognition from organizations & experts" likely misses too. So on the very screen that picks my path, the engine that "only understands business evidence" quietly loses my arts-flavored evidence — my exact pet peeve. The authenticated `/qualify` *does* send my full pasted background to the model (`qualification.ts:159-161`) and scores the right pack honestly (None never renders green — `criteria.ts:27-48`), so once I've *committed* a classification the read is real. But the path *choice* happens upstream on the mock, before I commit.

**Verdict:** L1-conditional — it completes (I get a ranked comparison, a verdict, the disclaimer, a clear "what's next"), and the pack model and threshold math are correct, but the two majors (no reasoning for the O-1A-vs-O-1B fork; mock-only scoring drops my arts evidence) sit right on my #1 acceptance criterion.
**Grounding score:** best-path **1/5** (gets my pasted profile text; misses the model, the arts-vs-business reasoning, my off-keyword design evidence, and any threshold/likelihood differentiation between programs). Authenticated `/qualify` is much better: **4/5** (full profile to the model, correct pack, honest statuses, gaps — short only of full per-criterion CV richness, the accepted PN-DRAFT-01 boundary).
**Est. time-saved-if-it-worked:** if best-path actually reasoned the call, it would collapse my two-consultation, $7k–$9k, 6–10-week classification-paralysis into an afternoon — the whole reason I'm here.

## Journey 2 — draft-petition-letter → **L1-conditional**

**Walkthrough.** From a qualified O-1B case I open the Drafting Studio. The machinery is genuinely good: the prompt is framed with my real `classification` (`drafting.ts:177`, threaded from the case at `draftOperation.ts:152`), STRICT RULES forbid inventing awards/numbers/press and fence my data against injection (`drafting.ts:181-192`), exhibit citations are pinned to real on-file ordinals with a hallucinated-citation quarantine (`drafting.ts:593-608`), and every paid generation is scored by a live fabrication/UPL/wrong-code adjudicator I can see the reasons for (`draftOperation.ts:213-229`). Section regenerate now passes the rest of the letter as continuity context (`drafting.ts:222-225`, the shipped G1.1 fix) and merges into my current edits, so I don't lose work. That answers my hardest line — zero fabrication — at the structural level.

Two snags. First, a clarity one that stings *me* more than most: the studio's intro copy is **hardcoded "Draft a full O-1A petition letter"** (`DraftStudio.tsx:374-377`, and the header comment at `:40`) even when my case is O-1B. The prose it generates is correctly O-1B, but the UI literally tells the one user who is terrified of being filed under the wrong classification that she's drafting an O-1A. Second (not a new defect): the draft argues from the per-criterion evidence/rationale captured at qualify time, not my raw CV (`draftOperation.ts:147-161`) — whether "Awwwards Site of the Day" and "design system adopted by 3 companies" survive as named specifics or flatten to "a recognized design award" is the accepted PN-DRAFT-01 boundary (L2 proved specifics survive for a research record; my arts record needs the same live check).

**Verdict:** L1-conditional — structurally sound and citation-disciplined, but the O-1A hardcoded copy is a real clarity/trust nick for this character, and the arts-specifics-survive question is L2's to settle.
**Grounding score:** **3/5** (criteria evidence + rationale + vault exhibits reach the prompt and the right classification frames it; short of the full CV and dependent on the qualify capture for my named arts specifics).
**Est. time-saved-if-it-worked:** a first O-1B draft my attorney red-lines instead of restarts — days of associate drafting compressed to an afternoon, *if* it names my real Webby/Awwwards/adopters.

## Journey 3 — evaluate-as-prospect → **L1-pass**

**Walkthrough.** Cold-read test: is this a credible drafting tool or a law firm cosplay? The positioning is unmistakable and consistent — "work product for your own attorney of record to review and sign... We're a drafting tool, not a law firm — and never legal advice" (`page.tsx:254-255`), the single canonical `DISCLAIMER` (`result.ts:37-41`) rides disclaimer-first on every AI surface, and the `/visa/o-1a/designer` SEO page shows the **real O-1A eight** with a designer-tuned example per criterion (`visa/[classification]/[profession]/page.tsx:156-176`, `professions.ts:78-96`) — not placeholders. The thing I most needed to verify as a skeptic: the packs are *genuinely* different per visa (O-1A 8 / O-1B 6 / EB-1A 10, `packs.ts:90-168`), and the chosen classification threads end-to-end (qualify → criteria UI → draft → share), so I'm not being shown the same eight labels relabeled. The `packFor` O-1A fallback (`packs.ts:223-225`) only fires for unset/garbage input — none of my flows produce that. This is the multi-product core done right.

**Verdict:** L1-pass — positioning, disclaimer consistency, and pack-correctness are all structurally sound; no majors on this surface.
**Grounding score:** n-a (non-AI). **Est. time-saved-if-it-worked:** the "is this real?" decision in ~2 minutes without a sales call.

## Journey 4 — share-verdict → **L1-pass (with one taste flag)**

**Walkthrough.** I mint my result into a `/c/[token]` "Letters Patent." The token carries **only** name/classification/likelihood/per-criterion status — my profile text is explicitly excluded (`letters-patent.ts:9-10,68-77`) — and the page renders from the token alone with no DB (`c/[token]/page.tsx:43-49`), showing my O-1B six as the criteria coat-of-arms with "Informational only · not legal advice" (`:118-130`). A tampered token whose status count doesn't match the live pack is rejected (`:84-102`), so the card can't drift from the real criteria. Privacy and honesty: clean. The one reservation is taste, not data: the "Letters Patent of Extraordinary Ability" / engraved certificate / wax "Qualifies" stamp ceremony reads a little horoscope-y for someone who trusts reasoning over ornament — that's the existing PN-QUAL-01 (G3.1) backlog item seen through a design-leader lens, referenced not re-invented. I could send the link, but the framing fights the credibility I want when it lands in an attorney's inbox.

**Verdict:** L1-pass — privacy-safe, pack-faithful, honestly framed; the ceremony is a documented polish/trust call for L2 to judge.
**Grounding score:** n-a (non-AI, deterministic codec). **Est. time-saved-if-it-worked:** a credible, instantly shareable verdict for an employer/attorney — no DB, no leak.

---

## Findings table

| id | journey | type | severity | dimension | impact (f/r/t) | title | code_check | verdict |
|---|---|---|---|---|---|---|---|---|
| ac-qv-01 | qualify-verdict | quality-gap | **major** | senior-quality | high/high/high | Best-path never REASONS the O-1A-vs-O-1B(arts) fork — only a count line | confirmed-absent | confirmed |
| ac-qv-02 | qualify-verdict | quality-gap | **major** | senior-quality | high/high/med | Best-path is keyword-mock even under Claude — arts evidence (design-system adopters) drops out | confirmed-absent | confirmed |
| ac-draft-01 | draft-petition-letter | confusion | minor | clarity | high/high/med | DraftStudio copy hardcoded "O-1A petition letter" on an O-1B case | present-broken | confirmed |
| ac-draft-02 | draft-petition-letter | quality-gap | minor | senior-quality | med/med/med | Draft argues from per-criterion paraphrases, not full CV (accepted PN-DRAFT-01, arts lens) | by-design | uncertain |
| ac-draft-03 | draft-petition-letter | **strength** | polish | trust | high/high/low | Citation discipline + fabrication/UPL adjudication + None-never-green | by-design | confirmed |
| ac-prospect-01 | evaluate-as-prospect | **strength** | polish | trust | high/high/low | Packs genuinely distinct per visa, end-to-end; /visa/O-1A/designer shows real eight | by-design | confirmed |
| ac-prospect-02 | evaluate-as-prospect | **strength** | polish | trust | high/high/low | Canonical DISCLAIMER on every AI payload; "drafting tool, not a law firm" consistent | by-design | confirmed |
| ac-share-01 | share-verdict | **strength** | polish | trust | med/high/low | Share token profile-free, DB-less, pack-faithful, informational framing | by-design | confirmed |
| ac-share-02 | share-verdict | quality-gap | minor | trust | med/med/med | Certificate ceremony may read horoscope-y to a rigor-focused sharer (PN-QUAL-01 lens) | by-design | uncertain |

**Severity counts:** blocker 0 · major 2 · minor 3 · polish/strength 4.

---

## First-person review — Aria's voice

Here's the thing the score sheet won't say out loud: I came to this product with one question, and it's the only question that matters on my clock — **am I an O-1A business case or an O-1B arts case?** Two lawyers disagreed and charged me $7k and $9k to disagree. I don't need a cheerleader; I need the reasoning, the comparison, the alternative it rejected and *why*. So when the homepage leads with "Find my best path · compares O-1A · O-1B · EB-1A," I actually felt seen for a second. That's the right question on the marquee.

And then I read what's behind the button, and it's a keyword counter wearing a tuxedo. It scores three packs by regex, ranks them by who cleared more boxes against the *same* threshold of three, and hands me a one-liner — "you clear O-1A 4/8, needs 3" — with zero argument for why a designer with a Webby and two Awwwards and press in a design magazine might be the textbook O-1B arts profile USCIS literally describes. It never *reasons*. It never names the trade-off. On a tie it just… picks O-1A, alphabetically. That is the exact coin-flip-with-a-confident-face I got from ChatGPT, except now it's also quietly dropping my open-sourced design system — the thing I'm proudest of — because "adopted by three companies" doesn't contain the word "sales." The one piece of evidence that's distinctly *mine* falls through the regex. That's not a thin-context bug to me; that's the tool confirming my fear that it only understands "business" and will score me in the wrong lane.

Credit where it's due, because I'll change my mind for sound reasoning and I should hold myself to that. Once I *commit* a classification, the real machine is good — better than I expected. The authenticated screening feeds my whole CV to the model, the packs really are six-vs-eight-vs-ten different (not relabeled), nothing I didn't claim turns green, the draft is fenced against inventing an award or a fake adoption number, and there's an adjudicator that scans every draft for fabrication and shows me its reasons. The disclaimer is everywhere and the positioning is honest — a drafting tool, not a firm, my attorney signs. The share card doesn't leak my profile. If I already *knew* I was O-1B, I'd probably draft here and save my associate days. But the one decision I can't make myself — the one I'm paying lawyers to make — is the one the product theatrically pretends to answer and doesn't. And then, on the O-1B case I'd build, the Drafting Studio greets me with "Draft a full **O-1A** petition letter." For *me*, of all people. That's a small bug and a large flinch.

Would I adopt it? For drafting once classified — yes, cautiously, after my attorney blesses one letter. For the decision that brought me here — not yet. It hasn't earned the trust to make the call, and it hasn't shown me the reasoning that would let me trust it making the call. Would I tell a peer? I'd say: "great drafting tool, skip the 'best path' wizard and bring your own answer." That's a real recommendation, but it's not the one this product wants to be.

## What passed (protect these)

- **Genuinely distinct criteria packs, end-to-end.** O-1A 8 / O-1B 6 / EB-1A 10 are real, different sets, and the chosen classification threads cleanly from qualify → criteria → draft → share (`packs.ts:90-168`, `QualifyPanel.tsx:147-153,270-282`). The multi-product core is sound.
- **Citation discipline + live adjudication.** No-fabrication rules, data-vs-instruction fencing, exhibit-ordinal pinning with a hallucination quarantine, and a per-generation fabrication/UPL/wrong-code adjudicator with visible reasons (`drafting.ts:181-192,593-608`, `draftOperation.ts:213-229`).
- **"None" never renders green; threshold math is single-sourced** (`criteria.ts:27-48,84-95`) — honest about my thin criteria (judging, scholarly) instead of flattering me.
- **UPL line is load-bearing and consistent.** One canonical `DISCLAIMER`, disclaimer-first on every AI surface, "drafting tool, not a law firm" on the landing (`result.ts:37-41`, `page.tsx:254-255`).
- **Share is privacy-honest and pack-faithful.** Token carries no profile text, renders DB-less, tamper-checked against the live pack (`letters-patent.ts:68-102`).
- **Authenticated qualify is well-grounded** — full pasted background to the model, correct pack, gaps surfaced (`qualification.ts:120-165`). The grounding problem is isolated to the *best-path* pre-read, not the committed screening.
