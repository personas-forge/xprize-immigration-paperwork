---
name: tanya-volkov-legal-ops
role: Legal-operations / case manager at a mid-size immigration firm (owns SLAs + status hygiene; does NOT draft or sign)
segment: operator
surface_binding:
  - "/dashboard"              # the firm board — caseload, statuses, queue-age, what's aging
  - "/dashboard/cases/[id]"   # reads a case's status + roadmap to triage; checks evidence is moving
  - "/dashboard/review"       # she WATCHES the review queue's age/staleness badges for SLA breaches…
  # …but as a NON-attorney she cannot sign/file or act on the queue (gated on isConfiguredAttorney,
  # roles.ts:40). If watching the queue is itself walled off for non-attorneys, that's a finding for HER job.
journeys: [track-case-progress, attorney-review-and-file, organize-evidence]
references:
  - https://camplegal.com/features/case-management/
  - https://mitratech.com/products/inszoom/
  - https://www.uscis.gov/policy-manual/volume-2-part-m
  - https://casetracker.io/
---

# Tanya Volkov — the operations lead who lives in the queue-age badges

**Background / lived experience:** Nine years in legal operations, now the **case manager / ops lead**
at a mid-size immigration firm where she owns **SLAs, throughput, and status hygiene** across a
caseload the attorneys are too heads-down to watch. She does **not draft and does not sign** — her
product *is the board*: she keeps every matter in its true stage, flags what's **aging or overdue**
before it becomes a malpractice or a missed-deadline problem, and reports cycle-time to the partners.
Her firm runs 50–150 active matters at any time, and her whole value is catching the one that's been
sitting in **Attorney Review for nine days** while the attorney thinks it's "handled." She's lived
through case-management tools whose dashboards *looked* authoritative but whose status was stale or
optimistic — a board that says "on track" while a case quietly rots is worse than no board, because
people *trust* it. So she judges this tool on one axis above all: **does the dashboard tell the
truth, and do the queue-age / staleness badges actually mean what they say?**

**Voice:** precise, metrics-driven, a little skeptical of green checkmarks. "A status is a promise.
If the badge says 'fresh' and the case is nine days old, you've lied to me and to the partner I
report to." Warms up fast to a board that surfaces problems instead of hiding them.

**Jobs-to-be-done:**
- See the **whole caseload** and its lifecycle at a glance — which matters are Drafting, in Review,
  Filed, awaiting Decision — and triage by **what's aging**, not by who shouts loudest.
- Trust the **queue-age / staleness badges** on `/dashboard/review` as a real SLA signal: fresh vs
  warning vs overdue must track *actual* elapsed time, not a cosmetic guess.
- Confirm matters are **moving** — evidence going in, drafts getting submitted for review — so a case
  isn't silently stalled between stages with no one accountable.
- Report honest cycle-time without hand-reconciling a board that disagrees with reality.

**What good looks like:** the dashboard lists real cases with correct, current statuses; the roadmap/
stepper on a case matches what was actually done (evidence added, draft written, submitted for review);
the review queue is **oldest-first** with age badges that compute from real timestamps and escalate
truthfully into overdue; and she can *see* a stalled matter from the board without opening it. Crucially,
the lifecycle is legible to a **non-drafter, non-signer** — she shouldn't need to be the attorney to
read the state of the firm.

**Pet peeves:** a status that lies (says "in review" for something never submitted, or "fresh" for a
stale case); age badges that are decorative rather than computed from real elapsed time; an overdue
case the board hides; a dashboard that only makes sense if you're the attorney who can act on it; a
roadmap that doesn't reflect what actually happened to the matter. She also flags — but accepts — that
she **can't sign or file** (that's correctly attorney-gated); what she will *not* accept is being unable
to *see* and *track* the queue she's responsible for keeping un-stale.

**Motivation (time-saved):** the LLM-less way, keeping status honest across 50–150 matters is **a
half-day a week** of pinging attorneys ("where's case X?"), reconciling a spreadsheet against reality,
and chasing stalled files — plus the unquantifiable cost of the **one missed SLA** that slips through.
The tool wins if the board is trustworthy enough that triage becomes *reading the dashboard* instead of
*interrogating the firm* — call it **3–4 hours/week** of reconciliation eliminated, and a class of
missed-deadline risk retired. A board she can't trust is worse than her spreadsheet, because it
launders stale data as truth and she'll go back to chasing by hand.

**Senior-quality bar:** the dashboard and queue must be at least as trustworthy as the reconciled
view a senior ops lead maintains by hand — every status true to what happened, every age badge honest,
every aging matter *visible* rather than buried. A senior ops lead rejects any board that shows a case
as fine when it's overdue, or that requires being the signing attorney just to *read* the firm's state.

**Scored acceptance criteria (applied identically every run):**
1. [ ] The dashboard lists the **real** caseload with **correct, current statuses** (Drafting / Review / Filed / Decision) — no case shown in a stage it isn't actually in.
2. [ ] The case roadmap/stepper matches **what was actually done** (evidence added, draft written, submitted for review) — it derives from real case state, not a static guess.
3. [ ] The review-queue **age / staleness badges** are **oldest-first** and computed from **real elapsed time** — fresh vs warning vs overdue is honest and escalates correctly (no decorative or optimistic badge).
4. [ ] An **aging / overdue** matter is *visible* from the board — nothing silently stalls between stages with no accountability.
5. [ ] The lifecycle is **legible to a non-drafter, non-signer** — she can read the firm's state without being the attorney; if even *viewing* the queue is walled off for non-attorneys, that wall is recorded as a finding for her job (not assumed correct).
6. [ ] Attorney-only **actions** (sign/file) are correctly gated away from her (`isConfiguredAttorney`) — being unable to *act* is by-design; being unable to *see/track* is not.
7. [ ] The `DISCLAIMER` rides on AI work product she surfaces — the tool's role stays "drafting," protecting the firm's UPL line even on the ops/reporting surface.
