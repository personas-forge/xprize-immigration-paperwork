/**
 * AdapterError → HTTP shaping (ADR-0010).
 *
 * Route handlers call {@link toErrorResponse} so the `unconfigured` / `forbidden`
 * / `not_found` / `store_error` distinction the adapters preserve is no longer
 * flattened back into a single hand-mapped status. Server *actions* don't use
 * this — they consume the `AdapterResult` union directly (they redirect, not
 * respond).
 *
 * The status/body mapping is pure and exported separately so it can be tested
 * without spinning up the framework. `NextResponse` is imported statically here
 * exactly as `operation.ts` does (the test runner resolves `next`).
 */

import { NextResponse } from "next/server";
import type { AdapterError, AdapterErrorKind } from "./result";

const STATUS: Record<AdapterErrorKind, number> = {
  unconfigured: 503,
  forbidden: 403,
  not_found: 404,
  store_error: 500,
};

/** Client-safe message per kind. Deliberately generic — never leaks a `cause`. */
const MESSAGE: Record<AdapterErrorKind, string> = {
  // Avoid infra jargon ("storage") for anxious immigration clients — keep these
  // reassuring and actionable. forbidden/not_found are already user-appropriate.
  unconfigured: "Our case-file service is temporarily unavailable. Please try again shortly.",
  forbidden: "You do not have access to this case.",
  not_found: "Case not found.",
  store_error: "We couldn't reach your case file just now. Please try again in a moment.",
};

/** Pure: the HTTP status for an adapter error kind. */
export function httpStatusForError(kind: AdapterErrorKind): number {
  return STATUS[kind];
}

/** Client-safe error body returned to the browser (no `cause`, no PII).
 *  Exported so client fetch wrappers can type a failed adapter response. */
export type ErrorEnvelope = { error: string; code: AdapterErrorKind };

/** Pure: the JSON body for an adapter error (no `cause`, no PII). */
export function adapterErrorBody(error: AdapterError): ErrorEnvelope {
  return { error: MESSAGE[error.kind], code: error.kind };
}

/** Map an adapter error to a `NextResponse` for a route handler. */
export function toErrorResponse(error: AdapterError): NextResponse {
  return NextResponse.json(adapterErrorBody(error), {
    status: httpStatusForError(error.kind),
  });
}
