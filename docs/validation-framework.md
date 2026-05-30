# Validation framework — proving each state is correct

"Is what we're doing correct for this jurisdiction/program?" is a **tracked,
cited, dated** property — not an assumption. Every state the app offers must be
validated against primary sources, and CI refuses to let an unvalidated program
go live.

## The record

Each program and each load-bearing compliance claim has a `ValidationRecord`
(`src/features/qualification/validation.ts`):

| field | meaning |
|---|---|
| `status` | `verified` (confirmed vs primary sources) · `provisional` · `needs-review` |
| `legalBasis` | the statute/regulation it rests on |
| `threshold` | criteria count, when applicable (e.g. "3 of 8") |
| `sources` | titles + URLs, tagged `primary-law` / `agency-guidance` / `court-order` / `secondary` |
| `lastVerified` | yyyy-mm-dd of the last check |
| `verifiedBy` | who/what verified it |
| `counselApproved` | attorney/adviser of record sign-off — the bar for **filing** |

### Two layers of correctness
- **`status: "verified"`** — matches the **primary sources**. This is what the
  team (and CI) can establish via research. **It is not legal advice.**
- **`counselApproved`** — the licensed attorney/adviser of record has signed off.
  Required before anything is actually **filed**. Tracked separately.

## The CI gate

`validation.test.ts` (runs in the CI `verify` job) enforces:
- every program has a `ValidationRecord`;
- **every LIVE program is `verified`, records its threshold, and cites a
  primary-law or agency-guidance source** — so a market can't go live without
  being validated;
- the US compliance claims (`us-federal-practice`, `us-arizona-abs`) are verified
  and cited;
- freshness math (`isStale`) is correct.

**Cadence:** re-verify every ≤ `REVALIDATE_AFTER_DAYS` (180) or on any regulatory
change; bump `lastVerified`. `lastVerified` makes staleness auditable.

## Per-state validation checklist (run this when adding a market/program)

1. **Legal basis** — the statute/regulation. Primary source.
2. **The model** — is it a criteria-count ("N of X"), a points system, or an
   **endorsement** model? Get this right *before* the values. *(See the UK lesson
   below — the model itself can be wrong, not just the numbers.)*
3. **Criteria set + threshold** — verbatim, in order; compare to the pack in
   `packs.ts`.
4. **Who may represent** — the regulator (US state bar / UK OISC or SRA /
   Canada CICC-RCIC / Australia OMARA). Gate sign-off on it.
5. **Business-structure legality** — fee-sharing / non-lawyer ownership rules.
6. **Fees & processing** — only if the product states them.
7. **Disclaimer wording** — market-appropriate; wire `jurisdiction.disclaimer`.
8. **Data/privacy regime** — GDPR/UK-GDPR, PIPEDA, etc.

## Source hierarchy
Primary law (statute / CFR / Immigration Rules) **>** agency guidance (USCIS
Policy Manual, GOV.UK) **>** court orders **>** reputable secondary. Never rest a
`verified` status on a blog or marketing page alone.

## The research loop (how to use web search to validate)
1. Search the **primary source** (regulator/eCFR/GOV.UK), not summaries.
2. Fetch the verbatim text.
3. Compare to the code (`packs.ts` / `jurisdictions.ts`).
4. Record citation + `lastVerified` + `status`; fix any discrepancy in code.
5. Route to counsel → set `counselApproved` before filing.

## Worked example — the UK lesson
The first validation pass flagged that **UK Global Talent is endorsement-based**
(a designated endorsing body assesses leader/potential-leader status, plus a
prize route) — **not** a fixed "meet N of X criteria" checklist like the US
programs. The `UK-Global-Talent` pack modelled it as a criteria-count, which is
the **wrong model**. It is recorded `needs-review` and gated `planned` (never
offered), and a real UK build must implement an **endorsement workflow**, not a
criteria pack. This is exactly the class of error the framework exists to catch.

## Current state (validated 2026-05-30, against primary sources; counsel sign-off pending)
- **O-1A** ✓ 3 of 8 — 8 CFR 214.2(o)(3)(iii)
- **O-1B** ✓ 3 of 6 — 8 CFR 214.2(o)(3)(iv) (labels paraphrased)
- **EB-1A** ✓ 3 of 10 — 8 CFR 204.5(h)(3) (exact set/order match)
- **US federal practice** ✓ any-state bar, nationwide — 8 CFR 1001.1(f) / 1.2
- **Arizona ABS** ✓ — AZ Sup. Ct. R-20-0034 (eff. 2021-01-01)
- **UK Global Talent** ⚠ needs-review — endorsement model mismatch (gated planned)
