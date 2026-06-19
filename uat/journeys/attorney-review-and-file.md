---
name: attorney-review-and-file
title: As the attorney of record, review the queue, request changes or sign & file
promotion: discovery
surfaces: ["/dashboard/review", "/dashboard/cases/[id]"]
ai_surface: false
characters: [maya-okonkwo-attorney]
---

## Goal (not a script)

As the attorney of record I open my review queue, pick the oldest case awaiting sign-off, read the
packet, and either **request changes** (sending it back to the preparer) or **sign & file** it with
a receipt number — then later **record the USCIS decision**. Throughout, I must be able to trust
that nothing filed under my name overclaims or crosses into legal advice.

## User-POV definition of done

- The review queue lists cases awaiting sign-off, **oldest-first**, with truthful age badges
  (fresh / warning / overdue).
- From a case I can **request changes** with a note → the case returns to Drafting and my note is
  visible to the preparer.
- I can **sign & file** → the case advances to Filed with a receipt number; the effect is clear and
  intentional, not a surprise irreversible click.
- I can **record the decision** (approved/denied) and the lifecycle reflects it.
- Attorney actions are gated to the attorney role (demo-unlocked locally) and the status is legible
  at every step.
- Nothing in the packet reads as legal advice to the client; the `DISCLAIMER` is present on AI
  work product.

## L1 grounding focus

`/dashboard/review` ReviewQueueView (queue-age badge logic, oldest-first sort) and the case-detail
ReviewPanel → `features/review/actions.ts` (submitForReview, attorneyRequestChanges,
attorneySignAndFile, attorneyRecordDecision) + `lib/data/reviews.ts` + `lib/auth/roles.ts`
`isAttorney`. **Reachability check:** confirm `developer@localhost` can reach the queue + act
(empty `ATTORNEY_EMAILS` = demo-unlock). Are the state transitions correct and reversible where
they should be?
