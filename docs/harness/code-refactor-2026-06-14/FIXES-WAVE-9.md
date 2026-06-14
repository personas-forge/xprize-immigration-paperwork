# Code Refactor — Fix Wave 9 — Guidance envelope + consent + rate-limiting

> 5 commits, 5 findings closed (4 med + 1 low). Baseline preserved: tsc 0→0;
> tests 284→284 pass / 0 fail (behavior-preserving + a doc fix); `next build`
> PASSES; lint clean.

## Commits

| # | Commit | Finding | Severity |
|---|---|---|---|
| 1 | `(guidance envelope)` | form-field-guidance #3 | M |
| 2 | `(profileFieldsFromUser)` | consent-onboarding #2 | M |
| 3 | `(consent comment)` | consent-onboarding #4 | L |
| 4 | `(rate-limit move)` | rate-limiting #2 | M |
| 5 | `(clientIp)` | rate-limiting #3 | L |

## What was fixed

1. **`GuidanceResponse` tied to `Result<T>`.** It re-declared Result's envelope by hand and `buildGuidanceResponse` re-implemented `wrapResult`'s disclaimer attach. Now `GuidanceResponse = Omit<Result<string>, "data"> & { guidance: string }` (inherits the canonical envelope, keeps the client's `guidance` payload name) and the disclaimer flows through the single `wrapResult` chokepoint. Behavior-preserving.
2. **`profileFieldsFromUser` extracted** to `session.ts` — the welcome page (`defaultName`) and the consent action (`avatarUrl`) each reached into `user_metadata` with their own key fallbacks; now one helper (`full_name ?? name`, `avatar_url`) serves both (and the page's casts are gone — the metadata is already typed).
3. **Corrected `consent.ts`'s stale comment** — it claimed `CONSENT_VERSION` is read client- and server-side; its only readers are server-side. Reworded to "kept client-safe so it *could* be, but today's readers are server-side."
4. **Relocated `rate-limit.ts` → `src/lib/tokens/`** (beside the `OPERATION_REGISTRY` its caps derive from; consumers are the AI orchestrator + draft/save). Pure move, 4 import paths updated, test green from the new home.
5. **Shared, validated `clientIp()`** — `rateLimitKey` validated the forwarded IP but `welcome/actions` re-derived it with NO validation, trusting a client-controlled header into the consent audit record. Extracted `clientIp(headers) → string | null` (the hardened extraction); `rateLimitKey` uses it (anon-on-invalid unchanged) and welcome now stores the validated IP or null. Typed `Pick<Headers,"get">` so a `Request`'s headers and Next's `ReadonlyHeaders` both pass.

## Already-resolved / intentionally left (rate-limiting cluster)

- **rate-limiting #1 (H, preamble dup)** — **already closed**: Waves 5 + 7 + the draft migration put all 5 charged routes on the orchestrator, so the hand-rolled rate-limit preamble is gone (the orchestrator owns it).
- **rate-limiting #4 (L, `windowMs` param)** — left: the report explicitly recommends *not* actioning it (the seam is legitimately used by tests; `now`/`store` are the roadmapped durable-backend seams).
- **consent #3 (M, `email` prop)** — kept: the report endorses keeping it as harmless, and relocating the "Signed in as {email}" line is a visible UI change not worth it as a refactor.

## Verification

| Gate | After Wave 8 | After Wave 9 |
|---|---|---|
| `tsc --noEmit` errors | 0 | 0 |
| tests pass / fail | 284 / 0 | 284 / 0 |
| `next build` | PASS | PASS |
| lint (touched files) | clean | clean |

## Cumulative status

~57 of 88 findings closed across 9 waves + 3 follow-ups; CRITICAL closed; 1 FP rejected. Branch `refactor/code-refactor-2026-06-14`, off `main`, not pushed.

## Remaining tail (M/L; none blocking)

- **FAQ answer content** — flagged for the user (service-scope/legal claims).
- Per-context structural items not yet taken: criteria-table merge (case-file #2, god-component risk), `createPersistentValue` (case-file #3, contract mismatch), SiteHeader/Footer dedup (marketing #2, drifted nav), RfeStudio paywall JSX (rfe #5), llm-engine #3/#4, token-economy #2/#3/#4, data-adapter #4/#5, evidence-vault #4, event-bus #2/#3/#4, validation #5, attorney-review #2/#4.
- Intentionally kept: addReviewNote double-resolve (L), ai-orchestrator #3 type-mirroring, validation #4 `provisional`, consent #3 `email` prop, rate-limiting #4 `windowMs`.
