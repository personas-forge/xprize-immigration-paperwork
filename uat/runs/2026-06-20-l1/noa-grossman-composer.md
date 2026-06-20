# L1 review — Noa Grossman, behind-the-scenes composer (O-1B arts)

- **Character:** noa-grossman-composer · **Segment:** beneficiary
- **Journeys walked:** qualify-verdict, draft-petition-letter, organize-evidence, track-case-progress
- **Date:** 2026-06-20 · **cert_level:** L1 (theoretical, code-grounded, no browser)

> The thing I came in afraid of is real, and it lives in the code: every example the
> tool's *keyword* engine reaches for under "lead role in distinguished productions" is an
> on-camera star — `lead role|leading role|starring|principal|headlin|featured performer`.
> I composed the original score. I'm a principal creative lead, and that regex never
> sees me. Whether the *real* model reads me correctly is the whole ballgame, and L1 can't
> press play.

---

## Surface model & reachability (resolved before judging)

Reachable set for `developer@localhost` (dev-auth synthetic user, store configured):
`/` (InstantVerdict), `/qualify` (BestPathFinder → QualifyPanel), `/dashboard`,
`/dashboard/cases/[id]` (criteria · EvidenceVault · DraftStudio · Roadmap · ReviewPanel),
`/c/[token]` (share). RfeStudio is gated to `status === "Filed"` (`CaseDetailView.tsx:224`)
and the review **queue**/sign-file is `isConfiguredAttorney` fail-closed — both out of Noa's
beneficiary scope and out of his journeys; not judged here.

**Classification routing — the make-or-break for an arts Character — is sound end-to-end.**
- The hero "Visa type" select is populated from `livePrograms()` and includes O-1B
  (`InstantVerdict.tsx:24,125`); selection flows to `/api/qualify/preview` and into the
  certificate header (`InstantVerdict.tsx:194,241`).
- "Go deeper" stashes `{name,profile,classification}` (`prefill.ts:49`) and `QualifyPanel`
  rehydrates it on mount, restoring O-1B (`QualifyPanel.tsx:55-66`).
- `/api/qualify` persists the case with `req.classification` (`api/qualify/route.ts:97-99`);
  `parseQualifyRequest` only down-falls to O-1A for a *non-live* code (`qualification.ts:108`),
  and O-1B IS live (`jurisdictions.ts:63`), so no silent O-1A fallback for Noa.
- Pack selection is correct: `packFor("O-1B")` → the **arts six** (`packs.ts:99-141`); the
  prompt lists those exact six names (`qualification.ts:140-141`); the report threshold is the
  pack's own (`InstantVerdict.tsx:198`, `QualifyPanel.tsx:270`). Case detail header, EvidenceVault
  buckets, DraftStudio, and the `/c/[token]` certificate all read `classification` dynamically
  (`CaseDetailView.tsx:144,193,202`; `EvidenceVault.tsx:55`; `c/[token]/page.tsx:48,103`).

**Acceptance criterion #2 (genuine O-1B six, not O-1A eight relabeled) PASSES in code** — no
"scholarly articles"/"patent" ever renders on an O-1B screen. The `packFor` fallback-to-O-1A
trap the protocol warns about is **not** triggered for Noa.

---

## Journey 1 — qualify-verdict · **L1-conditional**

**Walkthrough (in character).** I land on `/qualify`, which leads with "Find my best path"
(`QualifyEntry.tsx:43`). I paste my record — original score for a guild-award series, a
festival-music-prize feature, a game soundtrack past 40M Spotify streams, SCL + ASCAP, a trade
interview — and the finder scores me against O-1A/O-1B/EB-1A in one keyless pass
(`BestPathFinder.tsx:54` → `best-path.ts:96` → `scoreAllPrograms` over `mockQualification`). I
pick O-1B and continue into the full screening, which (authenticated) runs the **real Claude**
model with my full pasted profile in the prompt (`api/qualify/route.ts:54`,
`qualification.ts:159-163`). The verdict renders the six O-1B criteria with my evidence and a gap
list, disclaimer first (`CriteriaReport.tsx:48`), and offers "Open case file".

**The structural defect I feared, made concrete.** Both the hero preview AND the best-path finder
are the **deterministic keyword mock** (`api/qualify/preview/route.ts:69`,
`api/qualify/preview/best-path/route.ts:57`). In that mock, "Lead role in distinguished
productions" only fires on `lead role|leading role|starring|principal|headlin|featured performer`
(`packs.ts:106`). "Composed the original score for [a distinguished production]" matches **none**
of those — so my single most distinctive, criterion-defining strength reads **None** in every
no-signup surface a music supervisor or I would first try. My streams/sales land correctly under
commercial success (`packs.ts:124` matches `streams|sales`), my guild/society under org-expert
recognition (`packs.ts:130` matches `guild|society`), my trade feature under reviews & press
(`packs.ts:118` matches `featured`) — so 4 of 6 read right, but the one that *makes me an O-1B
case* is blank. This is exactly my colleague's stumble ("contributing music" vs lead role),
reproduced by the engine.

The authenticated `/qualify` path uses the real model, whose prompt is well-grounded (full
profile) and instructs scoring per-criterion — so it *may* read composer-as-lead correctly. But
the prompt gives the model **zero domain hint** that a behind-the-scenes creator (composer,
cinematographer, editor) can hold a "lead role" (`qualification.ts:120-165`); it relies entirely
on the model's own knowledge. L1 can't confirm the live read — that's the load-bearing L2 check.

**Grounding audit — qualify:** sources the output *should* use = {pasted profile, criteria pack,
prior evidence vault, prior case facts, best-path cross-program context, behind-the-scenes-role
domain guidance}. Reaching the prompt: pasted profile ✔, criteria pack ✔ (names only). Not
reaching: vault ✖ (doesn't exist yet — by design), case facts ✖ (n/a at screen time), explicit
behind-the-scenes-lead guidance ✖. **grounding 2/4** of the in-scope sources (profile + pack);
the keyless preview/best-path surfaces are weaker still — keyword-only, no model reasoning.

**est. time-saved-if-it-worked:** if the live model reads composer-as-lead and maps my numbers,
~5 min to a correctly-framed verdict vs a firm's intake — strongly positive. If it leaves lead
role blank, it saves me nothing on my hardest argument; I'd re-argue the whole criterion.

---

## Journey 2 — draft-petition-letter · **L1-conditional**

**Walkthrough.** From my O-1B case I hit "Draft the petition" (`DraftStudio.tsx:389`). The DB path
loads my persisted O-1B criteria (`draftOperation.ts:147`) and fuses my vault exhibits
(`draftOperation.ts:160-161` → `attachExhibits`), so the prompt argues from my real evidence with
strict citation discipline and an "(Exhibit N)" audit (`drafting.ts:174-208`, `auditCitations`).
Per-section regenerate now passes the rest of the letter as read-only continuity context
(`drafting.ts:222-278`, the shipped G1.1 fix) and merges into my current sections preserving
unsaved edits (`draftOperation.ts:254`). Versions persist and re-hydrate (`CaseDetailView.tsx:89`,
`getLatestDraft`). The disclaimer rides every payload (`buildDraftResult` → `drafting.ts:694`).

**Two findings.**
1. **The draft only writes a section per *qualifying* (Met/Strong) criterion** (`drafting.ts:204`,
   `mockDraft` line 665). If my "Lead role" came back None from the screener (Journey 1 risk), the
   letter has **no Lead Role section at all** — my strongest argument is silently dropped, not
   merely thin. The draft faithfully argues whatever it's handed; it inherits the upstream
   composer-blindspot. This is downstream of J1 but worth a finding because the *omission is
   invisible* — there's no "you have a strong record here that didn't score" nudge.
2. **DraftStudio tells me I'm drafting an "O-1A petition letter"** — hardcoded copy at
   `DraftStudio.tsx:374` (and the heading/intent comment line 40) — even though my case, the
   prompt, the exhibit index, and every other label are correctly O-1B. For a Character whose
   entire anxiety is being mis-classified, being told "O-1A" on my own O-1B draft screen is a
   trust paper-cut. Cosmetic, but it lands on the exact nerve.

**Grounding audit — draft (case path):** {persisted criteria ✔, evidence/rationale ✔, vault
exhibits ✔, other sections on regenerate ✔, full CV text ✖ (per PN-DRAFT-01, accepted — the
qualify model already captured my specifics into the persisted criteria)}. **grounding 4/5** —
genuinely strong machinery, well fed *on the case path*.

**est. time-saved-if-it-worked:** a criterion-mapped, exhibit-citing draft in an afternoon vs
$8k–$10k / 8–10 weeks — the headline win, *conditional on* lead role being scored so it earns a
section. L2 must read the live prose: does it call me a "principal creative lead" or downgrade me
to "providing music"?

---

## Journey 3 — organize-evidence · **L1-pass**

**Walkthrough.** In the Evidence Vault I paste my cue sheets, guild card, a Spotify dashboard, the
trade feature. Categorization follows my case classification — `buildCategorizePrompt(req,
classification, existingBuckets)` lists the **O-1B six** buckets (`evidence.ts:106-143`), the
whole-vault summary is fused for sibling consistency (the shipped G2.1 context,
`categorize/route.ts:64-74`), and `summarizeVault(documents, classification)` derives gaps against
the O-1B six (`evidence.ts:226`). Buckets, refile options, and coverage all read `classification`
dynamically (`EvidenceVault.tsx:55-56`). Exhibit numbers are monotonic on insert and never reused
(`lib/data/evidence.ts:9,28-39`). The coverage framing is honest — "documents present, not a
criterion proven" (`EvidenceVault.tsx:212-216`), which directly answers the dc-evidence-02 worry.

**One mock-only nit (not a defect on the live path).** The keyless `mockCategorize` uses
first-keyword-wins `.find()` over the pack (`evidence.ts:190`), and the O-1B order tests
recognition/press *before* commercial success — so a "40M streams, featured in [outlet]" doc could
bucket as press/recognition before commercial success if an earlier keyword hits first. The real
model path is the actual categorizer (`tryParseCategorizeResponse` first; mock only on failure),
and the whole-vault context further stabilizes it. I can also manually refile. Flagging as a
mock-path clarity nit, suppressing the known PN-EVID-01/G2.1 (already addressed) framing.

**Grounding audit — categorize:** {document text ✔, criteria pack ✔, existing buckets ✔}.
**grounding 3/3** — fully fed.

**est. time-saved-if-it-worked:** a filable exhibit index with honest gaps in minutes vs a
paralegal afternoon — clean win.

---

## Journey 4 — track-case-progress · **L1-pass**

**Walkthrough.** `/dashboard` lists my real cases above the mock demo whenever I have them
(`dashboard/page.tsx:30-38`); the case detail shows status + a roadmap stepper derived from real
state — `caseRoadmap(status, {hasEvidence, hasDraft})` (`roadmap.ts:38`, fed
`documents.length > 0` and a real draft at `CaseDetailView.tsx:133-137`). Qualified → Evidence →
Drafted → Review → Filed → Decision advances as I actually add evidence / draft / submit. The deep
link "Open case file" works (`QualifyPanel.tsx:287`). I'm never stranded — there's always a current
stage and a next action. The roadmap is classification-agnostic (same lifecycle for O-1B), which is
correct, and the disclaimer rides every AI surface upstream. No findings; this clears my bar.

**Grounding audit — roadmap:** non-AI surface; derives from real persisted state. n/a.

**est. time-saved-if-it-worked:** orientation/status I'd otherwise chase a firm for over email —
modest but real, and it removes "what now?" anxiety.

---

## Findings table

| id | journey | type | severity | dimension | impact (f/r/t) | title | code_check | verdict |
|----|---------|------|----------|-----------|----------------|-------|------------|---------|
| ng-qual-01 | qualify-verdict | quality-gap | major | senior-quality | high/high/high | Keyless "lead role" matcher only recognizes on-camera/starring talent; composer-as-lead reads None on every no-signup surface | confirmed-absent (no behind-scenes keyword/hint) | confirmed |
| ng-qual-02 | qualify-verdict | missing-feature | minor | trust | med/high/med | Qualify prompt gives the model no domain hint that a behind-the-scenes artist holds a "lead role"; live read unverifiable at L1 | present-but-thin | uncertain (L2) |
| ng-draft-01 | draft-petition-letter | broken-flow | major | missing | med/high/high | Draft writes a section only per Met/Strong criterion; an unscored lead role is silently omitted with no "strong-but-unscored" nudge | confirmed-absent | confirmed |
| ng-draft-02 | draft-petition-letter | confusion | minor | trust | high/high/low | DraftStudio hardcodes "Draft a full O-1A petition letter" on an O-1B case | present-broken | confirmed |
| ng-evid-01 | organize-evidence | confusion | minor | clarity | low/med/low | Mock categorizer is first-keyword-wins; a streams+press doc may mis-bucket on the keyless path (model path unaffected) | by-design (mock) | confirmed |
| ng-qual-03 | qualify-verdict | strength | polish | trust | — | O-1B classification routes correctly end-to-end (pack, threshold, buckets, draft, share); no silent O-1A fallback | by-design | confirmed |
| ng-evid-02 | organize-evidence | strength | polish | trust | — | Honest coverage framing ("documents present, not criterion proven") + monotonic exhibits | by-design | confirmed |

---

## First-person review (Noa's voice)

I'll be honest: I opened this braced to be misread, and the build half-earned my trust and half
confirmed my fear. The *plumbing* is right in a way that mattered to me — I picked O-1B and the
whole machine stayed O-1B: the arts six, not the sciences eight wearing an arts label; my streams
and game sales landed under commercial success; my SCL and ASCAP under recognition from
organizations and experts; my trade interview under reviews and press; my shareable certificate
showed the right six. Nobody quietly shoved me back into the O-1A box. That's not nothing — it's
the floor a specialist associate clears, and the tool cleared it.

But the floor isn't the ceiling, and my whole case lives on one line: *the composer is a principal
creative lead on a distinguished production*. The keyword engine that powers every free, no-signup
read — the hero, the best-path finder, the thing a music supervisor would click first — only knows
"lead role" as someone *starring* or *headlining*. It literally cannot see a composer. So the first
verdict the world sees of me leaves my strongest criterion blank, and then the draft, which only
writes a section for criteria that scored, would hand my attorney a letter with no lead-role
argument at all — and never tell me it dropped it. That's the exact failure that cost my colleague
an RFE. The real model behind the paywall might read me correctly — the prompt does get my full
words — but it's flying on its own knowledge, with nothing in the instructions saying "a
behind-the-scenes artist can hold a lead role," and I can't see the live answer from here.

Would I adopt it? Conditionally, leaning yes — *if* the live model reads composer-as-lead, this
saves me $8k and two months and drafts in an afternoon. If it can't, it's worse than useless on my
hardest argument, because it'll look confident while leaving me blank. And being told I'm drafting
an "O-1A petition letter" on my own O-1B screen is a small thing that hits exactly where I'm
tender. I'd tell a composer peer: "the bones are right, but make it actually run the real model and
read your verdict for the words 'lead role' before you trust it with your strongest credit."

---

## What passed (protect these)

- **Classification integrity end-to-end** for O-1B — pack, threshold, buckets, draft prompt,
  exhibit index, share certificate all dynamic; no `packFor` fallback-to-O-1A trap for a live
  program (`packs.ts:99-141,223-225`; `jurisdictions.ts:63,101`).
- **Strong draft grounding on the case path** — persisted criteria + vault exhibits + section
  continuity + citation audit, with reclaim-to-mock honesty (`draftOperation.ts:147-161`;
  `drafting.ts:593-608`).
- **Honest evidence coverage read** — "documents present ≠ criterion proven", monotonic
  never-reused exhibits, gaps against the real pack (`EvidenceVault.tsx:212-216`;
  `lib/data/evidence.ts:9`).
- **Disclaimer rides every AI payload**; roadmap derives from real state with an always-present
  next action (`result.ts:37`; `roadmap.ts:38`).
- **Real-state dashboard** lists the user's own cases above the mock demo
  (`dashboard/page.tsx:30-38`).
