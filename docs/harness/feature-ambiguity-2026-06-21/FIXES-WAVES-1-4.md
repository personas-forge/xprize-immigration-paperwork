# Feature-Scout + Ambiguity-Guardian — Fix Waves 1–4 (correctness/clarity)

> 25 findings closed across 4 themed waves · 23 fix/doc commits on branch
> `vibeman/feature-ambiguity-2026-06-21` (off `main`).
> Gates GREEN throughout: **tsc 0 · tests 409 → 427 · next build PASS.**
> All 6 criticals + the 19 highs in scope are closed.

---

## Wave 1 — Legal truthfulness & UPL guardrails (7 findings, 3 criticals)

| Finding | Sev | Commit | What changed |
|---|---|---|---|
| guidance #1 | 🔴C | `a12b8a8` | UPL-flagged guidance text is now WITHHELD server-side (new orchestrator `onBlocked` hook → reclaim + advice-free mock), not just badged |
| marketing #1 | 🔴C | `e4ef851` | The "§ Live" petition stepper reframed as "§ Illustrative" self-serve flow (your own attorney reviews/signs/files; no managed voice interview / "we e-file") |
| validation #1 | 🔴C | `1834d9b` | `counselApproved` documented as a per-program readiness STATUS, not the per-case filing gate (which is the attorney review/e-sign workflow) — across type/doc/page |
| validation #2 | H | `1834d9b` | Runtime-staleness contract recorded (CI is the hard gate; runtime doesn't withdraw a verified-but-overdue program) + `stalePrograms()` + honest /validation banner |
| validation #3 | H | `dec4b42` | `jurisdictionFor` warns on an unrecognised code instead of silently painting US representation/disclaimer over corrupt data |
| marketing #3 | H | `819e5bd` | The "$8,000–$15,000" firm-fee anchor centralized into one hedged, dated `FIRM_FEE` constant; all 3 surfaces driven from it ("commonly quote") |
| drafting #2 | H | `e8d5a7a` | Unresolved `(Exhibit N)` citations now FAIL the live adjudication gate (attorneyReady=false) server-side, not advisory-only — new `exhibitCitationGate` |

## Wave 2 — Money & metering integrity (6 findings)

| Finding | Sev | Commit | What changed |
|---|---|---|---|
| checkout #1 | H | `5d2591d` | Refunds claw back PROPORTIONALLY to the refunded amount, not the full bundle (a $5 partial no longer wipes 30k tokens); order-id dedup kept |
| token-economy #2 | H | `67ace81` | One canonical `isMeteringEnforced()` — killed the 3-way disagreement (Firestore prod showed "∞" while charging); guard + billing + isMeteringBypassed all derive from it |
| ai-orchestrator #1 | H | `3e1e4f3` | A client `Idempotency-Key` folds into the ledger ref (user-scoped) so a retry de-dupes the charge — no double-billing on draft/rfe |
| rfe #3 | H | `4b4fe17` | The "5 tokens" button labels now derive from `costOf("rfe")`/`costOf("draft_section")`, not literals |
| rate-limit #4 | H | `fab7590` | The anonymous-preview cap centralized into one documented `PREVIEW_RATE_LIMIT` (was two route-local `30`s) |
| token-economy #3 | H | `55af810` | Documented the debit-idempotency contract (account-row lock + in-tx seen-check together, not the index alone) on the PGlite charge path |

## Wave 3 — Access control & consent integrity (6 findings, 2 criticals)

| Finding | Sev | Commit | What changed |
|---|---|---|---|
| auth #2 | 🔴C | `ab958e2` | `isAttorney` fails CLOSED in production when `ATTORNEY_EMAILS` is empty (demo unlock is dev-only) + warns once |
| consent #1 | 🔴C | `8e240d6` | `CONSENT_VERSION` is now derived from an ordered in-repo `CONSENT_VERSIONS` history; an env override outside the history is rejected (warn + fall back) |
| evidence #1 | H | `1c70d70` | Categorize re-derives `classification` server-side from the gated case, not the client body (no wrong-pack bucketing) |
| data-adapter #1 | H | `2aab6e6` | Case-LIST reads routed through the adapter seam; the review-queue IDOR gate MOVED into `listReviewQueue` (forbidden unless attorney/ops) |
| consent #4 | H | `98dcc4c` | Version-only re-consent intent recorded + deterministic Firestore `getLatestConsentVersion` (max version string, immune to the 0-timestamp race) |
| consent #3 | H | `5830b0b` | The free signup grant is gated on a verified email (`emailVerified` plumbed onto AppUser) — closes the multi-account farming vector |

## Wave 4 — Reliability & durability (6 findings)

| Finding | Sev | Commit | What changed |
|---|---|---|---|
| llm-engine #1 | H | `d0638b6` | Per-tier timeout on the Gemini call (fast 60s / long 120s) — a hang now rejects → reclaim + mock instead of pinning a charged route |
| llm-engine #2 | H | `d0638b6` | Bounded retry-with-jittered-backoff for TRANSIENT Gemini errors (429/5xx/network); auth/safety not retried |
| llm-engine #3 | H | `9d635f8` | Documented the output-guard contract: non-blocking, observability-only; JSON validity enforced downstream by `spec.guard`; 50k rationale recorded |
| event-bus #3 | H | `7123f1a` | Recorded the bus delivery contract (best-effort / at-most-once; persisted row is authoritative; at-least-once needs an outbox) |
| data-adapter #2 | H | `4d77b28` | Evidence vault is now SOFT-DELETE (deleted_at/deleted_by both drivers) + `restoreDocument` — accidental loss of filed legal evidence is recoverable + audited |
| data-adapter #3 | H | `c27310c` | Documented + pinned (2 tests) the `resolveCase` store-vanished re-probe decision (admin-init-flap window → 503 not a wrong 403) |

---

## Pattern catalogue (durable, extracted across the 4 waves)

1. **Badge-without-block** — a safety signal (UPL gate, unresolved exhibit citation) that is computed and *shown* but never *enforced* leaves the offending output reaching the client / saving / filing. Wire the signal into a server-side gate (orchestrator `onBlocked`, adjudication `fail`), not just a UI badge.
2. **One-axis-decided-three-ways** — when "is X enabled?" (metering) is answered by three different predicates, they WILL disagree on an edge config (Firestore-prod / no DATABASE_URL). Collapse onto ONE canonical, injectable predicate; add a regression test for the divergent shape.
3. **Per-call ledger ref defeats idempotency** — a ledger that dedupes by `ref` is useless if the ref is minted fresh per call. Let the client supply an idempotency key (validated, user-scoped) and fold it into the ref.
4. **Magic copy that should be derived** — money/price strings hardcoded in UI ("5 tokens", "$8k–15k") drift from the registry/economy. Drive them from the single source (`costOf`, a centralized constant) so the button can't lie.
5. **Fail-open demo-unlock twin** — a permissive `isAttorney` next to a strict `isConfiguredAttorney` is one autocomplete from reopening an IDOR. Make the permissive twin fail-closed in production + warn.
6. **Free-floating compliance version** — a UPL/consent version string with no recorded history silently drifts. Make it a release artifact (ordered list + membership check + fail-fast on an unknown override).
7. **Trust-the-client classification** — re-derive any authority-bearing field (visa classification) from the resolved server-side record, never echo the request body for a case path.
8. **Gate-at-the-call-site** — a cross-tenant read gated only in a page component (not the data seam) leaks the moment a second surface forgets the check. Move the policy INTO the adapter.
9. **Unbounded upstream call** — one engine timeout-guarded, the other not, is an asymmetry that hangs a charged route forever. Bound every model call by a deadline that rejects into the existing reclaim+mock path; add transient-only retry.
10. **Unstated delivery / failure contract** — fire-after-commit eventing, a re-probe heuristic, a non-blocking guard: each is fine but MUST record its guarantee (at-most-once, what it defends, why non-blocking) or the next dev mis-relies on it. Pin with a test where behavior matters.
11. **Hard-delete of legal artifacts** — for an evidence vault an attorney signs, a DELETE is irreversible loss. Soft-delete (deleted_at/deleted_by) + restore; the never-reused ordinal makes restore safe.

---

## What remains (deferred — feature waves W5–8 per INDEX)

- **W5 Attorney workflow & filing safety**: real attorney notification channel (event-bus #1 Critical), sign-and-file draft/exhibit guard, RFE/Denied deadline tracking, queue-age submit-time, real e-sign/USCIS receipt.
- **W6 Drafting/screening deliverables**: letter export on happy path, RFE/draft version history, PDF/image upload, resumable screening, EB-1A higher-bar surfacing, guidance history.
- **W7 Case-file honesty + design primitives**: real-case eligibility read-out, Toast/Modal primitives, z-index scale, adjudicate-skip-on-mock persist contract.
- **W8 Billing/account UX + observability + eval**: ledger history view, receipts page, recurring-bundle subscription affordances + portal, social proof, GDPR export + account deletion, limiter abuse alerting, eval baseline + qualify-temperature parity.
- **Smaller follow-ups noted in commits**: EvidenceVault undo affordance (soft-delete UI), disposable-domain rejection on the grant, the marketing social-proof band.

> ⚠ Verify before merge: the proportional-refund clawback against a real Polar partial refund; the Gemini timeout/retry against a live key. The PGlite soft-delete columns are added via idempotent ALTER on init; Firestore is schemaless (no migration).
