# L1 review — Gloria Mendez (high-volume paralegal / RFE factory)

- **Character:** gloria-mendez-paralegal · **segment:** operator
- **Journeys walked:** draft-petition-letter, organize-evidence, respond-to-rfe, track-case-progress, qualify-verdict
- **Date:** 2026-06-20 · **cert_level:** L1 (theoretical, code-grounded, no browser)
- **Reachability resolved BEFORE judging:** as `developer@localhost` Gloria *owns* the cases she
  creates via `/qualify`, so the OWNER-gated surfaces are reachable — `/dashboard`,
  `/dashboard/cases/[id]` (EvidenceVault, DraftStudio, RfeStudio-when-Filed, Roadmap, Case
  portfolio list), `/qualify`. The review **queue** (`/dashboard/review`) and the **sign/file**
  actions inside `ReviewPanel` gate on `isConfiguredAttorney` (fail-closed; empty allowlist denies
  everyone — `roles.ts:40-47`), so they are walled out **by design**. I judge only her reachable
  set; queue/sign-file findings are tagged `unreachable`/`by-design` and deferred.

---

## Journey 1 — draft-petition-letter · **L1-pass**

**Walkthrough.** From a real case, `DraftStudio` (`CaseDetailView.tsx:202`) posts `{caseId}` to
`/api/draft`. The DB path (`draftOperation.ts:122-162`) loads the case petitioner +
classification + the persisted scored criteria AND fuses the evidence vault into per-criterion
exhibits (`attachExhibits`, `draftOperation.ts:160-161`). The prompt
(`buildDraftPrompt`, `drafting.ts:174-208`) is fed all of that, with hard citation discipline:
"Use ONLY the facts provided… do NOT invent awards, publications, employers, dates" (line 181-183)
and, when exhibits exist, an inline `(Exhibit N)` rule that forbids citing/ inventing an exhibit
number not on file (`CITATION_RULE`, lines 160-166). The result is structured by criterion (one
section per Met/Strong), persists versioned (`saveDraft`), and re-opens hydrated
(`page.tsx:89`). A live `auditCitations` (`drafting.ts:593-608`) quarantines any hallucinated
`(Exhibit N)` as `unresolved` — exactly the "caught here, not by my attorney in red-line" safety
Gloria's bar demands (acceptance #4). Per-section **Regenerate** sends the client's CURRENT
`sections` (`DraftStudio.tsx:213`); the server merges by heading into *those* sections
(`pickMergeBase`/`mergeRegeneratedSection`, `draftOperation.ts:75-93,254-270`) so unsaved edits to
other sections survive, and the section prompt now receives the other sections as read-only
continuity context (`buildSectionPrompt` otherSections, `drafting.ts:222-267`) — the prior
**G1.1/dc-draft-02** continuity gap is **fixed in code**. Acceptance #3 met structurally.

**Findings.** No majors. One minor clarity nit: the idle-state helper copy is hardcoded "Draft a
full **O-1A** petition letter" regardless of classification (`DraftStudio.tsx:374-376`) — harmless
for Gloria's O-1A/EB-1A mix but stale for an EB-1A matter.

- **grounding score: 5/5** — beneficiary ✓, classification ✓, scored criteria (evidence+rationale)
  ✓, vault exhibits+facts ✓, other-letter continuity on regenerate ✓. (The raw CV is captured into
  the criteria evidence/rationale at qualify time rather than re-fed wholesale — PN-DRAFT-01,
  accepted, not re-reported.)
- **est. time-saved-if-it-worked:** ~2–2.5 days → an afternoon per first draft (authoring →
  editing), *provided* L2 confirms the live prose actually names the supplied specifics.

## Journey 2 — organize-evidence · **L1-pass**

**Walkthrough.** `EvidenceVault` posts `{name, content, caseId, classification}` to
`/api/evidence/categorize`. The prompt classifies into ONE of the **case's pack** criteria or
honestly "Unsorted" (`buildCategorizePrompt`, `evidence.ts:106-143`; buckets =
`criteriaNames(classification)`), facts are "ONLY from the document's content" (line 119) — no
silent wrong-bucketing, misfits land in Unsorted (acceptance #1). Crucially, the route now passes a
read-only whole-vault summary (`summarizeVaultBuckets`, `evidence.ts:84-101`; wired
`categorize/route.ts:64-73`) so a new doc is placed *consistently with its siblings* — the prior
**G2.1/PN-EVID-01** "sees one doc at a time" gap is **fixed in code**. Exhibit numbers are
monotonic and never-reused: the store computes a high-water mark across `doc_seq` + surviving rows,
so deleting an exhibit never renumbers the rest (`pglite-store.ts:646-693`) — acceptance #2.
Coverage/gaps come from real counts (`summarizeVault`, `evidence.ts:226-244`) and render as a
gaps badge list (`EvidenceVault.tsx:193-208`). Refile is honestly framed as a manual move that
does not re-check fit, and coverage is framed as "documents present, not criterion proven"
(`EvidenceVault.tsx:210-216`) — the **dc-evidence-02** clarity concern is **addressed**.

**Findings.** No majors. Stale comment only: the component header still says "eight O-1A criteria"
(`EvidenceVault.tsx:13`) and the data-layer doc-comment says criteria are "AI-categorized into an
O-1A criterion" (`evidence.ts:5-6`) while the code is fully classification-driven — comment drift,
not a defect.

- **grounding score: 4/4** — doc name ✓, full doc text ✓, the case's pack/criteria ✓, existing-vault
  sibling context ✓.
- **est. time-saved-if-it-worked:** the bucketing + exhibit index + gaps read that is otherwise
  hours of manual crosswalk per matter, compressed to seconds-per-doc — and it holds doc-after-doc.

## Journey 3 — respond-to-rfe · **L1-pass**

**Walkthrough.** Reachability gating confirmed: `RfeStudio` renders ONLY when `status === "Filed"`
(`CaseDetailView.tsx:224`). The route grounds the response on criteria + evidence + vault exhibits
(`attachRfeExhibits`) AND — the key win — the **as-filed petition letter** itself
(`attachFiledPetition` via `getLatestDraft`, `rfe/route.ts:99-106`), fused into the prompt as
read-only "AS_FILED_PETITION" context (`buildRfePrompt`, `rfe.ts:202-218`) so the response can
"track and reinforce its own language." The prior **G1.2/dc-rfe-02** "doesn't see the as-filed
petition prose" gap is **fixed in code**. The prompt asks for an opening that identifies the
petition + RFE, "one section addressing each issue the RFE raises," and a closing
(`rfe.ts:225-227`) — structurally **point-by-point**, crosswalked to the criterion at issue and the
original petition (acceptance #5). Citation discipline + exhibit audit + live adjudication scan
mirror drafting exactly (`rfe/route.ts:130-144`). Versions persist; the studio hydrates the latest
(`page.tsx:98-100`). Acceptance #4 (no fabricated exhibits) enforced.

**Findings.** No majors. One genuine reachability dependency to flag for L2: the as-filed-petition
grounding only fires if a draft was actually saved on the case before it reached Filed; with no
stored draft the response degrades to criteria-only grounding (`rfe/route.ts:105-106`, by-design
best-effort). For Gloria's factory this is the *normal* path (she drafts then files), so it lands.

- **grounding score: 4/4** — RFE notice text ✓, petition criteria+evidence ✓, vault exhibits ✓,
  as-filed petition prose ✓.
- **est. time-saved-if-it-worked:** ~a full day → ~an hour per RFE, *repeatably* — the highest-leverage
  thing she does. L2 must confirm the live response quotes *this* petition, not a generic form letter.

## Journey 4 — track-case-progress · **L1-conditional**

**Walkthrough.** Two real-case surfaces. (1) `YourCasesCard` (`CaseFileDashboard.tsx:136-172`) lists
her real persisted cases (file №, petitioner, classification, status badge, likelihood) above the
mock demo masthead, each row deep-linking to the detail; empty state points to `/qualify`
(acceptance: dashboard lists real cases ✓). (2) The "§ VI — Case portfolio" `CaseList`
(`CaseFileDashboard.tsx:99`) ALSO runs on her **real** cases — `getCases()` →
`getCasesForUser` (`saved-cases.ts:26-48`), not mock — with search (petitioner/file#/visa), filter
by classification + status, sort by status/likelihood/file#/target-date, and CSV/print export
(`CaseList.tsx`). That is genuinely a 40-matter triage surface. The case detail roadmap derives
from real state — `caseRoadmap(status, {hasEvidence, hasDraft})` (`roadmap.ts:38-59`) marking
done/current/upcoming accurately, fed from `documents.length` and the saved draft
(`CaseDetailView.tsx:133-137`). Deep links + hydration work.

**Findings (majors that carry forward).** Gloria is measured on *aging* and *status hygiene across
the board*, and her reachable real-case views fall short of that specifically:
- **gm-track-01 (major):** the `CaseList` portfolio table renders her real cases but its rows are
  **not navigable** to the case detail (no `<Link>`/onClick — `CaseList.tsx:246-270`); only the
  smaller `YourCasesCard` rows link. So the one view with search/filter/sort across 40 matters is a
  read-only dead-end — she filters to the aging "Drafting" pile, then has to scroll back up to the
  unfiltered `YourCasesCard` to actually open one.
- **gm-track-02 (major):** real cases persist `targetFileDate: ""` and `attorney: ""`
  (`saved-cases.ts:44-45`), so the portfolio's **target-file column is blank and sorting by target
  date is a no-op** for real cases — exactly the deadline-triage signal she lives by. The
  queue-age/staleness badges that *do* exist (v0.13.0) live only in the attorney review queue
  (`features/review/queue-age.ts`, `ReviewQueueView.tsx`), which she is walled out of — so there is
  **no aging/triage-by-what's-rotting signal on any surface she can reach**.

- **grounding:** n/a (no AI surface).
- **est. time-saved-if-it-worked:** a legible board across the caseload — partial today: lifecycle
  status is legible, but aging is not, on her reachable surfaces.

## Journey 5 — qualify-verdict · **L1-pass (with a model-vs-mock caveat)**

**Walkthrough.** `/qualify` leads with the BestPathFinder (`QualifyEntry.tsx`,
`BestPathFinder.tsx`) — paste one profile, see all live programs ranked. The criteria/threshold
model is correct: O-1A pack = 8, EB-1A = 10, O-1B = 6, threshold 3, packs live in
`packs.ts:90-209`; `classifyStatus`/`statusTone` ensure unscored criteria render neutral (never
green) and only Met/Strong count toward the threshold (`criteria.ts:27-48,74-103`) — acceptance:
8 criteria represented correctly, ≥3 honoured, nothing unclaimed shown "Met." The authenticated
`/api/qualify` feeds the user's **full pasted profile** into the prompt (`qualification.ts:159-163`)
with "Base every score ONLY on what the user actually describes" (line 134-138), gates to live
programs (`parseQualifyRequest` → `isLiveProgram`), and persists the result as a real owned case +
criteria — so a referred lead becomes a matter cleanly. DISCLAIMER on every payload.

**Pack-correctness check (the critical non-O-1A risk):** `packFor()` falls back to O-1A for
unknown classification (`packs.ts:222-225`). I traced the path Gloria actually uses: the selected
classification flows qualify → `createCase` (persists `req.classification`) → case detail reads
`stored.classification` → EvidenceVault/DraftStudio/RfeStudio all receive that classification prop
and call `criteriaNames(classification)`/`packFor(classification)`. **No silent O-1A fallback on
the real end-to-end path** — the fallback only bites a genuinely unknown/unset code, and the qualify
parser gates to live programs before persisting. Gloria's EB-1A leads get the EB-1A pack
end-to-end. (Not applicable as a defect for this operator Character.)

**Finding (minor, by-design honesty):** both anonymous previews — the homepage InstantVerdict
(`/api/qualify/preview`) and the `/qualify` BestPathFinder (`/api/qualify/preview/best-path`) — run
the **deterministic keyword mock**, never the model, even under `LLM_ENGINE=claude`
(`best-path.ts:96-97,23`; `preview/route.ts` comment "no model call"). It is honest (labeled
`source:"mock"`, no charge) and it is the documented free-read design — but the *first* read Gloria
sees when triaging a referred lead is a keyword heuristic, not an AI screen; the model read is one
click deeper behind the authenticated `/api/qualify`. Recorded as `scope_note`-adjacent, not a
defect.

- **grounding score: 3/3 (authenticated qualify)** — full profile ✓, correct pack/threshold ✓,
  live-program gating ✓. *Preview path scores lower as designed: 2/3 — real profile reaches it, but
  it is scored by keyword regex, not the model.*  **lowest grounding seen this run: 2/3.**
- **est. time-saved-if-it-worked:** a defensible yes/no/maybe + criterion map in <5 min vs reading
  the file cold; the keyword preview risks under/over-scoring a lead until the full screening runs.

---

## Findings table

| id | journey | type | severity | dimension | impact (f/r/t) | title | code_check | verdict |
|---|---|---|---|---|---|---|---|---|
| gm-track-01 | track-case-progress | broken-flow | major | effort | high/high/low | Real-case portfolio table rows aren't navigable to the case detail | present-broken | confirmed |
| gm-track-02 | track-case-progress | missing-feature | major | missing | high/high/med | No aging/target-date/staleness signal on any Gloria-reachable real-case view (queue-age is attorney-queue only; target date persists empty) | confirmed-absent | confirmed |
| gm-draft-01 | draft-petition-letter | confusion | minor | clarity | low/high/low | DraftStudio idle copy hardcodes "O-1A" regardless of classification | present-broken | confirmed |
| gm-evid-01 | organize-evidence | confusion | polish | clarity | low/med/low | Stale "eight O-1A criteria" comments while code is pack-driven | present-but-missed | confirmed |
| gm-qual-01 | qualify-verdict | quality-gap | minor | senior-quality | med/high/low | First-touch lead previews (InstantVerdict + BestPathFinder) are keyword-mock, not model, even with the engine configured | by-design | confirmed |
| gm-draft-str-01 | draft-petition-letter | strength | polish | trust | — | Citation discipline + live `auditCitations` quarantines hallucinated `(Exhibit N)` before it reaches an attorney | by-design | confirmed |
| gm-rfe-str-01 | respond-to-rfe | strength | polish | senior-quality | — | RFE prompt fused with the as-filed petition prose + exhibits + RFE text (G1.2 fixed) — structurally point-by-point on *this* petition | by-design | confirmed |
| gm-evid-str-01 | organize-evidence | strength | polish | trust | — | Monotonic never-reused exhibit ordinals; whole-vault sibling context (G2.1 fixed); honest coverage framing | by-design | confirmed |

---

## First-person review — in Gloria's voice

I came in skeptical. I've been sold "RFE template automation" three times and twice it handed my
attorneys a confident, mis-cited brief I had to catch in red-line — which in this firm is *my* miss,
not the tool's. So the first thing I went looking for was the lie: does it invent an exhibit, does it
quote a paper my client never wrote, does it forget which petition we actually filed. And honestly?
This one mostly holds the line. The draft and the RFE response argue **only** from the criteria and
the evidence on file, the prompt screams "do NOT invent awards, publications, employers, dates," and
there's an actual audit that flags any `(Exhibit 7)` that doesn't resolve to a document in my vault —
*before* it gets to my attorney. That's the difference between a tool I trust at forty matters and one
that costs me credibility on matter #38. The RFE responder now reads the petition we filed, not just
the criteria skeleton, which is the whole ballgame — a generic "your client is extraordinary" form
letter is exactly what draws a *second* RFE. And the evidence vault buckets into the right criteria
for the *visa* (not always O-1A), keeps Unsorted honest, numbers exhibits monotonically and won't
renumber when I delete one. Per-section regenerate keeps my other edits. These are the things that
were broken in the tools that lost.

Where it frustrates me is the board. I don't nurse one matter — I triage forty, and I triage by
*what's aging*. There's a real portfolio table with search, filter, sort, even CSV export, and it's
on my actual cases — beautiful — but I can't *click a row to open the case*, and the target-file
date column is blank, and there's no "this has been in Drafting for 18 days" flag anywhere I can
reach (that lives in the attorney queue I'm correctly locked out of). So I can find the aging pile,
then I have to scroll back up to a different, smaller list to actually open one. At scale that's death
by a thousand paper cuts. And the lead pre-screen on `/qualify` is keyword-matching under the hood,
not the AI — fine as a free teaser, but I'd want the real model read before I tell a partner "yes,
take this referral."

Would I adopt it? For drafting and the RFE factory — yes, conditionally, pending a live look at the
prose. For running my board — not yet; it knows my cases but not their *age*. Would I tell a peer?
"Trust the draft and the RFE; don't run your week off its dashboard."

## What passed (protect these)

- **Citation discipline + the `auditCitations` unresolved-exhibit quarantine** (`drafting.ts:181-183,
  593-608`) — the single feature that makes this safe at scale. Do not soften it.
- **RFE grounding on the as-filed petition + exhibits + RFE text** (G1.2 fixed —
  `rfe/route.ts:99-106`, `rfe.ts:202-218`) — turns a form letter into a response on *this* petition.
- **Pack-driven everything, end-to-end** — qualify→case→evidence→draft→RFE all honor the case's real
  classification; no silent O-1A fallback on the live path (`packs.ts`, traced).
- **Monotonic, never-reused exhibit ordinals** (`pglite-store.ts:646-693`) — deletes don't renumber.
- **Whole-vault sibling context on categorize** (G2.1 fixed) + **per-section continuity context**
  (G1.1 fixed) + **honest coverage/refile framing** (dc-evidence-02 addressed).
- **DISCLAIMER on every AI payload** via the orchestrator + every `build*Result`
  (`operation.ts:255,272-278`, `result.ts:37-42`), and the fail-closed `isConfiguredAttorney` wall
  that keeps a non-attorney out of the queue/sign-file (a security strength, by design).
- **Reclaim-to-mock honesty** — a mock is never billed/labeled as model output (`operation.ts:284-292`).
