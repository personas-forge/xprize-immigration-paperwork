# Wave D — Dead Code & Dead Infrastructure (Theme E)

Branch `vibeman/code-refactor-2026-06-29`, on top of Waves A–C. Each deletion was
re-proven dead with a fresh whole-repo grep (absolute path) before removal.
Behavior-preserving (only unreachable code removed). Gates green throughout:
`tsc --noEmit` clean, `npm test` = **443 pass / 0 fail** (unchanged from baseline —
no test was deleted or weakened).

## Closed (8 findings)

| # | Finding | Commit | What & grep proof |
|---|---------|--------|-------------------|
| 1 | token-economy-ledger #1 (HIGH) | `ccbd570` | Deleted dead `insufficientResponse` 402 builder in `guard.ts`. Grep: zero callers — only its own def + one stale **untracked** `docs/plans` note. Live 402 path is hand-built in `operation.ts` (with the UPL `disclaimer` this copy dropped). |
| 2 | authentication-session #1 | `733c83a` | Simplified `authProvider()` to `isFirebaseConfigured() ? "firebase" : null` (the `explicit`/`NEXT_PUBLIC_AUTH_PROVIDER` branch was a no-op). Removed the misleading knob + comment from `.env.example`. `authProvider()` itself is LIVE (middleware/login/session) — only the dead branch + env read went. |
| 3 | brand-design-system #3 | `6ac31df` | Deleted `stampIn` Variants from `motion.ts` + trimmed header comment. Grep: zero source consumers (only motion.ts + READMEs/harness docs). `easeArrival`/`fadeUp`/`Variants` import all stay (used by `Rise`). |
| 4 | brand-design-system #4 | `a15533d` | Removed the `indigo` ("official stamp blue") ramp end-to-end: `globals.css` (`:root`+`[data-theme=ink]`), `tailwind.config.ts` token, `themes.ts` (×4), `palette.ts` (PALETTE+INK_PALETTE), and `Stamp` `indigo` tone. Grep `indigo` over `src` returned ONLY definitions — no `text-/border-/bg-indigo`, `var(--indigo)`, or `<Stamp tone="indigo">` consumer. |
| 5 | llm-evaluation-harness #3 | `58af14c` | Deleted orphaned `scripts/llm-eval/smoke.ts` (subsumed by `run.ts`). Grep: no importer, no npm script — only stale comment mentions in `README.md`, `run.ts`, `e2e/engine.ts`, all updated to not cite it. |
| 6 | attorney-review-filing #1 | `187ca4b` | Replaced local `CLASSIFICATIONS` in `saved-cases.ts` with the already-imported `VISA_CLASSIFICATIONS` from `@/features/case-file/types`. One-line, zero behavior change. |
| 7 | marketing-site #5 | `f22a9f0` | Removed dead `PRO_PRICE_CAPTION` `: "$48 for 8,000 tokens"` fallback in `PassportLanding.tsx`. `"pro"` is a permanent featured catalog entry, so `.find` never returns undefined; caption stays fully derived. |
| 8 | evidence-vault #5 (partial) | `dbdebca` | Dropped genuinely-unused `type Bucket` / `type CategorizeResult` barrel re-exports from `evidence/index.ts` (grep: zero importers; both used only internally in `evidence.ts`). |

## Deferred (with reason)

- **domain-event-bus #1 (HIGH) — provenance ledger write-only.** DEFERRED as a
  **product decision**, per wave instructions. `getProvenanceChain`/`verifyChain` have
  no production caller (grep: only `index.ts` + `provenance.test.ts`), but the ledger
  is live infrastructure (`registerProvenanceLedger` runs on every domain event). Removing
  it deletes a latent tamper-evident audit/compliance capability on an immigration
  SaaS. **Decision needed:** ship a consumer (a small auth-gated `GET /api/audit/pack`
  that returns `getProvenanceChain()?.records()` + a `verifyChain` result — turning it
  into live, inspectable audit infra) **vs.** stop registering the ledger in
  `getDomainBus()`. Left untouched.

- **domain-event-bus `registerAuditLog` / `AuditSink` / `defaultSink`.** DEFERRED.
  Grep shows `registerAuditLog` is imported only by `subscribers/subscribers.test.ts`
  (test-only); `AuditSink`/`defaultSink` only by their own module. Per the wave's golden
  rule (a symbol whose only consumer is a test is NOT safe to delete here — removal would
  require editing/deleting a test), these stay. Its one live export `toAuditRecord`
  (consumed by `provenance.ts`) is unaffected. Tie its fate to the #1 decision above.

- **evidence-vault #5 — `DISCLAIMER` / `O1A_CRITERIA` barrel re-exports.** DEFERRED.
  Grep: the only consumer of evidence's re-exports of these two is `evidence.test.ts`
  (production imports `DISCLAIMER` from `@/lib/result` and `O1A_CRITERIA` from
  `@/features/qualification` directly). Removing them from the barrel would break — and
  require editing — a test. Per the golden rule, left in place. Only the truly-unused
  `Bucket`/`CategorizeResult` type re-exports were removed (#8 above).

## Notes / things worth your attention

- **Stale untracked doc not fixed:** `docs/plans/feature-roadmap-2026-06-13.md:67` still
  references `guard.ts insufficientResponse`. `docs/plans/` is explicitly on the
  "leave untracked" list, so I did not edit/commit it. The claim there is now doubly
  stale (the symbol is gone).
- **READMEs left as-is:** `README.md` / `README_work.md` still list `stampIn` (and the
  already-deleted-in-Wave-2026-06-23 `staggerParent`) in the motion section. These are
  pre-existing doc drift the prior wave deliberately left; updating only `stampIn` would
  be inconsistent and is out of this wave's code-deadness scope. Flagging for a future
  docs pass.
- **No surprises in the greps** — every "expected dead" symbol was confirmed dead. The
  one thing worth recording: evidence-vault findings #1 (`asObjectBody`) and #3 (`str`)
  were **already resolved** by an earlier wave (`evidence.ts` now imports both from
  `@/lib/validation`), so only #5 remained in that report.
</content>
</invoke>
