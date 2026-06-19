---
name: draft-petition-letter
title: Turn my evidence into a real, criterion-mapped petition letter draft
promotion: discovery
surfaces: ["/dashboard/cases/[id]", "/qualify", "/api/draft", "/api/draft/save", "/api/draft/critique"]
ai_surface: true
characters: [priya-nair-researcher, sam-reyes-founder, devin-cruz-paralegal, maya-okonkwo-attorney]
---

## Goal (not a script)

From my qualified case, I generate a full O-1/EB-1A petition letter — drafted section by section,
each section crosswalked to a specific criterion, using **my actual evidence** — then edit it and
regenerate individual sections until it's a draft my attorney can red-line.

## User-POV definition of done

- I can generate a full draft from my case, and it is structured by the eight criteria.
- Every section uses facts I supplied — **zero fabricated** awards, citations, exhibits, or metrics.
- Each section maps to the *correct* criterion (original contribution, scholarly articles, press,
  high remuneration, critical role, judging, awards…).
- I can edit sections and **regenerate a single section** without losing my other edits or the
  rest of the letter.
- The draft reads like a careful immigration drafter wrote it — not generic AI filler — and is
  honest where my evidence is thin.
- The `DISCLAIMER` rides on the output; the draft is clearly *work product* for an attorney to sign.
- The draft persists (versioned) and re-opens hydrated from the latest saved version.

## L1 grounding focus

Affordance → `/api/draft` → `features/drafting/*` (full-letter + per-section prompts, citation
discipline, JSON-tolerant parse, deterministic mock) and `lib/data/petitions.ts`
saveDraft/getLatestDraft. **Grounding audit:** does the draft prompt receive the case's real
criteria + evidence, or thin context? Does per-section regenerate preserve the rest? Is citation
discipline enforced (no invented authority)?
