# L1 report — Maya Okonkwo, Esq.

- **Character:** Maya Okonkwo, Esq. — immigration attorney of record / small-firm owner (operator + economic buyer, evaluating under the Arizona ABS licensing model)
- **Segment:** operator
- **Journeys walked:** attorney-review-and-file, respond-to-rfe, draft-petition-letter, track-case-progress
- **Date:** 2026-06-19
- **Cert level:** L1 (theoretical, code-grounded, no browser)

---

## Reachability resolution (done before judging — per protocol step 2)

The journey and the fixtures (`uat/env.md:75`, `uat/accepted-gaps.md:18`) assert that an empty
`ATTORNEY_EMAILS` is a **demo-unlock** so `developer@localhost` "can act as attorney of record."
**That premise is false in the current code.** Every attorney gate was deliberately migrated to the
STRICT `isConfiguredAttorney`, which **fails closed** on an empty allowlist (`roles.ts:45` → `false`):

- Dashboard nav link to the queue — gated on `isConfiguredAttorney` (`dashboard/page.tsx:25` →
  `DashboardView.tsx:35`): **no link** for the dev user.
- `/dashboard/review` — `attorney=isConfiguredAttorney` (`review/page.tsx:17`); page renders "Your
  account isn't on the attorney allowlist" (`ReviewQueueView.tsx:71-79`).
- Case detail — `attorney=isConfiguredAttorney` (`cases/[id]/page.tsx:60`); ReviewPanel renders
  **none** of the sign/file/request-changes/record-decision blocks (`ReviewPanel.tsx:125,149`).
- Server actions — `requireAttorney` gates on `isConfiguredAttorney` (`actions.ts:51`): even a forged
  POST is rejected.

So as the env.md fixture instructs, **the entire J1/J5 attorney workflow is unreachable** for
`developer@localhost`. The fix is trivial and the team's own README/comments point to it: set
`ATTORNEY_EMAILS=developer@localhost`. The **code is correct** (fail-closed cross-tenant is exactly
right, and from my liability lens it is a *strength* — the tool will not let an unverified account
sign and file). The defect is a **documentation/fixture contradiction**. I judge the workflow's
structure below assuming the allowlist is set (the intended demo path), and flag the gating-vs-docs
mismatch itself as the finding (`mo-review-01`).

---

## Per-journey verdicts

### 1. attorney-review-and-file — **L1-conditional**
Assuming `ATTORNEY_EMAILS` is set (without it the journey is unreachable — `mo-review-01`, major),
the structure is sound and, frankly, the parts I care most about are excellent. The queue is
oldest-first at both the DB (`getCasesInReview` `order by created_at asc`, `pglite-store.ts:433`) and
the view (`sortOldestFirst`, `ReviewQueueView.tsx:44`), with truthful fresh/warning/overdue age
badges (`queue-age.ts:26`) — it will not hide an overdue case. Request-changes round-trips the case
to Drafting with the feedback stored as a `changes_requested` event visible in the shared review
thread (`actions.ts:119-140`, rendered `ReviewPanel.tsx:181-202`). Sign & file advances to Filed and
mints a receipt via an **atomic compare-and-set** transaction (`pglite-store.ts:480-522`) — a
double-click cannot double-file or mint a second receipt, and the append-only log can't desync from
status. Record-decision → Approved is terminal and server-allowlisted (`actions.ts:184-190`). The one
real friction on my bar-license lens: "Sign & file with USCIS" is a **bare one-click submit** with no
confirmation and no statement of effect (`ReviewPanel.tsx:130-134`) — for the single most
consequential, signature-bearing action in the app, that is below my bar for "intentional, not a
surprise" (`mo-review-02`, major). Mitigant: the action is idempotent at the data layer and is a
recorded stub, not a real DocuSign/USCIS submission (accepted gap), so the *technical* irreversibility
risk is low — but the *intentionality UX* still falls short.

### 2. respond-to-rfe — **L1-pass**
RfeStudio is correctly gated to a **Filed** case (`CaseDetailView.tsx:224`). The grounding audit comes
out clean and is the answer to the journey's central question: on the DB path the prompt receives the
**original petition** (real petitioner + classification + persisted criteria via
`petitions.getCriteria`) **fused with the real evidence-vault exhibits** (`attachRfeExhibits` over
`evidence.getDocuments`) plus the pasted RFE notice — *not* the RFE text alone (`api/rfe/route.ts:60-101`).
Citation discipline is enforced in the prompt ("Use ONLY the facts provided… Do NOT invent evidence,
documents, exhibits"; no case law; data-markers against injection — `rfe.ts:147-190`), and DISCLAIMER
rides every payload. One quality nit (`mo-rfe-01`, minor): the RFE route does **not** wire the live
`adjudicate` gate that the draft route runs (`api/rfe/route.ts` has no `adjudicate` hook; cf.
`draftOperation.ts:167`), so the runtime fabrication/case-law/wrong-code flags that would catch a
hallucinated cite *for me* are surfaced on drafts but not on the RFE I'd sign — even though the gate
already has an `rfe` branch (`adjudication-gates.ts:299`). Prompt discipline holds; the runtime safety
net is just missing on this one surface.

### 3. draft-petition-letter — **L1-pass** (reviewing the draft I'd sign, not authoring ergonomics)
This is where the tool earns trust on my terms. The draft prompt forbids inventing
awards/publications/exhibits, bars case-law ("the attorney of record will add any case-law
authorities"), and wraps applicant data in injection-proof markers (`drafting.ts:181-208`). The single
DISCLAIMER — "general informational guidance only, not legal advice… an attorney of record licensed to
practice law is required to review… before anything is filed" — is attached through one `wrapResult`
chokepoint and rides every success *and* error body (`result.ts:37`, `operation.ts:255/278/341`).
Three independent guards against the exact thing that gets me sanctioned: (a) the prompt; (b) a **live
adjudication gate** scoring every paid draft for fabricated specifics, leaked visa codes, and case-law
cites, surfaced to me with the exact offending tokens (`adjudication-gates.ts:294`, wired
`draftOperation.ts:167`); (c) an **(Exhibit N) citation audit** that quarantines any cited exhibit
number with no matching on-file document as `unresolved` (`drafting.ts:556-580`). And the grounding is
real — the DB path feeds my persisted criteria + my real vault exhibits, not sample data
(`draftOperation.ts:106-121`). Per-section regenerate merges by heading into the latest version
non-destructively (`draftOperation.ts:204-225`). Recorded as strengths (`mo-draft-01`, `mo-draft-02`).
The open question is purely L2: does the *live prose* actually name my evidence and crosswalk the right
criterion, or is it confident filler? L1 can only certify the machinery is right.

### 4. track-case-progress — **L1-pass**
The roadmap stepper derives done/current/upcoming from real case state — status plus
`hasEvidence=documents.length>0` and `hasDraft` (`roadmap.ts:38-59`, `CaseDetailView.tsx:133-137`).
Filed → Decision-current, Approved → all-done; legible at every step. Status integrity is guaranteed by
the same atomic CAS transition (`pglite-store.ts:480`). Recorded as a strength (`mo-track-01`).

---

## Findings table

| id | journey | type | severity | dimension | title | code_check | verdict |
|----|---------|------|----------|-----------|-------|------------|---------|
| mo-review-01 | attorney-review-and-file | broken-flow | major | completion | Empty ATTORNEY_EMAILS denies dev user the whole attorney workflow (fixture/docs contradict the fail-closed code) | present-broken | confirmed |
| mo-review-02 | attorney-review-and-file | confusion | major | clarity | "Sign & file with USCIS" is a bare one-click submit — no confirm, no effect statement | confirmed-absent | confirmed |
| mo-rfe-01 | respond-to-rfe | quality-gap | minor | trust | RFE route omits the live adjudication gate the draft route runs | confirmed-absent | confirmed |
| mo-draft-01 | draft-petition-letter | strength | polish | trust | Citation discipline + UPL line enforced at 3 layers (prompt, envelope, live gate) | by-design | confirmed |
| mo-draft-02 | draft-petition-letter | strength | polish | trust | Inline (Exhibit N) citations audited; hallucinated exhibit quarantined as unresolved | by-design | confirmed |
| mo-track-01 | track-case-progress | strength | polish | clarity | Lifecycle + roadmap derive from real state; atomic CAS transitions | by-design | confirmed |
| mo-review-03 | attorney-review-and-file | strength | polish | trust | Queue honestly oldest-first with truthful age badges; cross-tenant read fails closed | by-design | confirmed |

---

## First-person review — in Maya's voice

I came in expecting to be the skeptic, because I've been pitched "AI that writes your petitions"
before and the pitch always elides the part where *my* bar card is on the line. This one mostly earns
the benefit of the doubt — for an unusual reason: it keeps drawing the line I care about, in the code,
not just the marketing.

The thing I check first is whether the machine pretends to practice law. It doesn't. The disclaimer is
one audited string, it says the right thing — "not legal advice… an attorney of record licensed to
practice law is required to review… before anything is filed" — and it's welded onto every payload
through a single chokepoint so a future engineer can't quietly drop it. The prompts forbid inventing
awards, publications, and exhibits, and explicitly refuse case-law ("the attorney of record will add
any case-law authorities"). That last detail is the tell that someone who understands UPL wrote this:
they left the law to me and kept the tool to drafting. Good. That's the deal I can license.

The thing I check second is whether I'd have to police hallucinations. Here it actually does some of my
policing *for* me: a live gate scans each draft and hands me the specific invented numbers, any leaked
visa code, and any case-law cite to verify; and a citation audit refuses to let a letter cite Exhibit 7
when there is no Exhibit 7 on file. That is review-not-rewrite in the right direction — it surfaces the
landmines instead of burying them. My one real complaint on that front is that the RFE response, which
I *also* sign and file inside a 60–90 day clock, doesn't get that same live gate. The discipline is in
the prompt, but the runtime net that catches a fabricated cite is only on the petition draft. Wire it
on the RFE too; it's a few lines and the branch already exists.

Two things stop me short of an unqualified yes. First, in the state I was handed, *I literally could
not do my job* — with the attorney allowlist empty, the dev account isn't on it, so there's no queue
link, the queue says I'm not allowed, and the sign/file console doesn't render. I traced it: the code
is right (fail-closed cross-tenant is exactly what I'd demand — I do not want any signed-in stranger
filing under counsel's name), but the setup instructions are wrong. Set `ATTORNEY_EMAILS` to the dev
user and the whole thing lights up. Fix the docs, not the code. Second — and this one is on the
product, not the docs — "Sign & file with USCIS" is a single naked click. That button signs a federal
petition under my name and files it. Every other consequential tool I trust makes me confirm. I know
it's a stub and the transaction is idempotent so I can't double-file, but the *gesture* has to feel as
weighty as the act. Give me a confirm step that states plainly what it does.

Would I license it? On the strength of the compliance posture, the grounding (it drafts from my real
criteria and my real exhibits, not a sample), the honest oldest-first queue with real age badges, and
the airtight state machine — yes, conditionally, pending an L2 look at whether the live prose is as
disciplined as the scaffolding. It respects the line between drafting and practicing law, and it treats
my signature as the thing that matters. That's most of the way to my trust. Close the RFE-gate gap and
give the filing button the ceremony it deserves, and I'd tell a peer to look at it.

---

## What passed (strengths worth protecting)

- **The UPL line is load-bearing and single-sourced.** One `DISCLAIMER` string via one `wrapResult`
  chokepoint, on every success and error body, plus a `CONSENT_DISCLAIMER` for the no-attorney-client
  nuance (`result.ts:37-54`, `operation.ts:255/278/341`). Do not weaken or fork this.
- **Three-layer fabrication defense on drafts:** prompt citation discipline (`drafting.ts:181`) +
  live adjudication gate (`adjudication-gates.ts:294`, `draftOperation.ts:167`) + (Exhibit N)
  citation audit with an `unresolved` quarantine (`drafting.ts:556-580`).
- **Real grounding, not sample data:** draft and RFE DB paths feed the case's real persisted criteria
  and real evidence-vault exhibits (`draftOperation.ts:106-121`, `api/rfe/route.ts:60-101`).
- **Honest queue:** oldest-first at DB and view, truthful age buckets, future-timestamp-safe
  (`pglite-store.ts:433`, `ReviewQueueView.tsx:44`, `queue-age.ts:26`).
- **Airtight state machine:** atomic compare-and-set transitions, append-only log in the same
  transaction, no double-file / no second receipt, server-side decision allowlist, "Approved"
  terminal (`pglite-store.ts:480-522`, `actions.ts:184-190`).
- **Fail-closed cross-tenant security:** `isConfiguredAttorney` everywhere a non-owner could touch
  another applicant's data/actions — the right default for a tool counsel signs on
  (`roles.ts:40`, `review/page.tsx:8-17`, `cases/[id]/page.tsx:40-60`).
- **Self-flagged scope honesty:** e-sign/USCIS-filing-as-stub and the demo-RBAC posture are
  documented as deliberate MVP boundaries, not hidden — a strength, not a gap.
