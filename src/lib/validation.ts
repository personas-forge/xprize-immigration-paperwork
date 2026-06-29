/**
 * Shared primitives for validating + normalizing UNTRUSTED request bodies, used
 * by every AI feature's `parse*Request` (qualify, draft, rfe, guidance,
 * evidence/categorize).
 *
 * Pure + client-safe (no `server-only`, no Node built-ins), so it imports
 * cleanly into the pure feature modules that run on both server and client.
 *
 * Previously each parser hand-rolled the SAME "is this a JSON object?" guard
 * (identical error string, five copies), and the `str` trim/slice coercion lived
 * in drafting's `criteria-text` yet was reused by three features. Owning both here
 * means a contract change (the wording, rejecting arrays, NFC-normalizing input)
 * lands once instead of drifting across the parsers.
 */

/** The 400 error every AI parser returns when the body isn't a JSON object.
 *  Single-sourced so the five parsers can't drift on the wording. */
export const JSON_OBJECT_BODY_ERROR = "Request body must be a JSON object.";

/**
 * Narrow an untrusted request body to a string-keyed record, or `null` when it
 * isn't a non-null object.
 *
 * Behaviour is byte-for-byte the historical inline guard
 * (`typeof body !== "object" || body === null`): an ARRAY still narrows through
 * (`typeof [] === "object"`), exactly as the five inlined copies allowed. Do NOT
 * "tighten" this to reject arrays without auditing every caller first.
 */
export function asObjectBody(body: unknown): Record<string, unknown> | null {
  if (typeof body !== "object" || body === null) return null;
  return body as Record<string, unknown>;
}

/** Coerce an untrusted value to a trimmed, length-capped string ("" if absent).
 *  The shared input primitive behind the draft/RFE/forecast/critique parsers and
 *  the evidence document-name field (`@/features/drafting/criteria-text`
 *  re-exports it so its existing importers are unaffected). */
export function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
