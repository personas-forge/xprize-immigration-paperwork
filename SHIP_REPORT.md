# Ship report — Immigration Concierge (2026-07-02)

## Verdict: READY TO SHIP (bar: public launch with real payments), subject to three launch conditions

1. **Counsel sign-off** on `/terms` and `/privacy` (both pages are complete drafts grounded in actual product behavior, stamped "pending review by counsel").
2. **Live Vercel deploy + probe** (runbook below) — the config, runbook, and prod-build smoke are green locally; an actual deploy needs the operator's account.
3. **One real Polar sandbox purchase** through checkout on the deployed URL (the webhook credit path is signature-verified and fully tested with simulated signed payloads; only the hosted-checkout leg is unverified).

Everything the codebase itself can prove is proven, twice: **two consecutive
all-green verification gates** (Gate M7 and Gate #2, both 2026-07-02).

## Scorecard (evidence from the final two gates)

| # | Dimension | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Build & types | 🟢 | `npm run typecheck` / `npm run lint` / `npm run build` exit 0, both gates |
| 2 | Functional completeness | 🟢 | 25 UAT journeys + 7 e2e + 8/8 prod-smoke cover every advertised surface; filing copy matches reality (attorney files; studio records — demo receipts explicitly labeled); sample dashboard demarcated from real cases |
| 3 | Tests | 🟢 | `npm test` 511/511, 0 skipped — includes real-PGlite money kernel (debit/credit idempotency, boundary refusal, concurrent-charge single-winner), CAS filing transitions, charge-guard matrix, webhook field parsing |
| 4 | Simulated UAT | 🟢\* | `npm run uat` 25/25 against metered PGlite + deterministic engine: signup grant, exact per-op debits, failure-reclaim, paywall-no-debit, purchase credit + idempotent replay, proportional refund, vault, attorney filing, RFE studio + rescue, account, idempotent retries, hostile persona. \*Auth journeys run on a dev server — dev-auth is hard-gated out of production builds by design; the production build is separately smoke-tested (below) |
| 5 | Billing value | 🟢\* | A2 (debit = listed price, artifact delivered + persists, failure nets zero) and A3 (zero-balance block w/ no debit, credit unblocks) machine-verified; four production money bugs found & fixed this loop (client retry double-charge, billed mock on missing LLM key, full-bundle clawback on partial refunds, dead revenue relay). \*Live hosted checkout = launch condition 3 |
| 6 | Auth & security | 🟢\* | Deny-all Firestore rules match the admin-only architecture; fail-closed attorney gating; signed webhook; `TOKENS_BYPASS`/dev-auth hard-gated out of prod (test-pinned); unauthenticated probes green on the prod build (dashboard→login, 401 export). \*Accepted limitation: unsigned share certificates (below) |
| 7 | UX/UI polish | 🟢 | 47-screenshot sweep at 375px+1440px vs checklist; 3 ship-blockers fixed and re-verified (content readable even with JS disabled; billing stamp; signed-out balance); branded 404/error/global-error; mobile menu |
| 8 | Ops readiness | 🟢\* | `/api/health` config probe; client-error beacon → structured server log; env vars fully documented (`.env.example` is authoritative); `vercel.json` + `maxDuration` on AI routes; `firebase.json` makes rules deployable; `npm run smoke:prod` 8/8. \*Live deploy = launch condition 2 |

## What a user gets for their money (verified per-operation)

| Operation | Tokens | Verified delivery |
|---|---|---|
| Evidence categorization | 1 | Doc classified + facts extracted, persisted to vault with exhibit number; free re-file/undo; free save-rescue on persist failure |
| Form-field guidance | 1 | Disclaimed informational text |
| Qualification screening | 3 | Scored criteria + likelihood; creates a persistent case |
| Best-path ranking | 3 | All live programs scored + recommendation |
| Section regenerate / critique | 5 | Regenerated section persisted / per-section redline |
| RFE response | 5 | Response sections persisted; free save-rescue |
| Full petition draft | 12 | Complete letter, persisted, survives reload |

Invariants proven end-to-end: failures never net-charge (auto-reclaim), a lost-response retry debits **once** (client idempotency keys + ledger de-dupe), the paywall blocks without debiting, purchases credit exactly once (replay-safe), refunds claw back proportionally, signup grant mints once. Bundles: 500/$5 · 2,000/$15 · 8,000/$48 · 30,000/$150 · monthly 2,500/$19.

## Journeys verified (all in `e2e/uat/`, `npm run uat`)

uat-01 signup→qualify→draft (+ forced-failure reclaim) · uat-02 spend-down→402→paywall→signed purchase→replay→refund→forged-sig→unmapped-product · uat-03 vault→tracking→guidance→attorney draft/submit/queue/sign&file→RFE studio→decision→account export/prefs/delete-guard→RFE save-rescue · uat-04 idempotency (header validity, lost-response single debit) · uat-05 hostile (oversized, malformed, double-fire, mid-flight navigation). Plus `npm run e2e` (keyless public funnel) and `npm run smoke:prod` (production build: landing, health, branded 404, auth gating, anonymous preview, /terms, /privacy).

## Known limitations (accepted at CP1/CP2)

- **USCIS filing is a recorded pilot step** — the attorney files outside the tool; the studio records receipt/decision. All copy says so; demo receipts are explicitly labeled. Real e-file/DocuSign are roadmap (env vars parked in `.env.example`).
- **Share certificates (`/c/[token]`) are unsigned** and could be forged for impersonation (no data access). Accepted for v1; fix = server-side signed mint (backlog #23).
- **Rate limiter is per-instance in-memory** — fine single-instance; multiply-by-N under horizontal scaling (backlog #30).
- **Firestore driver lacks direct tests** (needs emulator); it implements the same Store contract pinned against PGlite, and prod behavior is guarded by the deny-all-rules + admin-only design.
- Polish, non-blocking: landing fee chart renders label-only at 375px (#33); chapter numerals repeat across pages (#34).
- `.env.local` and `.gcp/` on the dev machine hold real sandbox credentials (gitignored, never committed) — rotate if ever exposed.

## Deploy steps + live-payment switch

1. `vercel link` + import; set env per README ("Building & deployment"): `NEXT_PUBLIC_FIREBASE_*`, `GEMINI_API_KEY` (+`GEMINI_DRAFT_MODEL` for the premium tier), `POLAR_ACCESS_TOKEN/WEBHOOK_SECRET/PRODUCT_*`, `ATTORNEY_EMAILS`, `NEXT_PUBLIC_SITE_URL`; service-account JSON for Firestore. Leave `TOKENS_BYPASS`/`NEXT_PUBLIC_DEV_AUTH` unset (hard-gated anyway).
2. `npx firebase-tools deploy --only firestore` (rules + indexes; uses `firebase.json`).
3. Probe `https://<domain>/api/health` → expect `{ok, store:"firestore", metering:true, llm:"gemini", polar:true, firebaseAuth:true}`.
4. Point the Polar **sandbox** webhook at `/api/polar/webhook`; make one real sandbox purchase; verify the ledger credit on `/billing`, then a deliberate refund → proportional clawback.
5. Flip `POLAR_SERVER=production` + production token/products; repeat step 4's probe with a real card in test amount if policy allows.
6. Watch function logs for `kind:"client-error"` lines during the first days (client crashes beacon there).

— Generated by the ship-loop; state, decisions, and evidence trail in `.claude/ship-loop/`.
