# L1 review — Tanya Volkov (legal-ops / case manager)

- **Character:** tanya-volkov-legal-ops · **segment:** operator
- **Journeys walked:** track-case-progress, attorney-review-and-file, organize-evidence
- **Date:** 2026-06-20 · **cert_level:** L1 (theoretical, code-grounded, no browser)

> Lens: I own SLAs and status hygiene across 50–150 matters. I don't draft and I don't sign — my
> product *is the board*. I judge this on one axis above all: **does the dashboard tell the truth,
> and do the queue-age / staleness badges mean what they say?**

---

## Reachability resolved (before judging)

Two roles exist in the whole codebase: owner (applicant) and attorney
(`isConfiguredAttorney`, `roles.ts:40`). There is **no ops / case-manager / read-only role.** That
sets my reachable surface:

- `/dashboard` — **reachable.** Shows my real cases (`YourCasesCard`) + the mock demo portfolio.
- `/dashboard/cases/[id]` — **reachable** for my own cases (owner gate, `[id]/page.tsx:46`).
- `/dashboard/review` — **conditionally reachable, and that's the whole problem.** The queue +
  even the *nav link to it* gate on `isConfiguredAttorney` (`review/page.tsx:16-17`,
  `DashboardView.tsx:35`). As a non-attorney I either (a) am off the allowlist → the page renders
  "Your account isn't on the attorney allowlist" with an empty body (`ReviewQueueView.tsx:71-79`),
  or (b) get added to `ATTORNEY_EMAILS` → I can now *see* the queue but I'm also handed sign/file
  power I should never have. There is no tier that lets me **watch** the SLA queue without becoming
  the signer. Per my character brief this wall is a finding for my job (not assumed correct).

Sign/file actions being gated away from me is **by-design and correct** (accepted gap "Production
attorney RBAC"; criterion 6 ✓). I do not re-report that. What I report is the *missing read tier*.

---

## Journey 1 — track-case-progress  ·  verdict: **L1-conditional**

**Surface model (code-grounded).** `/dashboard` (`dashboard/page.tsx`) loads my real cases via
`getCasesForUser` and renders `DashboardView → CaseFileDashboard → YourCasesCard`
(`CaseFileDashboard.tsx:136`). Each real-case row shows fileNumber, petitioner, classification, a
**status badge**, and likelihood (`CaseFileDashboard.tsx:152-165`). Opening a case renders
`CaseDetailView` with a `RoadmapStepper` (`CaseDetailView.tsx:133`) derived from
`caseRoadmap(status, {hasEvidence, hasDraft})` (`roadmap.ts:38`), where `hasEvidence =
documents.length > 0` and `hasDraft` = a saved draft exists. The status Fact is shown directly
(`CaseDetailView.tsx:121`).

**Walkthrough, in my head.** The status badges are real and current — they come straight from the
persisted `status` column, and the lifecycle transitions are atomic compare-and-sets
(`transitionCase`, `pglite-store.ts:480`), so a case can't sit in a stage it isn't in. Criterion 1
holds. The roadmap derives from real state (evidence/draft existence is queried live), so criterion
2 mostly holds — **with one honesty wrinkle.** `caseRoadmap`'s pre-submission branch marks the
**"Attorney review"** stage as `current` the moment a draft exists, *while the case status is still
"Drafting"* and nothing has been submitted (`roadmap.ts:51`; the test even names this state "ready
to submit", `roadmap.test.ts:28`). Triaging fast off the stepper, I could read "Attorney review ·
current" as "it's with the attorney" when it's actually parked in Drafting, un-submitted, with no
one accountable. The case-detail status Fact ("Drafting") sits right above and corrects it, so this
is a clarity wrinkle, not a lie — but it's exactly the genre of thing that bites me.

**The real gap for my job:** there is **no age / staleness signal anywhere on the board.** The real
`YourCasesCard` row carries status + likelihood but **no elapsed-time indicator** — a case that has
sat in Drafting for nine days looks identical to one created an hour ago (`CaseFileDashboard.tsx:152-165`).
I cannot "see a stalled matter from the board without opening it" (criterion 4 ✗ for real cases).
The one board that *does* have rich ops affordances — search / status filter / sort / CSV export, a
"Target file" column (`CaseList.tsx`) — is wired to the **mock demo portfolio** (`getCases()` →
`lib/data/cases.ts`), an accepted gap, not my live caseload. So the powerful board is fake data and
my real caseload gets a bare list with no aging. That asymmetry is the heart of my frustration.

- **Grounding score (this journey):** n/a — no AI surface; lifecycle is fully state-derived (call it
  status-honesty **4/5**: statuses true, roadmap derived, transitions atomic, disclaimer not load-
  bearing here, but **no board-level aging**).
- **Est. time-saved-if-it-worked:** partial. Reading current *status* off the board is real, but
  without board-level aging I still have to open each case (or hand-track) to find the stalled one —
  so the "3–4 hrs/week of reconciliation" win is only half-captured.

## Journey 2 — attorney-review-and-file (my interest: the queue-age badges)  ·  verdict: **L1-conditional**

**Surface model.** `/dashboard/review` (`review/page.tsx`) → `getCasesInReview()` (DB:
`order by created_at asc`, `pglite-store.ts:433-441`) → `ReviewQueueView`, which re-sorts oldest-
first (`sortOldestFirst`, `ReviewQueueView.tsx:44`) and renders an age **Badge** per row from
`ageBucket` / `formatAge` over `c.submittedAt` (`ReviewQueueView.tsx:98-120`). The badge buckets
are honest about *what they measure*: fresh <12h, warning 12–24h, overdue >24h, null-safe for
future timestamps, refreshed every 60s, with an `aria-label` (`queue-age.ts:26-60`).

**The headline finding — the badge measures the wrong clock.** Both the page and the dashboard map
`submittedAt: c.createdAt` (`review/page.tsx:35`, `dashboard/page.tsx:37`), and `StoredCase.createdAt`
is documented as "ISO timestamp of case creation — exposed as queue age proxy" (`petitions.ts:39`;
`types.ts:79-80`). The case's `created_at` is set once at `createCaseWithCriteria`
(`pglite-store.ts:374-388`) and **`transitionCase` never touches it** — it updates `status` and
`updated_at` only (`pglite-store.ts:501`). So the queue-age badge and the oldest-first sort both
run on **time-since-case-creation, not time-since-submitted-for-review.** A case created nine days
ago and submitted to the queue an hour ago shows a screaming red **"9d · overdue"** badge and sorts
to the top — even though the attorney has had it for one hour and is perfectly inside SLA.
Conversely, a case created this morning, drafted fast, and submitted an hour later shows "fresh"
even though for queue-SLA purposes that's correct only by luck. The badge is *precise* and
*confidently colored* and **systematically wrong for the thing I use it for.**

This is my single worst pet peeve, made structural: "the badge says X, the queue says Y, and people
*trust* the badge." My partners would read these badges as SLA breaches and chase attorneys over
cases that just entered review. A board that launders case-age as queue-age is worse than my
spreadsheet, because my spreadsheet doesn't lie with a red badge. The fix is in hand and cheap: the
`case_reviews` log already records the `submitted` event with its own `created_at`
(`reviews.ts:35`, `transitionCase` appends it, `pglite-store.ts:508`), or `cases.updated_at` (bumped
on the transition into review) is a far better proxy than `created_at`. Either would make the badge
mean what it says. (Note: `updated_at` isn't even in `CASE_COLUMNS`, `pglite-store.ts:186` — it's
right there in the table, just not selected.)

The rest of the queue machinery is genuinely good and I'd protect it: oldest-first is enforced at
both DB and view, the transitions are atomic and reversible where they should be (request-changes
↺ Drafting, sign&file → Filed with receipt, decision recording — `actions.ts:119-200`), and the
queue is a cross-tenant read correctly fail-closed (`review/page.tsx`). My problem is narrowly the
**timestamp the age is computed from**, plus the fact that **I can't reach this queue at all** as a
non-attorney (see Reachability).

- **Grounding score (this journey):** **2/4** for the queue-age signal — it sees a timestamp and
  computes age honestly, but the timestamp is the *wrong one* (case-create, not submit), and there's
  no per-case "time in current stage" exposed. (The sort + bucket logic themselves are sound.)
- **Est. time-saved-if-it-worked:** high *if* the clock were right and I could see the queue —
  oldest-first + honest overdue badges is exactly the SLA triage that retires my half-day/week of
  chasing. As built, I'd distrust the badges within a day and go back to the spreadsheet.

## Journey 3 — organize-evidence (my interest: is the case *moving*)  ·  verdict: **L1-pass**

**Surface model.** Evidence lives on the case detail (`EvidenceVault`, `CaseDetailView.tsx:193`).
Adding a doc POSTs `/api/evidence/categorize`, which grounds the prompt on the **real document
name + pasted text**, the **case's classification pack** criteria, and a **read-only summary of the
existing vault buckets** (`route.ts:79-80`, `buildCategorizePrompt`, `evidence.ts:106`). Coverage
and gaps derive from the real persisted documents (`summarizeVault`, `evidence.ts:226`); exhibits
are monotonic and never reused (`pglite-store.ts:646-664`). `DISCLAIMER` rides on every result
(`evidence.ts:205`).

**Walkthrough.** I don't categorize evidence (I'm not the drafter), but I watch whether evidence
going in shows up as *movement*. It does: once a document exists, `hasEvidence` flips and the
roadmap stepper advances the "Evidence" stage to done (`CaseDetailView.tsx:135`, `roadmap.ts:51`),
and the vault shows live coverage/gaps. So a case can't silently stall at the evidence stage with
no visible signal — the board reflects the real work. Grounding is strong: the prompt sees the
actual text, the actual pack, and the sibling buckets, so categorization is consistent rather than
one-doc-at-a-time blind. Criterion 7 (disclaimer on AI work product) ✓. This is the surface I
trust most.

- **Grounding score (this journey):** **5/6** — prompt receives doc name, doc text, classification
  pack, existing buckets, disclaimer; the one thing it can't see is the *source* documents' binary
  (OCR is an accepted env-gated gap, not counted against it).
- **Est. time-saved-if-it-worked:** indirect for me — a well-organized, gap-flagged vault is one
  fewer thing I have to chase the paralegal about; coverage visible on the board = less "where's the
  evidence for case X?".

---

## Findings table

| id | journey | type | severity | dimension | impact (f/r/t) | title | code_check | verdict |
|----|---------|------|----------|-----------|----------------|-------|------------|---------|
| tv-attorney-01 | attorney-review-and-file | quality-gap | major | trust | high/med/high | Queue-age badge & oldest-first sort compute from case-creation time, not submit-for-review time | present-broken | confirmed |
| tv-attorney-02 | attorney-review-and-file | missing-feature | major | missing | high/high/med | No ops/read-only tier — a non-attorney case manager can't even *view* the SLA queue | by-design | confirmed |
| tv-track-01 | track-case-progress | missing-feature | major | missing | high/high/med | No aging / staleness signal on the real-case board — a stalled matter is invisible without opening it | confirmed-absent | confirmed |
| tv-track-02 | track-case-progress | confusion | minor | clarity | med/high/med | Roadmap marks "Attorney review" as *current* while status is still Drafting / un-submitted | present-broken | confirmed |
| tv-track-03 | track-case-progress | strength | polish | trust | — | Statuses are true & transitions atomic — no case shown in a stage it isn't in | by-design | confirmed |
| tv-evid-01 | organize-evidence | strength | polish | senior-quality | — | Evidence categorization is well-grounded (real text + pack + sibling buckets) and movement is visible on the roadmap | by-design | confirmed |
| tv-attorney-03 | attorney-review-and-file | strength | polish | trust | — | Queue oldest-first enforced at DB+view; transitions reversible-where-right; fail-closed cross-tenant | by-design | confirmed |

---

## First-person review (the felt verdict)

I came in wanting one thing: a board that tells me the truth about *time*. The bones are honestly
better than most case-management tools I've fought with — statuses are real, the lifecycle is atomic
so nothing fakes a stage, and the queue is sorted oldest-first instead of by whoever shouts loudest.
That's the spine of a board I could trust. And then it breaks my heart in the one place I live: the
**queue-age badge is computed from the wrong clock.** It measures how old the *case* is, not how
long it's been *waiting on the attorney* — so a matter that entered review an hour ago can flash "9d
· overdue" in red, and a genuinely-rotting file can read "fresh." A status is a promise, and this
badge makes a confident, color-coded promise about the exact thing I'm paid to watch, and it's the
wrong number. I would catch that on day two, lose faith in every badge on the page, and walk back to
my spreadsheet — which is the worst outcome, because the rest of this is so close.

The second sting is that I can't even *get to* that queue. There's no role for someone like me: I'm
either locked out with "you're not on the attorney allowlist," or I have to be handed sign-and-file
power I must never hold just to *read* the SLA board. Ops is a real seat at a real firm; this product
doesn't have a chair for it yet. And on my own dashboard, my real cases show status but no aging at
all — the slick filter/sort/export board is bolted to demo data, while my live caseload gets a flat
list where the nine-day-stale matter looks identical to today's. The evidence side, I'll give full
credit — it's well-grounded and movement is visible, so a case can't silently stall on evidence.

Would I adopt it? Not yet, and not because the engineering is weak — it's because the two numbers I
trade on (queue age, and "what's aging on the board") are either wrong or absent. Fix the badge to
read from the submit-event timestamp (it's already in the review log) or `updated_at`, give ops a
read-only queue view, and put an age column on the real-case board, and this goes from "a prettier
lie" to "the board I'd actually run the firm on." I'd tell a peer: *great spine, don't trust the age
badge until they re-point the clock.*

## What passed (protect these)

- **Statuses are true and transitions are atomic** — compare-and-set lifecycle, no case shown in a
  stage it isn't in (`pglite-store.ts:480-525`, `actions.ts`). The honest core.
- **Queue is oldest-first at both DB and view**, null-safe, 60s-refreshed, aria-labeled badges
  (`pglite-store.ts:433`, `ReviewQueueView.tsx:44`, `queue-age.ts:26-60`). Only the *input
  timestamp* is wrong — the sort/bucket logic is sound.
- **Fail-closed cross-tenant queue** (`isConfiguredAttorney`) — a security strength, keep it; my
  finding is the *absence of a read-only ops tier*, not loosening this.
- **Evidence categorization is genuinely well-grounded** (real text + pack + sibling buckets) and
  **DISCLAIMER rides every AI payload** (`evidence.ts:106,205`). Movement is visible on the roadmap.
- **Roadmap derives from real case state** (`roadmap.ts`) — not a static guess; just re-label the
  "review = current while Drafting" stage.
