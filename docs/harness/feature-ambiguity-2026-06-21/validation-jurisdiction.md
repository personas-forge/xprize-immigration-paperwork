# Validation & Jurisdiction Framework — Feature Scout + Ambiguity Guardian

> Context #1 · Group: Eligibility & Qualification
> Total: 5 findings

## 1. `counselApproved` is documented as "the bar for filing" but gates nothing at runtime
- **Lens**: ambiguity-guardian
- **Priority**: Critical
- **Category**: trade-off
- **File**: `src/features/qualification/validation.ts:41-42` (and `:62,86,110,133,159,184`); consumer `src/app/validation/page.tsx:224-226`
- **Observation**: The header comment (`validation.ts:13-14`), the type doc (`:41` "filing bar"), and `docs/validation-framework.md:21,26-27` all state `counselApproved` is "Required before anything is actually **filed**." Every record currently has `counselApproved: false`. A codebase-wide grep shows the flag is read in exactly ONE place — the badge on `validation/page.tsx:224` ("Counsel signed" / "Counsel pending"). No draft, sign, deliver, or filing path ever checks it. So the one property the docs call the filing gate is purely cosmetic; a case can be drafted and routed to e-sign while every program sits at `counselApproved: false`.
- **Proposal**: Either (a) wire an actual gate — a helper like `canFile(program)` that requires `counselApproved === true` and is consulted by the filing/e-sign path — or (b) if "counsel of record reviews & signs per-case" is the real model (so the per-program flag is irrelevant to filing), correct the doc and the type comment to say so and stop calling it "the bar for filing." Today the intent is unrecoverable: a future dev/auditor cannot tell whether the always-false flag is an unfinished gate or a deliberately-decorative status.
- **Value / Risk-if-ignored**: This is the central compliance claim of the product ("your attorney of record reviews & signs"). A flag that reads as an enforced filing gate but enforces nothing is exactly the kind of false-safety an auditor or opposing counsel would seize on. Resolving the intent costs little; leaving it ambiguous risks a wrong "we're gated" assumption baked into the next feature.
- **Effort**: M

## 2. Runtime staleness never blocks a program from being offered — only the CI test enforces freshness
- **Lens**: ambiguity-guardian
- **Priority**: High
- **Category**: edge_case
- **File**: `src/features/qualification/jurisdictions.ts:96-103` vs `src/features/qualification/validation.ts:280-282`
- **Observation**: `freshnessOf` / `isStale` are real runtime functions, but the only thing that consults them as a *gate* is `validation.test.ts:125-137` (against `todayIso()` at commit time). `livePrograms()` and `isLiveProgram()` — the functions `qualification.ts:112`, the API, and `/qualify` use to decide what is offered — never look at freshness. The docs promise "a market can't go live **stale**" (`docs/validation-framework.md:38-42`), but that guarantee holds only while CI re-runs. A build deployed and left running past `2026-05-30 + 180d` (≈ 2026-11-26) keeps screening and drafting O-1A/O-1B/EB-1A with a stale, un-reverified rule set, because nothing at request time consults `isStale`. The `/validation` page will correctly turn the badge red, but the product keeps selling the stale program.
- **Proposal**: Decide and document the intended contract. If staleness should actually withhold a program at runtime, have `livePrograms()`/`isLiveProgram()` (or the qualify/draft entry points) consult `isStale(validationFor(code), todayIso())` and degrade gracefully (e.g. hide or warn). If the intent is "CI is the only gate; a deployed build is assumed re-shipped within 180 days," record that assumption explicitly next to `REVALIDATE_AFTER_DAYS` so no one mistakes the red badge for an enforced block.
- **Value / Risk-if-ignored**: A stale legal rule served as current is a wrong-eligibility/legal-outcome risk — the precise failure this framework exists to prevent. The CI-only enforcement is a hidden assumption (deploys stay fresh) that nobody recorded.
- **Effort**: M

## 3. `jurisdictionFor` silently defaults unknown program codes to US — masking corrupt/legacy data
- **Lens**: ambiguity-guardian
- **Priority**: High
- **Category**: edge_case
- **File**: `src/features/qualification/jurisdictions.ts:83-88`
- **Observation**: `jurisdictionFor(programCode)` falls back to `JURISDICTIONS.US` for any unrecognized code (test at `jurisdictions.test.ts:48` pins `"nonsense" → US`). It's called on persisted/snapshot data in `src/app/c/[token]/page.tsx:51`, `case-file/components/CaseDetailView.tsx:75`, `visa/.../page.tsx:76`, and `QualifyPanel.tsx:157`. So a case whose stored `classification` is corrupt, blank, or a *planned* code (e.g. `UK-Global-Talent`) renders with the full US attorney-of-record representation note and the US `DISCLAIMER` rather than erroring or showing the correct UK/OISC text. The reasoning for "fall back to US" is undocumented — it reads as a happy-path convenience, not a deliberate decision, and it actively hides bad data behind a confident, market-specific legal disclaimer.
- **Proposal**: Make the fallback explicit and safe: return `undefined` (or a neutral "unknown jurisdiction — not offered" record) and have callers render a clear error/empty state, OR keep the US default but record *why* (e.g. "all live programs are US, so an unknown live code is US by construction") and assert the input is a live program first. At minimum, log when the fallback fires so corrupt classifications surface instead of being painted over.
- **Value / Risk-if-ignored**: Showing US representation/disclaimer text for a non-US or garbage classification is a wrong-jurisdiction legal-disclosure error. Silent defaults on legal scope are how the wrong disclaimer reaches a real applicant.
- **Effort**: S

## 4. No "what changed in the law" diff/changelog when a record is re-verified
- **Lens**: feature-scout
- **Priority**: High
- **Category**: feature
- **File**: `src/features/qualification/validation.ts:37-45` (`ValidationRecord` shape); surfaced at `src/app/validation/page.tsx:239`
- **Observation**: A `ValidationRecord` captures only the *latest* state: one `lastVerified` date, current `sources`, current `notes`. When the team re-verifies and bumps `lastVerified` (the documented cadence at `validation-framework.md:44-45`), there is no record of *what changed* — whether the 2026-11 re-check found the regulation identical or found USCIS moved the EB-1A criteria. The freshness machinery (this whole context) exists precisely because immigration rules drift, yet the framework keeps no history of the drift it's tracking. An attorney of record signing off, or an applicant trusting the "verified" badge, can't see the provenance of a change.
- **Proposal**: Add a lightweight `history?: { date: string; change: string }[]` (or a sibling changelog keyed by subject) recorded at each re-verification, and render a collapsible "Verification history" under each card on `/validation`. Even a one-line "2026-11-26: re-checked vs eCFR, no change" per pass turns the date bump into an auditable trail — directly reinforcing the framework's own "makes staleness auditable" goal.
- **Value / Risk-if-ignored**: Provenance of legal correctness is a real differentiator for a "we keep each state correct" product and is exactly what an attorney of record (and a skeptical applicant) wants before relying on it. Without it, every re-verification erases the prior basis and the audit story is "trust the current date."
- **Effort**: M

## 5. UK Global Talent is fully modelled and rendered but unreachable — finish the gate or surface a waitlist
- **Lens**: feature-scout
- **Priority**: Medium
- **Category**: user_benefit
- **File**: `src/features/qualification/jurisdictions.ts:65-77`; rendered at `src/app/validation/page.tsx:76-80`
- **Observation**: The UK jurisdiction is a first-class entry (representation role, OISC/SRA note, dedicated `UK_DISCLAIMER`, a `UK-Global-Talent` pack, and a `needs-review` validation record with a detailed endorsement-model lesson). The `/validation` page already renders the UK block with a "Planned" badge to every visitor. But there is zero path forward for an interested UK applicant — no waitlist, no "notify me," no email capture. The honest model-mismatch write-up is great transparency, yet the visible "Planned" surface dead-ends.
- **Proposal**: Add a small "Notify me when UK Global Talent opens" capture on the UK block (and/or anywhere "Planned" is shown), persisting interest. It quantifies UK demand to justify the endorsement-workflow build the docs already scope (`validation-framework.md:74-81`), and converts the transparency page from a static disclosure into a lead/validation signal. Keep it strictly informational — no eligibility claims for the un-offered market.
- **Value / Risk-if-ignored**: The product already pays the cost of showing UK as "coming" but captures none of the demand it advertises; a waitlist is the cheapest possible way to decide whether the (non-trivial) UK endorsement build is worth it. Risk if ignored: continued guesswork on the next-market decision and zero credit for the transparency already on the page.
- **Effort**: S
