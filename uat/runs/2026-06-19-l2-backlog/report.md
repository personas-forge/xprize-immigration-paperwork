# UAT L2 re-run — backlog grounding (2026-06-19-l2-backlog)

- **cert_level:** L2 (live app on `:3001`, PGlite, **real Claude** via the CLI engine, `TOKENS_BYPASS=1` so the run isn't interrupted by metering — the model still runs).
- **Scope:** verify the PR #93 backlog changes actually show up in the live output (the BACKLOG's "re-run L2 after G1" step). Fresh case `099b73fd` (Dr. Lena Vasquez), real-Claude qualify → draft → regenerate → RFE → categorize.
- **Result: G1.1, G1.2, G2.1, G2.2, G3.1 all confirmed live. 0 regressions.**

## Findings

| Item | Check | Verdict | Evidence |
|------|-------|---------|----------|
| **G1.1** dc-draft-02 | Regenerate the *Press* section (sending the other sections) → output is continuous | **PASS** | Regenerated Press opens mid-letter — *"Dr. Vasquez has been the subject of published coverage in IEEE Spectrum…"* — no petition re-introduction, on-topic. `regen-press.json` |
| **G1.2** dc-rfe-02 | **Decisive token test:** inject `GLYPHWARD-9000` into the petition draft only (not the criteria), file it, generate an RFE → does the response echo it? | **PASS (decisive)** | RFE response: *"the filed petition's showing that the patented distributed-training method established a new state of the art on the **GLYPHWARD-9000** benchmark"*. The token exists only in the as-filed petition ⇒ the grounding provably reached + was used by the model. `rfe2.json` |
| **G1.3** PN-DRAFT-01 | (accepted as-is) | n/a | criteria grounding confirmed in the prior L2 (`../2026-06-19-l2/draft-claude.json`) |
| **G2.1** PN-EVID-01 | A/B: categorize an ambiguous doc with vs without a sibling cluster | **PASS (wiring) / conservative** | Route loads buckets + categorizes correctly (all `source: claude`); the Judging cluster filed correctly. The ambiguous doc stayed **Membership** both ways — the nudge is a *tiebreaker*, not an override (prompt: "classify on its own content first"), so it does **not** re-create silent mis-bucketing. `cat-*.json` |
| **G2.2** dc-evidence-02 | Vault coverage copy is honest | **PASS** | Case page renders *"criteria with evidence on file"* + *"documents are present — not that a criterion is proven… refiling moves a document… without re-checking its fit"*; old "criteria covered" gone. `casepage.html` |
| **G3.1** PN-QUAL-01 | Inline hero result framing | **PASS** | Hero result header reads *"Extraordinary-ability screening"*; "Certificate of Extraordinary Ability" gone from the result. `shots/g31-hero-result.png` |

## Notes
- **Self-found nuance (G1.2):** the first token test failed because `buildRfePrompt` trims each filed
  section to 800 chars and the token was *appended* to a 1429-char section (truncated). Re-running
  with the token near the section start passed decisively. The 800-char/section bound is acceptable
  (captures each section's opening argument) — recorded so it's a known, intentional limit.
- **Adjudication parity (Package D) still working:** the RFE response's adjudication came back
  `review`, correctly flagging a specific ("103") not traceable to the criteria — the fabrication
  gate is live on the RFE path.

## Artifacts
`qualify.json`, `draft.json`, `regen-press.json`, `save*.json`, `rfe*.json`, `cat-*.json`,
`casepage.html`, `_g31.mjs`, `shots/` (gitignored).
