---
name: organize-evidence
title: Sort my evidence into the right O-1 criteria, with an exhibit index and visible gaps
promotion: discovery
surfaces: ["/dashboard/cases/[id]", "/api/evidence/categorize"]
ai_surface: true
characters: [priya-nair-researcher, devin-cruz-paralegal]
---

## Goal (not a script)

I add my documents (pasted text) and the Evidence Vault categorizes each into the right O-1
criterion bucket, assigns an exhibit number, extracts the key facts, and shows me where my coverage
is thin so I know what to chase before drafting.

## User-POV definition of done

- Each document lands in the *correct* one of the eight buckets (or honestly in **Unsorted** when
  it doesn't fit) — no silent wrong-bucketing.
- Exhibit numbers are monotonic and the index reads like something I could file.
- A coverage/gap summary tells me which criteria are weak or missing.
- I can refile or remove a document and the index stays sane.
- Extracted facts are accurate to the document — **nothing invented**.
- The `DISCLAIMER` is present on the AI output.

## L1 grounding focus

Affordance → `/api/evidence/categorize` → `features/evidence/*` (categorize into the
classification's buckets or Unsorted, extract facts, `summarizeVault` coverage/gaps, keyword mock)
and `lib/data/evidence.ts` (monotonic exhibit assignment). Does categorization follow the case's
pack/classification? Is the gap read derived from real coverage? Does the prompt see the real
document text?
