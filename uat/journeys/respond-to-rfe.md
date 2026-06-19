---
name: respond-to-rfe
title: Turn a USCIS RFE into a point-by-point response grounded in the original petition
promotion: discovery
surfaces: ["/dashboard/cases/[id]", "/api/rfe", "/api/rfe/forecast"]
ai_surface: true
characters: [devin-cruz-paralegal, maya-okonkwo-attorney]
---

## Goal (not a script)

On a Filed case that drew an RFE, I paste the RFE and generate a structured, point-by-point
response that addresses each deficiency against the original petition and the relevant criterion —
editable and versioned — so my attorney can finalize it within the 60–90 day clock.

## User-POV definition of done

- The RFE studio appears on a **Filed** case and accepts the RFE text.
- The response is **point-by-point**, each point tied to the specific deficiency and the criterion
  at issue, referencing the original petition's evidence.
- It cites only real, supplied evidence — **no fabricated** authority or exhibits.
- I can edit and regenerate; versions persist and re-open from the latest.
- The `DISCLAIMER` is present; it's clearly drafting, not legal advice.
- (If present) an RFE risk forecast is honest and actionable, not theatre.

## L1 grounding focus

Reachability: RfeStudio is surfaced only when status = Filed — confirm the gating. Affordance →
`/api/rfe(/forecast)` → `features/rfe/*` (twin of drafting: citation discipline, JSON parse,
deterministic mock) + `lib/data/*` saveRfeResponse. **Grounding audit:** does the RFE prompt
receive the original petition + criteria + the pasted RFE, or just the RFE text alone?
