# Follow-ups — 2026-06-02 (Vibeman Pipeline C, "Petition Drafting & Document Generation")

This run scanned ONE context group (Petition Drafting) and implemented 10 accepted
ideas. Two things were deliberately left for a future run because they fall outside
the selected group or outside the change's control.

## 1. Systemic cross-tenant IDOR (HIGH — security) — ✅ RESOLVED in Run #2

> **Update 2026-06-02 (Run #2, Pipeline C on the Evidence & Case Management group):**
> all three flagged sites — plus the review server actions and the review queue —
> were migrated to `isConfiguredAttorney`. The systemic IDOR is closed. Only
> `dashboard/page.tsx`'s `isAttorney` nav affordance remains (no data/action; left
> as-is). Behavior change: the attorney workflow now requires `ATTORNEY_EMAILS`.
> Original description retained below for context.

Idea #10 fixed the cross-tenant IDOR on `/api/rfe` by gating the attorney
cross-owner path on the new fail-closed `isConfiguredAttorney` instead of the
demo-permissive `isAttorney`. The **identical pattern** —
`getCaseForUser(...) ?? (isAttorney(email) ? getCaseAnyOwner(caseId) : null)` —
still exists in three files that belong to the **Evidence & Case Management** group
(not selected this run), so they were not modified:

- `src/app/api/evidence/categorize/route.ts:97-98` — POST route; same read+write of
  another applicant's case via a guessed `caseId`.
- `src/app/dashboard/cases/[id]/page.tsx:41-42` — Server Component; an unconfigured
  "attorney" (i.e. any signed-in user in the demo default) can VIEW any case detail.
- `src/features/evidence/actions.ts:22-24` — `canAccessCase` helper used by the
  evidence server actions.

**Fix:** replace `isAttorney` with `isConfiguredAttorney` (already added in
`src/lib/auth/roles.ts`) at each cross-owner data-access site. The
`dashboard/cases` page is more nuanced — `isAttorney` is also used there to decide
UI affordances; only the `getCaseAnyOwner` *data* path should switch to the strict
check, keeping the demo's view affordances intact if desired. Recommend a small
Pipeline B/C run scoped to the Evidence & Case Management group.

> Note: the broader `review/` server actions (`src/features/review/actions.ts`)
> also call `getCaseAnyOwner` behind `isAttorney`. That is the attorney
> review/sign/file workflow whose demo-unlock is intentional; evaluate whether it
> should require a configured attorney before changing it.

## 2. Environmental build break (blocks the prod-build gate)

`npx next build` fails at webpack module resolution:

```
Module not found: Can't resolve 'firebase-admin/app'      (src/lib/firebase/admin.ts)
Module not found: Can't resolve 'firebase-admin/firestore'(src/lib/firestore/admin.ts)
Module not found: Can't resolve '@electric-sql/pglite'    (src/lib/db/pglite-store.ts)
```

Both packages ARE installed (`node_modules/firebase-admin`, `@electric-sql/pglite`)
and `next.config.ts` lists them in `serverExternalPackages`, yet their subpath
`exports` don't resolve — and `tsc --noEmit` reports the same 18 errors in the same
four DB-layer files. This predates this session (it was present in the first
baseline `tsc` run) and none of those files were touched by this run.

**Likely causes to check:** a partial/again-needed `npm install`, a
`firebase-admin` major-version whose subpath export map differs from the import
sites, or `tsconfig` `moduleResolution` not set to `bundler`/`nodenext`. Until
resolved, treat `tsc` on changed files + `npm test` + `eslint` as the gate; the
full `next build` cannot pass for reasons unrelated to feature code.
