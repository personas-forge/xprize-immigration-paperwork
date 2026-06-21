# Authentication & Session — Feature Scout + Ambiguity Guardian

> Context #11 · Group: Identity & Access
> Total: 5 findings

## 1. No account deletion / GDPR data-export for a PII-dense immigration product
- **Lens**: feature-scout
- **Priority**: High
- **Category**: feature
- **File**: `src/lib/auth/db.ts:17` (`getProfile` / `upsertProfileWithConsent` are the only profile ops); `src/lib/db/store.ts:181` (`Store` interface)
- **Observation**: The `Store` interface and `auth/db.ts` expose create/read for profiles and consents but no delete or export path — a project-wide grep for `deleteProfile|deleteAccount|GDPR|exportData` returns zero hits. Sign-out (`src/app/auth/signout/route.ts`) revokes tokens and clears the cookie but the profile, consent ledger, cases, drafts, and evidence vault persist forever. For an O-1A/EB-1A SaaS holding passports, employment history, and petition narratives, "delete my account" and "download my data" are baseline expectations (and GDPR/CCPA obligations for EU/CA applicants).
- **Proposal**: Add `Store.deleteUserData(userId)` (cascade: profile, consents, cases, criteria, drafts, RFEs, review events, documents, token ledger) and `Store.exportUserData(userId)` returning a JSON bundle, implemented in both `firestore-store.ts` and `pglite-store.ts`. Surface a `/dashboard/account` "Delete account" (with confirm + Firebase `deleteUser`) and "Export my data" action.
- **Value / Risk-if-ignored**: Legal/compliance exposure (right-to-erasure requests have no fulfillment path); a trust blocker for a sensitive-data buyer. Without it, a deleted Firebase user still leaves an orphaned funded profile and full case PII in the store.
- **Effort**: L

## 2. `isAttorney` demo-unlock returns true for EVERY signed-in user when ATTORNEY_EMAILS is unset
- **Lens**: ambiguity-guardian
- **Priority**: Critical
- **Category**: trade-off
- **File**: `src/lib/auth/roles.ts:20-27`
- **Observation**: `isAttorney(email)` returns `true` for any signed-in user when `ATTORNEY_EMAILS` is empty (line 25: "unconfigured → demo unlock"). The team has carefully routed every cross-tenant DATA gate through the strict `isConfiguredAttorney` (authorizeRoute.ts:97, cases/[id]/page.tsx:44, review/actions.ts), but the permissive function still exists and is only distinguished by a hyphen in the name. The single recorded assumption — "fine for UI-level affordances in the demo" — lives in a doc comment, not in any enforcement; the next call site that picks `isAttorney` by autocomplete silently reopens the closed IDOR/PII-egress class, and a missing `ATTORNEY_EMAILS` in a real deploy makes it a fail-OPEN authorization for sign/file affordances.
- **Proposal**: Record and enforce the boundary: rename `isAttorney` to `isDemoAttorneyAffordance` (or add an ESLint `no-restricted-imports`/`no-restricted-syntax` rule banning `isAttorney` outside `roles.ts` + components), and add a startup warning when `NODE_ENV==="production"` and `attorneyAllowlist()` is empty so an unconfigured prod deploy is loud, not silently demo-unlocked.
- **Value / Risk-if-ignored**: A wrong role/access outcome — every signed-in applicant could be treated as the attorney of record (sign/file UI, and any future gate that reaches for the wrong helper). The protection today is naming discipline alone.
- **Effort**: S

## 3. Magic 5-day session lifetime with no recorded reasoning, no sliding renewal, and no re-auth
- **Lens**: ambiguity-guardian
- **Priority**: Medium
- **Category**: trade-off
- **File**: `src/lib/firebase/config.ts:33` (`SESSION_EXPIRES_MS = 1000*60*60*24*5`); consumed at `src/app/api/auth/session/route.ts:41-50`
- **Observation**: The session cookie is minted for exactly 5 days with the only justification being the inline comment "(5 days)". There is no recorded reasoning for why 5 days (vs Firebase's max 14, or a shorter window for a product that lets an attorney sign/file legal documents), and the cookie is fixed-lifetime: an active user is hard-logged-out at day 5 with no sliding renewal, while a stolen pre-revocation cookie stays valid for up to 5 days. No step-up/re-auth guards the sign/file actions either.
- **Proposal**: Document the threat-model rationale for the 5-day choice in an ADR (or a comment citing the trade-off: idle timeout vs friction). Consider a sliding session (re-mint on activity within the window) so active users aren't dropped, and evaluate a shorter window or step-up re-auth before the irreversible attorney sign/file transition.
- **Value / Risk-if-ignored**: A future maintainer can't tell whether 5 days is a deliberate security decision or an arbitrary default, so they can't safely tune it. The fixed lifetime is simultaneously a UX papercut (surprise logout) and a security ceiling on revocation latency for the most sensitive action in the app.
- **Effort**: M

## 4. Attorney / ops roles are env-var allowlists with no in-app multi-attorney org or role management
- **Lens**: feature-scout
- **Priority**: High
- **Category**: feature
- **File**: `src/lib/auth/roles.ts:11-18` (`attorneyAllowlist` from `ATTORNEY_EMAILS`), `:51-58` (`opsAllowlist` from `OPS_EMAILS`)
- **Observation**: Who can sign/file (`ATTORNEY_EMAILS`) and who can view the cross-tenant SLA queue (`OPS_EMAILS`) is configured ONLY by comma-separated env vars read at runtime. There is no organization model, no per-case attorney assignment (any configured attorney can pull ANY case via `getCaseAnyOwner`), and no admin UI — onboarding a new attorney or revoking one requires an env edit and redeploy. For a "your attorney of record reviews & signs" product that wants more than one firm/attorney, this doesn't scale.
- **Proposal**: Introduce a lightweight roles/membership model (e.g. an `org_members` store entity with `role: attorney|ops`, and optional per-case `assigned_attorney_id` so an attorney sees only their assigned cases), plus a `/dashboard/admin` page to grant/revoke roles. Keep the env allowlist as a fallback/bootstrap.
- **Value / Risk-if-ignored**: Caps the product at a single hard-coded set of counsel and forces redeploys for personnel changes; also means every attorney has firm-wide cross-tenant read (no scoping to their own clients), which is a sales blocker for any multi-attorney firm.
- **Effort**: L

## 5. Middleware's `PROTECTED_PREFIXES` covers only `/dashboard`; intended coverage of `/api/*` is undocumented
- **Lens**: ambiguity-guardian
- **Priority**: Medium
- **Category**: edge_case
- **File**: `src/middleware.ts:8` (`PROTECTED_PREFIXES = ["/dashboard"]`), `:45-49` (matcher runs on nearly everything)
- **Observation**: The matcher runs middleware on almost every path, but `isProtected` only treats `/dashboard*` as gated — every `/api/*` route passes through middleware untouched. The header comment explains marketing pages are public but says nothing about API routes, leaving it ambiguous whether unguarded `/api/*` is a deliberate "each route authorizes itself" decision or an oversight. The check is also a cookie-PRESENCE check only (`!request.cookies.get(SESSION_COOKIE)`), so a present-but-invalid/expired cookie sails past middleware and relies entirely on each route/layout re-verifying — a contract that isn't stated anywhere a future dev would see it.
- **Proposal**: Add a comment (or ADR reference) stating explicitly that API routes are intentionally NOT gated by middleware because each handler enforces auth via `getUser()` / `authorizeRoute` (and the Edge runtime can't run the Admin SDK), so the absence is by design, not a hole. If any `/api` namespace SHOULD be presence-gated, add its prefix.
- **Proposal**: Confirm and record that middleware is a cheap UX redirect only and verification is always server-side; consider a brief test asserting an `/api` route 401s without a valid session to lock the contract.
- **Value / Risk-if-ignored**: A future dev could wrongly assume middleware guards all protected surfaces and ship an API route with no `getUser()` check, or could "fix" the perceived gap and break the Edge/Node split. The intended security boundary is currently inferable only by reading three files.
- **Effort**: S
