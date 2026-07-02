"use client";

import { useState } from "react";

/**
 * Client half of the charged-request idempotency contract.
 *
 * The AI orchestrator (`executeAiOperation`, step 4) folds an `Idempotency-Key`
 * header into the token-ledger ref (`idem:{userId}:{operationKey}:{key}`) and
 * the store de-dupes debits on that ref — so two requests carrying the SAME key
 * charge ONCE. That puts the key under two opposing pressures no fetch call
 * site should re-derive on its own:
 *
 *  - STABLE across retries of one intent. A re-click after a dropped response,
 *    a double-fire, a resubmit after an error/402/429 body are all the SAME
 *    purchase — reusing the key is what closes the double-charge leak (the
 *    model may re-run on the retry; the DEBIT must not).
 *  - FRESH for each new intent. After a SUCCESS, deliberately running the op
 *    again is a new paid run — reusing the key would make every second run
 *    free. And changed inputs are a different request entirely — de-duping
 *    them against the old ref would silently under-bill.
 *
 * This module owns that tension in one place. `current(fingerprint)` hands out
 * a stable key for the ongoing intent and rotates it mechanically the moment
 * the caller's serialized inputs differ from the last call (changed inputs =
 * new intent). `rotate()` covers the one edge the helper can't observe — the
 * caller's success handler. Error paths need NO call at all: not rotating IS
 * the retry semantics.
 *
 * Keys come from `crypto.randomUUID()` — hyphenated hex, comfortably inside
 * the server's accepted shape (/^[A-Za-z0-9_.:-]{1,200}$/). A malformed key is
 * silently ignored server-side (dedupe just disengages), so we never
 * hand-assemble one from user input.
 */
export interface IdempotencyKeys {
  /**
   * The key for the current intent. Pass the serialized request inputs as
   * `fingerprint` (the JSON body works well) so a changed input rotates the
   * key; omit it for ops whose inputs cannot change within the component's
   * lifetime — then only `rotate()` advances the key.
   */
  current(fingerprint?: string): string;
  /** Mark the current intent fulfilled — call on SUCCESS only. The next
   *  `current()` starts a new paid intent under a fresh key. */
  rotate(): void;
}

/** Plain factory (React-free, unit-testable). Keys are minted lazily on the
 *  first `current()`, never at construction — nothing touches `crypto` during
 *  SSR/prerender of the components that hold one. */
export function createIdempotencyKeys(): IdempotencyKeys {
  let key: string | null = null;
  let lastFingerprint: string | undefined;
  return {
    current(fingerprint?: string): string {
      if (key === null || fingerprint !== lastFingerprint) {
        key = crypto.randomUUID();
        lastFingerprint = fingerprint;
      }
      return key;
    },
    rotate(): void {
      // Only drop the key — the fingerprint stays, so a deliberate re-run of
      // the SAME inputs still gets a fresh key (that is the point of rotate).
      key = null;
    },
  };
}

/**
 * One key manager per component instance, stable for its whole life (lazy
 * `useState` initializer, so it is created exactly once and never re-minted by
 * a re-render mid-retry). A component that can fire two DISTINCT charged ops
 * (e.g. DraftStudio's full draft vs single-section regenerate) must hold one
 * manager per op — sharing one would entangle their lifecycles: a success in
 * one op would rotate away the key the other still needs for its retry.
 */
export function useIdempotencyKeys(): IdempotencyKeys {
  const [keys] = useState(createIdempotencyKeys);
  return keys;
}
