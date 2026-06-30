// Server-only route-authorization seam (ADR-0006). The real server-only infra
// (auth session, the petitions data layer) is reached via lazy dynamic import in
// `defaultDeps`, so this module stays unit-testable while never pulling
// server-only code into a client bundle. See `assertServerOnly` for why we use a
// runtime guard instead of `import "server-only"`.
import { assertServerOnly } from "@/lib/serverOnlyGuard";
assertServerOnly("@/lib/auth/authorizeRoute");

import { isConfiguredAttorney } from "@/lib/auth/roles";
import type { AppUser } from "@/lib/auth/devAuth";
import type { StoredCase } from "@/lib/db/store";

/**
 * Composable case-access policy for an API route (ADR-0006).
 *
 * `requiresCase` declares the route resolves a case when the request supplies a
 * `caseId` (all current AI routes do). `requiresAttorney` ALSO honors the
 * configured-attorney cross-tenant fallback — i.e. owner OR attorney-of-record,
 * NOT attorney-only. Omit it for owner-only routes (e.g. draft).
 */
export interface RoutePolicy {
  requiresCase?: boolean;
  requiresAttorney?: boolean;
}

/**
 * Discriminated authorization result. The ROUTE maps each non-`ok` variant to
 * its own existing error copy (status + body text stay byte-identical to the
 * pre-consolidation routes); the helper owns only the decision.
 *
 *  - `ok`             — caseId supplied and the caller may access that case.
 *  - `anonymous`      — no caseId in the body; the route falls through to its
 *                       inline payload path (`user` may still be present).
 *  - `unauthenticated`— caseId supplied but no signed-in user (→ route's 401).
 *  - `forbidden`      — caseId supplied but the user may not access it (→ 403).
 */
export type Authorized =
  | { status: "ok"; user: AppUser; case: StoredCase }
  | { status: "anonymous"; user: AppUser | null }
  | { status: "unauthenticated" }
  | { status: "forbidden" };

/**
 * Injected boundary (mirrors the DI convention in `rate-limit.ts` and
 * `operation.ts`) so the decision logic unit-tests with no DB, cookies, or
 * server-only imports. `defaultDeps` wires the real infra via lazy import.
 */
export interface AuthzDeps {
  getUser: () => Promise<AppUser | null>;
  getCaseForUser: (userId: string, caseId: string) => Promise<StoredCase | null>;
  getCaseAnyOwner: (caseId: string) => Promise<StoredCase | null>;
  isConfiguredAttorney: (email: string | null | undefined) => boolean;
}

/**
 * Production wiring. The server-only modules (`session`, `petitions`) are pulled
 * via lazy dynamic import at call time, keeping this module's static graph free
 * of any server-only edge. `isConfiguredAttorney` is pure, so it's bound
 * directly.
 */
export const defaultDeps: AuthzDeps = {
  getUser: async () => (await import("@/lib/auth/session")).getUser(),
  getCaseForUser: async (userId, caseId) =>
    (await import("@/lib/data/petitions")).getCaseForUser(userId, caseId),
  getCaseAnyOwner: async (caseId) =>
    (await import("@/lib/data/petitions")).getCaseAnyOwner(caseId),
  isConfiguredAttorney,
};

/**
 * Read `caseId` from the request body without consuming it. A `Request` body is
 * single-consumption, and the calling route parses the same body for its own
 * payload, so we read a `clone()`. A non-JSON / bodyless request yields `null`
 * (no caseId discernible) — the route then re-parses and emits its own 400.
 */
async function readCaseId(request: Request): Promise<string | null> {
  try {
    const body = (await request.clone().json()) as { caseId?: unknown };
    return typeof body.caseId === "string" && body.caseId.length > 0
      ? body.caseId
      : null;
  } catch {
    return null;
  }
}

/**
 * The single, fail-closed case-access decision shared by the token-charged AI
 * routes (ADR-0006). Consolidates the expression that was hand-rolled at
 * draft/route.ts (owner-only), rfe/route.ts and evidence/categorize/route.ts
 * (owner-or-configured-attorney).
 *
 * Cross-tenant access gates on `isConfiguredAttorney` (fails closed when
 * ATTORNEY_EMAILS is unset), NEVER `isAttorney` (the demo unlock) — the HIGH
 * auth-fail-open / PII-egress class the team gated before release.
 */
export async function authorizeRoute(
  request: Request,
  policy: RoutePolicy,
  deps: AuthzDeps = defaultDeps,
): Promise<Authorized> {
  const caseId = await readCaseId(request);

  // No caseId → the route handles its inline (unsaved) payload itself. We still
  // surface the user so the route can attribute the request.
  if (!caseId) {
    return { status: "anonymous", user: await deps.getUser() };
  }

  const user = await deps.getUser();
  if (!user) return { status: "unauthenticated" };

  // Owner match wins outright — the attorney fallback (and its dependencies) is
  // never consulted. Otherwise, ONLY when the route opts into the cross-tenant
  // fallback AND the caller is an explicitly configured attorney do we resolve
  // the case by id regardless of owner.
  const owned = await deps.getCaseForUser(user.id, caseId);
  const stored =
    owned ??
    (policy.requiresAttorney && deps.isConfiguredAttorney(user.email)
      ? await deps.getCaseAnyOwner(caseId)
      : null);

  return stored
    ? { status: "ok", user, case: stored }
    : { status: "forbidden" };
}
