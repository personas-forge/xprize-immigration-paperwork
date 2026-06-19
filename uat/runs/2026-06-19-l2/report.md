# UAT L2 scorecard — 2026-06-19-l2 (empirical, live browser + real Claude)

- **cert_level:** **L2** (live app, `npm run dev`, PGlite persistence, **real Claude via the CLI engine**)
- **Base:** http://localhost:3001 · synthetic dev user (auto-seeded + funded 150 tokens) · `ATTORNEY_EMAILS=developer@localhost`
- **Method:** drove the running app (Playwright + direct API for the model-quality checks); started from the L1 handoff — verify the 6 fix packages hold live **and** the L2 priorities L1 couldn't see (real model output quality on the grounded path).
- **Result: 6/6 packages L2-confirmed · both grounded-AI-quality priorities confirmed · 0 new defects.**

## Package verifications (the L1 fixes, live)

| Pkg | What L2 checked | Verdict | Evidence |
|----|------------------|---------|----------|
| **A** | FAQ reads as a drafting tool (no flat-fee-firm/Gemini leaks); `/validation` reachable from cold footers; billing shows per-op costs | **PASS** | `_marketing.mjs` 10/11 live + raw-HTML confirm: `prepaid tokens`=1, `150 free tokens`=1, `flat fee`=0, `Gemini`=0; shots `faq/billing/validation.png` |
| **B** | Edit the *Awards* section, regenerate *Press* — the Awards edit must survive in the persisted draft | **PASS** | marker `ZZMARKER_KEEP_AWARDS` present in persisted draft after regenerate; Press body changed (862→869); `regen-claude.json` v2 |
| **C** | "Sign & file with USCIS" is a two-step confirm, not a bare submit | **PASS** | first click → "Confirm — attorney of record" + statement of effect, case **still Attorney Review** (not filed); Confirm → Filed; shots `c-1/c-2/c-3.png` |
| **D** | RFE response carries the adjudication ("Compliance check") badge — parity with drafts | **PASS** | badge rendered on the live RFE response (real Claude, 27s); shot `d-rfe-result.png` |
| **E** | Keyless founder calibration → the real model maps GitHub/open-source to Original contribution | **PASS** | live qualify: *Original contribution: Met — "US patent 11,902,114 … FoldX2 framework (18,000 GitHub stars, adopted…)"* |
| **F** | Under `TOKENS_BYPASS=1`, real cases still list (balance pill → ∞) | **PASS** | bypass server `/dashboard`: Priya Nair listed (was empty pre-fix); balance `∞` |

## Grounded-AI-quality priorities (the "whole ballgame" L1 deferred)

- **Qualify — real Claude, grounded path (PASS).** `source: claude`, likelihood 88, disclaimer present. The verdict named **every** supplied specific (FoldX2, RECOMB 2022, Nature Methods, Quanta, patent 11,902,114, 4,200 citations, NeurIPS, GitHub stars) and crosswalked each to the **correct** criterion. No placeholders, no fabrication. → `qualify-claude.json`
- **Draft — real Claude, grounded path (PASS).** `source: claude`, 10 sections (Intro + 8 criteria + Conclusion), persisted v1. Names the supplied evidence; the live **adjudication gate returned `attorneyReady=true`** (no fabricated specifics). The draft carried **no `(Exhibit N)` citations because the Evidence Vault was empty** — the exact PN-DRAFT-01 behavior the new "populate the vault first" nudge addresses (by-design, not a defect). → `draft-claude.json`

## L2 notes (surface-model / non-defects)

- **FAQ accordion** collapses answer text out of `innerText` (the `<details>` panels), so a naive text scrape under-reads it; the copy is server-rendered (confirmed via raw HTML). This is a **driver nuance**, not a product finding — recorded so future L2 scrapes expand the accordion or read `content()`.
- **Adjudication parity** now spans qualify + draft + RFE (all three surface the gate); the draft gate ran clean (`attorneyReady`) on a genuinely grounded letter — the fabrication scanner did **not** false-positive on the legitimately-supplied numbers (FoldX2 stars, citation counts, salary).

## Artifacts

`qualify-claude.json`, `draft-claude.json`, `regen-claude.json` (model outputs); `dash-bypass.html`, `dash-nobypass.html`, `casepage.html` (read-backs); `shots/*.png` (gitignored); `_marketing.mjs`, `_review_rfe.mjs`, `review_rfe.log` (drivers + log).
