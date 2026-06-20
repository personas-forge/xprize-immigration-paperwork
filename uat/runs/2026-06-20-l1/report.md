# L1 report — Immigration Concierge · 20-Character UAT sweep · 2026-06-20

Cert level: L1 (theoretical, code-grounded). Full depth + value ledger + strengths + L2 targeting + reconciliation sweep in [SUMMARY.md](./SUMMARY.md).

## Headline scorecard

| Metric | Value |
|---|---|
| Characters | 20 (8 segments) |
| Journeys walked | 74 |
| Per-journey verdict | 48 L1-pass / 26 L1-conditional / 0 L1-fail |
| Findings | ~170 (~70 strengths); 1 blocker, ~7 distinct major roots, ~55 minor |

Zero structural failures. Conditionals cluster on three reachable surfaces: the keyless preview/best-path, the DraftStudio O-1A copy, and ops/attorney queue-age + reachability.

## Impact-ranked backlog (top items — by frequency x reachability x trust_erosion)

1. **T1 (major)** — Best-path/keyless picks the visa path with a keyword mock, no model, no reasoning; under-scores composer/chef/director/designer/athlete/EB-1A and gives EB-1A no higher-bar candor. `best-path.ts:75-98,119-135`. 15 reporters.
2. **T3 (major)** — SCHOLARLY regex includes "conference" -> a talk scores "Scholarly: Met", inflating the keyless count -> false "Meets threshold" on the first screen. `packs.ts:71-76`. (kw-qualify-01, WZ-QUAL-01.)
3. **T4 (minor, outranks the blocker)** — DraftStudio hardcodes "Draft a full O-1A petition letter" on every non-O-1A case. `DraftStudio.tsx:374`. All 7 non-O-1A Characters flagged it.
4. **T2 (major)** — Queue-age badge + oldest-first sort read createdAt, not time-in-queue, so a just-submitted old case reads red "overdue"; no aging signal/role reachable for ops; non-navigable filtered rows. `pglite-store.ts:433,501`, `review/page.tsx:35`, `CaseList.tsx:246`.
5. **T5 (major-chef/minor)** — Landing positioning is tech-only; arts/culinary/athletics excluded, EB-1A invisible on /. `page.tsx:125,154,133`, `landing-claude/page.tsx:59-62`.
6. **T6 (blocker, segment-confined)** — FAQ asserts AES-256/TLS/hard-delete/no-train that nothing in code backs; no privacy/terms/DPA page. `faq/page.tsx:55`, `export.ts:33`. (PO-EVAL-01.)

(T7 fabrication-gate-numbers-only, T8 disclaimer/verdict-framing parity, and the full 11-row backlog with all reporters + fixes are in SUMMARY.md §3.)

## What passed (strengths worth protecting)

- Pack-correctness threaded end-to-end (O-1A 8 / O-1B 6 / EB-1A 10) with runtime gates that HARD-FAIL a wrong criteria count, a leaked visa code, or a missing/altered disclaimer (`packs.ts:90-168`, `adjudication-gates.ts:135,204,227,244`).
- Citation discipline + visible AdjudicationBadge; auditCitations quarantines hallucinated (Exhibit N) (`drafting.ts:160,593-608`).
- "None" never renders green and never counts to threshold (single classifyStatus, `criteria.ts:27-95`).
- Share-token privacy + tamper-resistance (no profile text, DB-free, count-mismatch rejection, `letters-patent.ts:69-102`).
- Canonical non-drifting pricing; primary-source validation page (8 CFR, USCIS Policy Manual, AZ ABS) with a CI freshness gate.
- RFE/section-regenerate grounding landed (prior G1.1/G1.2); two-step Sign & file + atomic compare-and-set; attorney RBAC fail-closed.

## Reconciliation sweep (cross-surface) — summary

- (a) Classification label: MISMATCH — DraftStudio copy + file-number prefix say "O-1A"/"O1-" on non-O-1A cases; every functional surface is correct (T4).
- (b) Verdict framing: MISMATCH — share cert stamps declarative "Qualifies" vs in-app hedged "criteria supported / Meets threshold" (SI-QUAL-01).
- (c) Criteria-pack identity: CONSISTENT — no surface leaks the O-1A 8 into a non-O-1A case; the only residue is cosmetic copy.
- (d) Keyless-mock vs real-model: MISMATCH, partially disclosed — cold and authed screens can disagree; disclosed on the hero, undisclosed on best-path and on any hero-minted share token (T1/T3).

Full reconciliation detail with file:line in SUMMARY.md.
