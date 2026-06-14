/**
 * The typed response envelope shared by every AI feature.
 *
 * No network, no React, no `server-only` — a pure module so the disclaimer
 * invariant is unit-testable and safe to import from client components and the
 * pure feature modules alike (it depends only on the client-safe `ModelSource`
 * type from `@/lib/llm/label`).
 *
 * COMPLIANCE: every AI response carries the not-legal-advice `DISCLAIMER`.
 * Owning that attach in one factory means a new AI route gets the disclaimer +
 * source for free and cannot omit them at the type level (UPL safeguard).
 *
 * See ADR-0011 (`docs/adr/0011-result-envelope.md`). NOTE: this is a different
 * concern from `AdapterResult<T>` (ADR-0010, the data-adapter ok/error union)
 * — a response envelope, not an error union — hence a distinct name and home.
 */

import { type ModelSource } from "@/lib/llm/label";

/** The standard envelope around every AI feature payload. */
export interface Result<T> {
  /** The feature payload (a draft, an assessment, guidance text, …). */
  data: T;
  /** The non-negotiable UPL disclaimer — present on every AI response. */
  disclaimer: string;
  /** `"mock"` (template) or the engine that produced the data. */
  source: ModelSource;
}

/**
 * The not-legal-advice / attorney-of-record disclaimer. MUST accompany every
 * AI output. Do not weaken or drop this string — it is the UPL safeguard.
 *
 * Canonical home (relocated here from `@/features/guidance/guidance` per
 * ADR-0011, byte-identical); `guidance` re-exports it for back-compat.
 */
export const DISCLAIMER =
  "This is general informational guidance only, not legal advice. " +
  "Immigration law is fact-specific and changes frequently. An attorney " +
  "of record licensed to practice law is required to review your petition " +
  "and advise on your situation before anything is filed with USCIS.";

/**
 * The sign-up / consent variant of the disclaimer. Same UPL safeguard as
 * {@link DISCLAIMER} but adds the account-creation nuance (no attorney–client
 * relationship is formed by registering). Lives here, beside the canonical
 * disclaimer, so every authored UPL string has exactly one audited home — do
 * not fork this wording into a component again.
 */
export const CONSENT_DISCLAIMER =
  "Creating an account does not form an attorney–client relationship and is " +
  "not legal advice. Immigration law is fact-specific; an attorney of record " +
  "licensed to practice law reviews and signs every petition before anything " +
  "is filed with USCIS.";

/**
 * Wrap a payload in the standard envelope, attaching the shared `DISCLAIMER`.
 * The single chokepoint through which every AI response gains its disclaimer.
 */
export function wrapResult<T>(data: T, source: ModelSource): Result<T> {
  return { data, disclaimer: DISCLAIMER, source };
}
