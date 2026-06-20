# L1 review — Harold Pike, Esq. (solo attorney of record)

- **Character:** harold-pike-solo-attorney · **segment:** operator (attorney of record + economic buyer)
- **Journeys walked:** attorney-review-and-file, respond-to-rfe, draft-petition-letter, track-case-progress
- **Date:** 2026-06-20 · **cert_level:** L1 (theoretical, code-grounded, no browser)
- **Reachability resolved:** Harold IS the configured attorney (`ATTORNEY_EMAILS=developer@localhost` →
  `isConfiguredAttorney` true, `roles.ts:45`). He reaches the review **queue** (`review/page.tsx:17`),
  the case-detail **ReviewPanel** sign/file console (`ReviewPanel.tsx:126`), DraftStudio, RfeStudio
  (Filed-only, `CaseDetailView.tsx:224`), and `/billing`. All four journeys sit inside his reachable set.

---

## Journey 1 — attorney-review-and-file · **L1-pass**

**Walkthrough (in Harold's head).** I land on `/dashboard`, and because I'm the configured attorney a
"Review queue" link is in the top bar (`DashboardView.tsx:35-45`). The queue lists only `Attorney Review`
cases (`pglite-store.ts:437`), oldest-first (`sortOldestFirst`, `queue-age.ts:66`), each with an age badge
(fresh <12h / warning 12–24h / overdue >24h, `queue-age.ts:26-38`) and the approval-likelihood number.
I click the oldest. On the case file I read the criteria table, the evidence vault, the drafted letter, and
land on the Attorney-of-record console. Two affordances: a **Sign & file** button and a **Return with
changes** textarea+button (`ReviewPanel.tsx:126-144`).

The part that earns my trust: **Sign & file is a deliberate two-step**. The first click only *reveals* a
confirm panel that states the exact effect — "You are about to **sign this petition under your name and
file it with USCIS**. The case moves to **Filed** and receives a receipt number. Confirm only after you have
reviewed the full draft and exhibits" — with a **Confirm** and a **Cancel** (`ReviewPanel.tsx:228-272`).
No bare one-click landmine. And the server action compare-and-sets from `Attorney Review → Filed`
(`actions.ts:144-171`), so a double-click or a stale second tab finds the case already Filed, mints **no
second receipt**, and no-ops (`pglite-store.ts:480-506`). "Return with changes" round-trips to Drafting and
writes my note as a `changes_requested` event the preparer sees in the thread (`actions.ts:119-140`,
`ReviewPanel.tsx:178-200`). After filing, the same panel offers **Record decision** (Approved/RFE issued/
Denied, server-allowlisted, `actions.ts:184`); "Approved" is terminal.

This clears my criteria 1, 2, 3, 6. My only quarrel is the age badge — see HP-REVIEW-01.

- **Grounding score:** n/a (no AI surface; data-correctness only).
- **Est. time-saved-if-it-worked:** the ceremony itself saves little clock time, but the *confidence* that I
  can't misfire a filing is the load-bearing value — it's the difference between adopting the bench and not.

**Findings:** HP-REVIEW-01 (major), HP-REVIEW-02 (minor), HP-REVIEW-03 (strength), HP-REVIEW-04 (strength).

---

## Journey 2 — respond-to-rfe · **L1-pass**

**Walkthrough.** RfeStudio only renders on a **Filed** case (`CaseDetailView.tsx:224`) — correct gating; I
can't draft an RFE response before there's a filing to respond to. I paste the USCIS notice and click
"Draft RFE response" (5 tokens). The grounding is richer than I'd feared: the route loads the case
criteria, **fuses the evidence-vault exhibits** (`attachRfeExhibits`, `rfe/route.ts:102`), AND **fuses the
as-filed petition letter** so the response can track my own filed language (`attachFiledPetition`,
`rfe/route.ts:105-106`; prompt block `rfe.ts:202-218`) — that's the G1.2/dc-rfe-02 backlog item, now landed
in code. The prompt forbids inventing evidence/exhibits and forbids case-law cites (`rfe.ts:173-194`). On
the result I see the DISCLAIMER, a CitationNote, the **AdjudicationBadge**, and the **ExhibitIndex** with a
red "Unsupported citation — attorney must verify" alert if the model cited an `(Exhibit N)` with no on-file
document (`RfeStudio.tsx:240-250`, `ExhibitIndex.tsx:33-47`). The live adjudication gate runs the same
fabricated-specifics / case-law / wrong-classification scan as drafting (parity, `rfe/route.ts:130-144`).
For something I sign under my bar card, that exhibit-integrity alarm is exactly the catch I wanted.

- **Grounding score:** **5/6.** Reaches the prompt: (1) RFE notice text, (2) scored criteria + statuses,
  (3) per-criterion evidence/rationale, (4) vault exhibits with extracted facts, (5) the as-filed petition
  sections. Not reached: the applicant's full source CV/profile (only the per-criterion paraphrases persist;
  accepted as PN-DRAFT-01/G1.3, out of scope here).
- **Est. time-saved-if-it-worked:** an RFE response is a hard, un-billable day for me LLM-less; a grounded
  point-by-point first draft I *verify* turns it into an afternoon. The petition-language fusion is what
  makes it a verify-not-rewrite — a generic criteria-only response would not have cleared my bar.

**Findings:** HP-RFE-01 (strength), HP-RFE-02 (minor).

---

## Journey 3 — draft-petition-letter · **L1-pass**

**Walkthrough.** From the case file I click "Draft the petition" (12 tokens). The route drafts from the
case's persisted criteria and **fuses the evidence vault into real `(Exhibit N)` citations**
(`attachExhibits`, `draftOperation.ts:160-161`). The prompt's STRICT RULES are written for exactly my
anxiety: use ONLY provided facts, do **not** invent awards/publications/employers/dates/citation counts, do
**not** cite case law or named decisions (statute/reg is fine — the attorney adds authorities), and the
exhibit-citation rule forbids citing or inventing an exhibit number not on file (`drafting.ts:160-207`).
Per-section **Regenerate** now passes the letter's *other* current sections as read-only continuity context
(`buildSectionPrompt` + `draftOperation.ts:173-181`) — the G1.1/dc-draft-02 backlog item, landed in code,
so a regenerated section shouldn't duplicate the intro or contradict siblings. The merge preserves my
unsaved edits to the other sections (`pickMergeBase`/`mergeRegeneratedSection`, `draftOperation.ts:75-93`).

Three independent fabrication safeguards reach my eyes on the finished draft (`DraftStudio.tsx:442-454`):
the **AdjudicationBadge** (live fabricated-specifics + case-law + wrong-code scan, `adjudication-gates.ts:
212-233`, surfaced via `executeAiOperation` `operation.ts:360-375`), the **ExhibitIndex** red
"Unsupported citation" alarm, and an "Adjudicator review" redline pass. Every payload carries the
DISCLAIMER, which keeps the tool's role "drafting" and names the attorney of record as the one who reviews
and advises (`result.ts:37-41`) — the ABS/UPL line holds; nothing implies the *software* vouches for the law.

- **Grounding score:** **5/6.** Reaches the prompt: petitioner, classification, per-criterion status,
  per-criterion evidence, per-criterion rationale, AND vault exhibits+facts, plus (on regenerate) the other
  sections. Not reached: the raw full CV (accepted G1.3/PN-DRAFT-01 — the qualify model already captured the
  specifics into the persisted criteria evidence, so the live draft names them; out of scope here).
- **Est. time-saved-if-it-worked:** drafting an O-1 petition myself is 2–3 days; a grounded, criterion-mapped
  first draft that I verify in an afternoon is the entire ROI. The citation-integrity alarm is what lets me
  trust it enough to verify-not-author.

**Findings:** HP-DRAFT-01 (strength), HP-DRAFT-02 (strength).

---

## Journey 4 — track-case-progress · **L1-pass**

**Walkthrough.** My dashboard lists my real persisted cases (`dashboard/page.tsx:30-38`), not just the mock
demo file. Opening one, the RoadmapStepper shows Qualified → Evidence → Drafted → Attorney review → Filed →
Decision with done/current/upcoming marks **derived purely from real case state** (`caseRoadmap`,
`roadmap.ts:38-59`; status is the source of truth post-submission, evidence/draft flags drive the
pre-filing step). The status I see matches what I actually did, and the next action is always present (submit
/ sign / record decision) via the ReviewPanel. As a solo with no case manager, the lifecycle staying
truthful on its own is exactly criterion 6. No dead-ends.

- **Grounding score:** n/a (no AI surface).
- **Est. time-saved-if-it-worked:** modest but real — I never have to reconstruct "what stage is this and
  what's next" by hand across 25 live matters.

**Findings:** HP-TRACK-01 (strength).

---

## Findings table

| id | journey | type | severity | dimension | impact (f/r/t) | title | code_check | verdict |
|---|---|---|---|---|---|---|---|---|
| HP-REVIEW-01 | attorney-review-and-file | quality-gap | major | trust | high/high/med | Queue age badge + oldest-sort measure case-creation time, not time-in-my-queue | present-broken | confirmed |
| HP-REVIEW-02 | attorney-review-and-file | confusion | minor | clarity | med/med/low | "Review queue" nav only on the dashboard top bar + `sm:`-only; gone from the case-detail header | confirmed-absent | confirmed |
| HP-REVIEW-03 | attorney-review-and-file | strength | polish | trust | — | Sign & file is a deliberate two-step confirm stating the exact effect — no one-click landmine | by-design | confirmed |
| HP-REVIEW-04 | attorney-review-and-file | strength | polish | trust | — | Atomic compare-and-set prevents double-file / second receipt / illegal transitions | by-design | confirmed |
| HP-RFE-01 | respond-to-rfe | strength | polish | senior-quality | — | RFE prompt is grounded on criteria + exhibits + the as-filed petition letter (G1.2 landed) | by-design | confirmed |
| HP-RFE-02 | respond-to-rfe | quality-gap | minor | trust | low/med/low | Fabrication gate is a non-blocking "warn"; a clean-looking but unverified specific can pass to a signable doc | by-design | uncertain |
| HP-DRAFT-01 | draft-petition-letter | strength | polish | trust | — | Triple fabricated-cite net: prompt discipline + live adjudication badge + unresolved-exhibit alarm | by-design | confirmed |
| HP-DRAFT-02 | draft-petition-letter | strength | polish | senior-quality | — | Section regenerate now carries letter continuity context (G1.1 landed) | by-design | confirmed |
| HP-TRACK-01 | track-case-progress | strength | polish | completion | — | Roadmap derives purely from real case state; next action always present | by-design | confirmed |

---

## First-person review — in Harold's voice

I already bought in, so I came to this run as a skeptic about exactly two moments: the click that files a
petition under my name, and a cite the machine invented on a document bound for USCIS. Both held.

The sign-and-file flow is the best thing in the build. It doesn't *let* me misfire. The first click just
shows me a plain-English statement of what's about to happen — signs under my name, files with USCIS, moves
to Filed, mints a receipt — and makes me press Confirm, with Cancel sitting right there. And underneath, the
thing genuinely can't double-file: a second click finds the case already Filed and does nothing. That's the
difference between a tool I trust with my bar card and a toy. The fabricated-cite defense is layered the way
I'd want it — the prompt forbids inventing authority and forbids case law, the compliance badge flags any
case-law cite for me to verify, and if the letter cites "Exhibit 7" and there's no Exhibit 7 in the vault,
it throws a red "attorney must verify" alarm in my face before I sign. The RFE drafter even reads my as-filed
letter now, so the response tracks my own language instead of regurgitating the criteria headings — that's a
verify, not a rewrite, and it's what saves me the hard day. The disclaimer keeps the tool firmly in the
"drafting" lane and names *me* as the one who reviews and advises; the ABS/UPL line holds. Nothing here
advises the client.

My one real gripe — and it's a real one, because the queue is my cockpit — is the age badge. I read "overdue,
red" as "this has been sitting in my queue past the clock." It isn't. It's measuring how old the *case file*
is, from the day it was created, not from the moment it was submitted to me. A matter that landed in my queue
an hour ago can show up screaming red because the file was opened three days back; and the oldest-first sort
is sorting by file age, not by who's been waiting on *me* longest. For a solo with no paralegal to keep me
honest, a queue that lies about wait-time is the one thing I can't have — it's the same pet peeve as a queue
that hides an overdue matter, just inverted. It's a fixable miss (read the `submitted` review event's
timestamp instead of `created_at`), and it doesn't block me from working, but it dents the trust in the one
screen I live in. Minor alongside it: I can't jump back to the queue from inside a case in one click, and on
a narrow screen the queue link disappears entirely — annoying for a man who works off a tablet between
hearings.

Would I keep signing what it drafts? Yes. The ceremony is sound, the fabrication net is real and visible,
and the grounding is richer than the last time I looked. Fix the queue clock and it's the bench I'd recommend
to the one other solo I trust.

---

## What passed (strengths worth protecting)

- **Two-step Sign & file** with an explicit effect statement + Confirm/Cancel — never a one-click filing
  (`ReviewPanel.tsx:228-272`). Do not "streamline" this into one click.
- **Atomic compare-and-set** on every status transition: no double-file, no second receipt, no illegal
  bounce of a Filed case (`actions.ts:144-171`, `pglite-store.ts:480-506`).
- **Layered fabricated-cite defense** visible to the signing attorney: prompt citation discipline
  (`drafting.ts:160-207`, `rfe.ts:173-194`), the live AdjudicationBadge (case-law + fabricated-specifics +
  wrong-code, `adjudication-gates.ts:294-313` → `operation.ts:360-375`), and the ExhibitIndex
  "Unsupported citation — attorney must verify" alarm (`ExhibitIndex.tsx:33-47`).
- **Richer grounding than the backlog described:** RFE now reads the as-filed petition (G1.2, `rfe.ts:202-218`)
  and section-regenerate carries letter continuity (G1.1, `drafting.ts:222-267`) — both shipped.
- **DISCLAIMER rides every AI payload and every error body**, keeping the tool's role "drafting" and naming
  the attorney of record as the reviewer/advisor — the UPL/ABS line (`result.ts:37-41`,
  `operation.ts` 402/429/500 paths).
- **Fail-closed cross-tenant gating** on the queue + sign/file (`isConfiguredAttorney`,
  `review/page.tsx:17`, `actions.ts:49-53`) — a security strength, not a gap.
- **Roadmap + lifecycle derive from real case state** with the next action always present
  (`roadmap.ts:38-59`) — the solo's no-case-manager lifecycle stays truthful.
