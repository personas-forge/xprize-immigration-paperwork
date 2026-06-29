# Code Refactor — Attorney Review & Filing Workflow
> Total: 5
> Critical: 0 | High: 0 | Medium: 2 | Low: 3

Context is unusually clean after the 2026-06-23 pass: no dead exports (every export in the 7 files is reachable — `getReviewEvents`→case-detail page, `getCases`→CaseList via cases.ts, `ReviewActionState`→ReviewActionForm, `queue-age`→ReviewQueueView, `USCIS_DECISIONS` SSoT used by both action + select), no `TODO`/`FIXME`/`console.log`/commented-out code, no `@ts-ignore`. The 5 below are genuine duplication / drift / cleanup, all verified against current file contents.

## 1. `VISA_CLASSIFICATIONS` literal re-declared in saved-cases.ts
- **Severity**: Medium
- **Category**: duplication
- **File**: src/lib/data/saved-cases.ts:17
- **Scenario**: `const CLASSIFICATIONS: readonly VisaClassification[] = ["O-1A", "O-1B", "EB-1A"];` re-types the exact allowlist that is already exported as `VISA_CLASSIFICATIONS` (`src/features/case-file/types.ts:37`) — and saved-cases.ts *already imports from that same module* (line 15: `import { CASE_STATUSES, type PetitionCase, type VisaClassification } from "@/features/case-file/types"`).
- **Root cause**: The values array was hand-copied instead of importing the const beside the type it derives.
- **Impact**: Two copies of the classification set that can silently drift. If a code is renamed/added in `VISA_CLASSIFICATIONS`, `asClassification` keeps coercing to the stale set and quietly maps the new code to the `"O-1A"` fallback — a wrong-classification persist with no error.
- **Fix sketch**: Import `VISA_CLASSIFICATIONS` from `@/features/case-file/types` and delete the local `CLASSIFICATIONS`; `asClassification` references the imported const. One-line, zero behavior change.

## 2. Two divergent `statusTone` functions for the same case-status domain
- **Severity**: Medium
- **Category**: consolidation
- **File**: src/features/review/components/ReviewPanel.tsx:53 (and src/features/case-file/components/CaseList.tsx:34)
- **Scenario**: Both hand-roll a `CaseStatus → BadgeTone` map and they *disagree*: ReviewPanel maps `Filed → "success"`, `Attorney Review → "accent"`; CaseList maps `Filed → "accent"`, `Intake → "warning"`. So a "Filed" case shows a **green** badge in the review panel but a **blue/accent** badge in the case list. (Distinct from the shared, tested `statusTone` in `case-file/criteria.ts`, which is for *criterion* status, not case status — that one is correctly centralized.)
- **Root cause**: No single source of truth for case-status tone; each view invented its own, and they drifted.
- **Impact**: Inconsistent status color across the app for the same status value; a future status (e.g. a "Withdrawn") must be added in two places or one view paints it neutral. Low correctness risk, real UX inconsistency.
- **Fix sketch**: Add one `caseStatusTone(status: string): BadgeTone` next to `CASE_STATUSES` in `case-file/types.ts` (or a small `case-file/status.ts`), reconcile the two mappings into it, and have both components import it. If the divergence is intentional, document why in one place rather than two silent copies.

## 3. Review-event input shape declared twice inline in reviews.ts
- **Severity**: Low
- **Category**: duplication
- **File**: src/lib/data/reviews.ts:35 (and the `events[]` element at :70)
- **Scenario**: `addReviewEvent`'s param object and the `transitionCase` `events` array-element both inline the identical shape `{ authorId: string | null; authorRole: "applicant" | "attorney"; kind: ReviewKind; body?: string; metadata?: Record<string, unknown> }`. The same shape is mirrored again in the `Store` interface (`src/lib/db/store.ts`).
- **Root cause**: No named input type; the literal was repeated. (There is a `ReviewEvent` type, but it is the *stored* shape with `id`/`createdAt`, not the input.)
- **Impact**: A change to authoring fields (e.g. a new `authorRole`) must be edited in two inline copies in one file, plus the store interface — easy to update one and skip the other.
- **Fix sketch**: Export `interface ReviewEventInput { authorId: string | null; authorRole: "applicant" | "attorney"; kind: ReviewKind; body?: string; metadata?: Record<string, unknown>; }` and reference it from both call sites (`transitionCase` uses `readonly ReviewEventInput[]`; `addReviewEvent` uses `ReviewEventInput & { caseId: string }`).

## 4. Shadow `BadgeTone` type re-declared in queue-age.ts
- **Severity**: Low
- **Category**: duplication
- **File**: src/features/review/queue-age.ts:9
- **Scenario**: `export type BadgeTone = "success" | "warning" | "danger";` is a narrowed shadow of the canonical `BadgeTone` (`neutral | accent | success | warning | danger`) in `@/components/ui` (`Badge.tsx:4`). `BUCKET_TONE` is typed with the local copy, then consumed as a `<Badge tone={...}>` prop in ReviewQueueView — which already has to widen back out via the `"neutral"` fallback at `ReviewQueueView.tsx:124`.
- **Root cause**: The module's "no DB/store, safe to import anywhere" rationale (line 5) was over-applied to a *type*. A `import { type BadgeTone }` is erased at compile time and adds zero runtime dependency, so the rationale doesn't justify forking the type.
- **Impact**: If the canonical tone union changes, the shadow type silently diverges; the partial copy already needs an out-of-band `"neutral"` value, proving it's incomplete.
- **Fix sketch**: `import { type BadgeTone } from "@/components/ui"` and delete the local declaration (keep `AgeBucket` / `BUCKET_TONE`).

## 5. Unnecessary type assertion in ReviewQueueView
- **Severity**: Low
- **Category**: cleanup
- **File**: src/features/review/components/ReviewQueueView.tsx:49
- **Scenario**: `const sorted = sortOldestFirst(cases as SavedCaseSummary[]);` — `cases` is already `readonly SavedCaseSummary[]`, and `sortOldestFirst<T extends { submittedAt: string | null }>(items: readonly T[]): T[]` accepts a `readonly` array directly (verified: `SavedCaseSummary.submittedAt: string | null`, types.ts:92). The `as SavedCaseSummary[]` only strips `readonly` and is not needed.
- **Root cause**: Defensive cast left over from when the helper's signature likely took a mutable array; the helper now takes `readonly T[]`.
- **Impact**: A redundant assertion that defeats type-checking on that argument (a real type mismatch would be silently cast away). Cosmetic but a small footgun.
- **Fix sketch**: `const sorted = sortOldestFirst(cases);` — drop the assertion.
