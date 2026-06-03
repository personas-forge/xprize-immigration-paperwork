// Server-only module. The `server-only` npm package isn't a dependency of this
// app, so we enforce the same contract with a runtime guard (mirrors session.ts).
if (typeof window !== "undefined") {
  throw new Error("@/lib/auth/authorizeRoute must not be imported on the client.");
}

import { isConfiguredAttorney } from "@/lib/auth/roles";
import type { AppUser } from "@/lib/auth/devAuth";
import type { StoredCase } from "@/lib/data/petitions";

/**
 * Composable route authorization (ADR-0006).
 *
 * Owns the ONE case-access decision that /api/draft, /api/rfe and
 * /api/evidence/categorize were each re-deriving inline: resolve the signed-in
 * user, resolve the body's `caseId` to a case the caller may touch (owner, or —
 * when the policy allows it — the EXPLICITLY configured attorney of record), and
 * return a discriminated result. The route maps each non-ok variant onto its OWN
 * error response, so per-route copy/status codes stay byte-identical.
 *
 * The security-critical invariant lives here, once: the cross-tenant fallback
 * gates on `isConfiguredAttorney` (fails closed when ATTORNEY_EMAILS is unset),
 * NEVER `isAttorney` (which demo-unlocks). Duplicating that fail-closed rule
 * across N call sites is the auth fail-open / PII-egress regression surface this
 * helper removes.
 */

export interface RoutePolicy {
  /** Route operates on a stored case: a `caseId` in the body must resolve. */
  requiresCase?: boolean;
  /**
   * Also honor the configured-attorney-of-record cross-tenant fallback
   * (owner OR attorney). NOT attorney-only. When falsy, access is owner-only.
   */
  requiresAttorney?: boolean;
}

/**
 * Discriminated authorization result. The route owns the HTTP mapping:
 * - `ok`             — caseId resolved (owner or attorney); carries user + case.
 * - `anonymous`      — no caseId (or `requiresCase` off) → route uses its
 *                      inline/demo path; carries the user for e.g. rate-limit keys.
 * - `unauthenticated`— caseId present but nobody is signed in → route's 401.
 * - `forbidden`      — caseId present, signed in, but no access → route's 403.
 */
export type Authorized =
  | { status: "ok"; user: AppUser; case: StoredCase }
  | { status: "anonymous"; user: AppUser | null }
  | { status: "unauthenticated" }
  | { status: "forbidden" };

/**
 * Injectable seam, mirroring `roles.ts`/`devAuth.ts`: real wiring is the default
 * arg, tests pass fakes. The server-only collaborators (`getUser`, the petition
 * reads) are reached via LAZY dynamic import so this module — and its unit tests
 * — load under `tsx --test` without pulling `next/headers`, firebase-admin or the
 * DB driver. `isConfiguredAttorney` is pure, so it's a static import.
 */
export interface AuthzDeps {
  getUser(): Promise<AppUser | null>;
  getCaseForUser(userId: string, caseId: string): Promise<StoredCase | null>;
  getCaseAnyOwner(caseId: string): Promise<StoredCase | null>;
  isConfiguredAttorney(email: string | null | undefined): boolean;
}

const defaultDeps: AuthzDeps = {
  getUser: () => import("@/lib/auth/session").then((m) => m.getUser()),
  getCaseForUser: (userId, caseId) =>
    import("@/lib/data/petitions").then((m) => m.getCaseForUser(userId, caseId)),
  getCaseAnyOwner: (caseId) =>
    import("@/lib/data/petitions").then((m) => m.getCaseAnyOwner(caseId)),
  isConfiguredAttorney,
};

/**
 * Read `caseId` from the body WITHOUT consuming the request: the route can still
 * `await request.json()` independently afterwards. A Request body is
 * single-consumption, so we read a `clone()`. Tolerant by design — a missing,
 * non-string, or unparseable body just means "no caseId" (→ the route's own
 * JSON/validation handling still runs on the original request).
 */
async function readCaseId(request: Request): Promise<string | null> {
  try {
    const body = await request.clone().json();
    const record = (body ?? {}) as Record<string, unknown>;
    return typeof record.caseId === "string" ? record.caseId : null;
  } catch {
    return null;
  }
}

export async function authorizeRoute(
  request: Request,
  policy: RoutePolicy,
  deps: AuthzDeps = defaultDeps,
): Promise<Authorized> {
  const caseId = await readCaseId(request);
  const user = await deps.getUser();

  // No case to resolve → the route falls through to its inline/demo path. The
  // user (possibly null) rides along so the route can key rate limits on it.
  if (!policy.requiresCase || !caseId) {
    return { status: "anonymous", user };
  }

  // A caseId is in play but nobody is signed in → the route's own 401 copy.
  if (!user) {
    return { status: "unauthenticated" };
  }

  // Owner first; then the cross-tenant fallback ONLY when the policy permits it
  // AND the caller is an explicitly configured attorney (fail-closed). When
  // `requiresAttorney` is falsy the attorney branch is never taken (owner-only).
  const stored =
    (await deps.getCaseForUser(user.id, caseId)) ??
    (policy.requiresAttorney && deps.isConfiguredAttorney(user.email)
      ? await deps.getCaseAnyOwner(caseId)
      : null);

  return stored ? { status: "ok", user, case: stored } : { status: "forbidden" };
}
