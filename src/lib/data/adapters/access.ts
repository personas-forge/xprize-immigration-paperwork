/**
 * The single owner-or-attorney case-access gate (ADR-0010).
 *
 * The whole security argument of the adapter layer is that this fail-closed
 * resolution exists exactly ONCE. Before this, the gate
 *
 *   (await getCaseForUser(user.id, caseId)) ??
 *     (isConfiguredAttorney(user.email) ? await getCaseAnyOwner(caseId) : null)
 *
 * was copy-pasted across `rfe/route.ts`, `evidence/categorize/route.ts`,
 * `draft/route.ts` and `review/actions.ts` (five call sites, four copies). Any
 * adapter method that touches a specific case routes through {@link resolveCase}
 * first, so the cross-tenant `isConfiguredAttorney` check can never be forgotten.
 *
 * Pure + dependency-injected (the repo convention for impure boundaries — see
 * `operation.ts`, `rate-limit.ts`): the four data/store calls arrive as
 * {@link CaseGateDeps}, so this module never statically imports the `server-only`
 * data layer and stays unit-testable under `tsx --test`. The adapters supply the
 * real deps via lazy dynamic import.
 */

import type { StoredCase } from "@/lib/data/petitions";
import { type AdapterResult, err, ok } from "./result";

/** Memoize an async builder — the lazy-DI singleton each adapter uses to load
 *  the `server-only` data layer exactly once (a dynamic import that must NOT run
 *  at module load, so the suite can inject fakes). Each call creates its own
 *  cache, so adapters don't share one. */
export function makeCached<T>(build: () => Promise<T>): () => Promise<T> {
  let cached: T | null = null;
  return async () => {
    if (cached) return cached;
    cached = await build();
    return cached;
  };
}

/** The shared `storeConfigured` probe every adapter's deps wire — true when a
 *  backend is configured. Dynamic import so this module stays free of the
 *  `server-only` store at load time. */
export async function storeConfigured(): Promise<boolean> {
  const { getStore } = await import("@/lib/db/store");
  return (await getStore()) !== null;
}

/** Request-scoped identity the gate decides on. `null` = anonymous / no email. */
export interface CaseAccess {
  userId: string | null;
  email: string | null;
}

/** The four impure operations {@link resolveCase} needs, injected for testability. */
export interface CaseGateDeps {
  getCaseForUser(userId: string, caseId: string): Promise<StoredCase | null>;
  getCaseAnyOwner(caseId: string): Promise<StoredCase | null>;
  isConfiguredAttorney(email: string | null | undefined): boolean;
  /** True when a backend is configured; lets us return `unconfigured` (503)
   *  instead of conflating a missing store with `not_found`. */
  storeConfigured(): Promise<boolean>;
}

/**
 * Resolve a case for a caller, fail-closed.
 *
 * Order of decision:
 *  1. no backend            → `unconfigured`
 *  2. owner match           → `ok(case)`
 *  3. configured attorney   → `ok(case)` if it exists, else `not_found`
 *  4. neither               → `forbidden` (no information leak about existence)
 *
 * A throw from any store call becomes `store_error` — the caller never sees an
 * exception.
 */
export async function resolveCase(
  deps: CaseGateDeps,
  access: CaseAccess,
  caseId: string,
): Promise<AdapterResult<StoredCase>> {
  if (!(await deps.storeConfigured())) return err("unconfigured");
  try {
    if (access.userId) {
      const owned = await deps.getCaseForUser(access.userId, caseId);
      if (owned) return ok(owned);
    }
    if (deps.isConfiguredAttorney(access.email)) {
      const any = await deps.getCaseAnyOwner(caseId);
      return any ? ok(any) : err("not_found");
    }
    // Not the owner and not a configured attorney → deny. DECISION (recorded):
    // we re-probe `storeConfigured()` before denying, and downgrade to
    // `unconfigured` (503 "try again") if the store has since gone away. This
    // defends the specific window where `getStore()` resolved a backend at the
    // top of this call (so we got past the first `unconfigured` check) but FLIPPED
    // to null mid-request (an admin-init flap / transient store unavailability) —
    // the petition data fns return `null` (not a throw) when there's no store, so
    // without this re-probe a legitimate owner would get a wrong, alarming
    // `forbidden` (403) instead of a retryable 503 during a store blip. A real
    // backend FAULT (dropped connection mid-query) throws and is already caught
    // below as `store_error`; this branch is only the no-store-now case. The cost
    // is bounded: a genuine non-owner pays one extra cheap `storeConfigured()`
    // call, and (store still up) still lands on `forbidden`. Pinned by
    // access.test.ts ("store vanished mid-call …").
    if (!(await deps.storeConfigured())) return err("unconfigured");
    // Deny without revealing whether the case exists (fail-closed; mirrors the
    // prior HIGH findings on cross-tenant PII egress).
    return err("forbidden");
  } catch (cause) {
    return err("store_error", cause);
  }
}
