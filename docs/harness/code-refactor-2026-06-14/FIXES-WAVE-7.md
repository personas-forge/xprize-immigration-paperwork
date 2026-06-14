# Code Refactor — Fix Wave 7 — Money-path + engine-mirror + misc

> 5 commits, 6 findings closed (4 high + 1 med, + the e2e half of an H). Final wave.
> Baseline preserved: tsc 0→0; tests 281→278 pass / 0 fail (−3 = removed dead-code
> tests); **`next build` compiled successfully**; lint clean.

## Commits

| # | Commit | Finding(s) | Severity | Risk |
|---|---|---|---|---|
| 1 | `417f05a` | checkout #1 | H | 🟢 dead metadata field |
| 2 | `29fd174` | checkout #3 | M | 🟠 money path (refund parity) |
| 3 | `(OPERATIONS)` | token-economy #1 | H | 🟢 dead export |
| 4 | `(getAnalytics)` | event-bus #1 | H | 🟢 dead path |
| 5 | `(engine drift)` | llm-eval #1, #2 ≡ llm-engine #1 | H | 🟢 harness-only |

## What was fixed

1. **Dropped the dead `tokens` field from checkout metadata.** The webhook reads only `userId` + `bundle` and re-derives the credited amount from the server-side `Bundle.tokens`; the echoed `tokens` was an attacker-influenceable second source of truth on the money path. Removed → `Bundle.tokens` is the single source.
2. **Mirrored the paid-path bundle resolution on the refund clawback.** The refund branch resolved the bundle by `metadata.bundle` only, so a refund payload missing it silently skipped the clawback while the purchase was credited via the product-id fallback. Added the `bundleByProductId` fallback (additive; idempotency key + signature untouched). *Money path — flagged for sandbox verification.*
3. **Removed the dead `OPERATIONS` export** from economy.ts (no production consumer; only a self-referential test). The still-used `OP_COST`/`costOf`/`OpTier` back-compat shims stay.
4. **Removed the dead `getAnalytics` + analytics subscriber path.** `getAnalytics()` was the only reader of the collector's counts and nothing called it; with no track sink it counted into an unreadable closure — dead end-to-end (unlike audit/attorney-notify, which log via console sinks). Removed the accessor, the wiring, `analytics.ts`, and its tests.
5. **Stopped the harness engine copies drifting from canonical.** Ported the `child.stdin.on("error", reject)` guard to the eval engine (it had drifted and could hang ~180s on Claude-CLI auth failure — the bug client.ts already fixed); and made `e2e/engine.ts` derive `EXPECTED_SOURCE` from the canonical `resolveEngine()` instead of re-stating the precedence (so the specs can't assert a stale source after an engine-rule change).

## Scoped out / deferred (honest)

- **engine shared-core extraction (the fuller llm-eval #2 / llm-engine #1 fix)** — extracting a `server-only`-free engine core that both `client.ts` and the harness import would refactor the **production model-call path**; deferred to its own change with coverage. The targeted drift fixes above close the concrete harms.
- **marketing #1 (retired flat-fee pricing copy, H) + #3 (landing-claude content) + #4 (`/pricing`→`/billing` links)** — the whole **pricing surface** needs a product/copy decision (token model vs flat-fee). **Flagged for the user.** Repointing links piecemeal while the content decision is pending would be inconsistent.
- **eligibility #2 (CriteriaReport hardcodes threshold=3, H)** — a *latent correctness* item (masked today because all live packs = 3); behavior-adjacent, better verified by a bug-hunt/test pass than a refactor wave.

## Verification

| Gate | After Wave 6 | After Wave 7 |
|---|---|---|
| `tsc --noEmit` errors | 0 | 0 |
| tests pass / fail | 281 / 0 | 278 / 0 |
| `next build` | PASS | PASS |
| lint (touched files) | clean | clean |

---

# FINAL CLOSE-OUT — code-refactor campaign (7 waves)

| Wave | Theme | Findings closed | Commits |
|---|---|---:|---:|
| 1 | Dead-code deletion | 7 | 7 |
| 2 | Disclaimer / UPL single source of truth | 6 | 5 |
| 3 | LLM parse/coercion consolidation | 6 | 3 |
| 4 | Adapter migration (ADR-0010) | 7 | 5 |
| 5 | Orchestrator adoption (ADR-0004) | 3 + critical | 4 |
| 6 | UI chrome de-duplication | 3 | 3 |
| 7 | Money-path + engine-mirror + misc | 6 | 5 |

**~38 of 88 findings closed; the lone CRITICAL substantially addressed; 1 false positive rejected; 4 items intentionally kept/deferred with rationale.** Every wave: tsc 0, tests green (298→278, the drop entirely deleted dead-code tests), `next build` PASSES, lint clean, 0 regressions. Branch `refactor/code-refactor-2026-06-14`, off `main`, not pushed.

## What the campaign achieved
- **Two architectural migrations driven home:** ADR-0010 (every case-scoped call now gates through the single `resolveCase` seam — no inline gate copies remain) and ADR-0004 (4/5 charged routes now on `executeAiOperation`, the money-path invariants centralized + tested).
- **Single sources of truth restored:** the UPL disclaimer, the LLM section-parse, the token-cost registry, the engine-selection rule.
- **Money-path hardening:** dead attacker-influenceable checkout metadata removed; refund clawback brought to parity with the credit path.
- **~900+ lines of dead/duplicated code removed** across the app.

## Open / flagged for the user
1. **Pricing surface (product decision):** homepage + landing-claude advertise retired flat-fee pricing while `/billing` sells token bundles. Needs a copy call (marketing #1/#3/#4).
2. **draft-route orchestrator migration** (ai-orchestrator #1 remainder) — the two-path route; do with route-test coverage.
3. **engine shared-core extraction** — refactors the production LLM client; own change + coverage.
4. **Long tail (~40 M/L misc findings)** still open in the INDEX — criteria-table merge, createPersistentValue, eligibility threshold (latent), validation/attorney-review/consent structural dups, etc. Acceptable to leave; pick up per-theme as needed.

The branch is review-ready. Merge when satisfied, or run a focused follow-up (the pricing decision, the draft migration, or a bug-hunt pass on the latent-correctness items).
