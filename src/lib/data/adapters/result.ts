/**
 * Adapter result contract (ADR-0010).
 *
 * Every method on a data adapter returns an {@link AdapterResult} — never a bare
 * nullable and never a thrown exception. This is what lets the four concerns the
 * function layer (`src/lib/data/*`) does NOT own — null-handling, store-error
 * handling, access validation and response normalization — be resolved once at
 * the adapter seam instead of re-implemented at every route/action call site.
 *
 * The four error kinds map 1:1 to the situations the function layer collapses
 * into a single `null`:
 *  - `unconfigured` — `getStore()` returned null (no backend); the data layer
 *    no-ops to null/[]. A 503, not a 404.
 *  - `forbidden`    — caller is neither the owner nor a configured attorney.
 *  - `not_found`    — the case/resource genuinely does not exist.
 *  - `store_error`  — the underlying `Store` call threw (Firestore/`pg`).
 *
 * Pure module: no `next/server`, no `server-only`, no data-layer import — so it
 * loads under the `tsx --test` runner with zero infra. The HTTP shaping lives in
 * the sibling `http.ts`; server actions consume the union directly.
 */

export type AdapterErrorKind =
  | "unconfigured"
  | "forbidden"
  | "not_found"
  | "store_error";

export interface AdapterError {
  kind: AdapterErrorKind;
  /** Original thrown value for `store_error` (logged, never sent to the client). */
  cause?: unknown;
}

export type AdapterResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: AdapterError };

/** Construct a success result. */
export function ok<T>(value: T): AdapterResult<T> {
  return { ok: true, value };
}

/** Run a Store call and normalize a throw into `store_error` — the try/catch
 *  envelope nearly every adapter method's tail repeats. Use as
 *  `return wrapStore(() => deps.getCriteriaForCase(caseId))`. Methods that need
 *  not_found/unconfigured mapping keep their explicit form. */
export async function wrapStore<T>(fn: () => Promise<T>): Promise<AdapterResult<T>> {
  try {
    return ok(await fn());
  } catch (cause) {
    return err("store_error", cause);
  }
}

/** Construct a failure result. `cause` is only attached for `store_error`. */
export function err<T = never>(
  kind: AdapterErrorKind,
  cause?: unknown,
): AdapterResult<T> {
  // The contract is that a store_error's underlying Store exception is LOGGED
  // here (http.ts strips it from the response and server actions consume the
  // union directly), so log at the single construction seam rather than relying
  // on every adapter caller to remember to.
  if (kind === "store_error") {
    console.error("[adapter] store_error", cause);
  }
  return {
    ok: false,
    error: cause === undefined ? { kind } : { kind, cause },
  };
}
