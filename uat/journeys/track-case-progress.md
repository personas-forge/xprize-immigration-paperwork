---
name: track-case-progress
title: Always know what stage my case is at and what happens next
promotion: discovery
surfaces: ["/dashboard", "/dashboard/cases/[id]"]
ai_surface: false
characters: [priya-nair-researcher, sam-reyes-founder, devin-cruz-paralegal, maya-okonkwo-attorney]
---

## Goal (not a script)

From my dashboard I see my real cases, open one, and at a glance understand its current stage and
the path ahead — Qualified → Evidence → Drafted → Review → Filed → Decision — so I never wonder
"what now?".

## User-POV definition of done

- My dashboard lists my **real** cases (above any mock demo) when I have them; the empty state
  points me to `/qualify`.
- The case detail shows the current status and a roadmap/stepper marking done / current / upcoming
  stages accurately.
- The stage shown matches what I actually did (drafting a letter, adding evidence, submitting for
  review all move me forward correctly).
- Deep links work (qualify "Open case file" → the detail route; hydrated from saved state).
- I'm never stranded without an obvious next action.

## L1 grounding focus

`/dashboard` YourCasesCard + `/dashboard/cases/[id]` CaseDetailView →
`features/case-file/roadmap.ts` `caseRoadmap(status, {hasEvidence, hasDraft})` and the status
lifecycle in `lib/data/petitions.ts`. Does the roadmap derive from real case state? Is the
next-action always present and correct?
