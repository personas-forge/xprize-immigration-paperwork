// Server-only orchestrator. We deliberately do NOT `import "server-only"` here
// (that package isn't installed and is unresolvable under the `tsx --test`
// runner) — the same convention as `@/lib/auth/session`. The real server-only
// infra (token guard, LLM client, auth session) is reached via lazy dynamic
// import in `defaultDeps()`, so this module stays unit-testable while never
// pulling server-only code into a client bundle.

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { DISCLAIMER } from "@/features/guidance/guidance";
import type { GenerateOptions } from "@/lib/llm/client";
import type { AdjudicationReport } from "@/lib/llm/adjudication-gates";
import {
  RATE_LIMITS,
  checkRateLimit,
  isRateLimitEnabled,
  rateLimitKey,
} from "@/lib/tokens/rate-limit";

/**
 * Generic orchestrator for the token-charged AI routes (ADR-0004).
 *
 * The five AI endpoints (`draft`, `rfe`, `qualify`, `guidance`,
 * `evidence/categorize`) all hand-implement the SAME pipeline:
 *
 *   parse JSON → spec.parse → rate-limit → charge → call model → guard →
 *   persist → respond
 *
 * with identical 400/401/402/429 + DISCLAIMER boilerplate and the same
 * charge-then-reclaim-and-fall-back-to-mock recovery (~500 lines duplicated).
 * This module owns that pipeline once, so a route becomes a declarative
 * {@link AiOperationSpec}. The orchestrator — not the route — owns the
 * cross-cutting invariants:
 *
 *  1. DISCLAIMER is present on every error body it emits (402 + 429), matching
 *     the UPL safeguard the routes already enforce.
 *  2. Rate-limit runs strictly BEFORE charge; charge runs BEFORE any model work
 *     (charge-then-reclaim — a caller who can't pay never reaches the model).
 *  3. On a model throw OR an unusable model response (`guard` returns null), the
 *     charge is reclaimed and a deterministic mock is returned labelled
 *     `source: "mock"` — a mock is never billed as model output.
 *  4. `persist` is best-effort: a storage hiccup never fails a paid response
 *     (the failure is surfaced via the spec's `onPersistError` merge fields,
 *     e.g. `{ saveFailed: true }` or `{ caseId: null }`).
 *
 * TESTABILITY: the server-only infra (token guard, LLM client, auth session) is
 * injected via {@link AiOperationDeps} with lazy dynamic-import defaults, so the
 * static import graph of this module stays free of the `server-only` package
 * (which is unresolvable under the `tsx --test` runner). The unit suite injects
 * fakes and never loads the real infra. This mirrors the repo convention in
 * `rate-limit.ts` (inject `now`/`store`).
 */

/** Minimal auth shape the orchestrator needs (structurally an `AppUser`). */
export interface AuthUser {
  id: string;
  /** The signed-in user's email — drives the configured-attorney access leg in
   *  a `persist` hook that gates through the adapter. Optional so test fakes can
   *  supply just `id`; the real `getUser()` always provides it. */
  email?: string | null;
}

/** Mirror of `ChargeResult` from `@/lib/tokens/guard`, decoupled for testing. */
export type ChargeOutcome =
  | { ok: true; cost: number; balance: number; reclaim: () => Promise<unknown> }
  | { ok: false; reason: "unauthenticated" }
  | { ok: false; reason: "insufficient"; cost: number; balance: number };

/** The single LLM surface the orchestrator calls. */
export interface OperationLlm {
  readonly name: string;
  generate(prompt: string, opts?: GenerateOptions): Promise<string>;
}

/** Result of `spec.parse`: a validated input, or the route-specific error to return. */
export type ParseOutcome<TInput> =
  | { ok: true; value: TInput }
  | { ok: false; response: NextResponse };

/** Context handed to `spec.parse` — the raw body plus a memoized user resolver. */
export interface ParseContext {
  request: Request;
  body: unknown;
  /** Resolve the signed-in user once (memoized across parse + persist). */
  resolveUser: () => Promise<AuthUser | null>;
}

/** The prompt text plus per-call generate options (json/tier/temperature). */
export interface PromptSpec {
  text: string;
  options?: GenerateOptions;
}

/** Rate-limit configuration for a route. */
export interface RateLimitSpec {
  /** Which `RATE_LIMITS` bucket cap to apply. */
  bucket: keyof typeof RATE_LIMITS;
  /** Key scope (keeps one route's traffic from exhausting another's). */
  scope: string;
  /** Key by authenticated user id when available (else client IP). Default false. */
  byUser?: boolean;
}

/**
 * Declarative description of one AI operation. `TInput` is the validated request
 * value; `TOutput` is the post-guard domain value (string for guidance, a parsed
 * result object for the JSON routes).
 */
export interface AiOperationSpec<TInput, TOutput> {
  /** Token-economy operation key. A function lets one route bill two ops
   *  (e.g. draft vs draft_section based on the input). */
  operation: string | ((input: TInput) => string);
  /** Omit to leave the route uncharged-guard-free; present → checked before charge. */
  rateLimit?: RateLimitSpec;
  /** True for multimodal ops (forces a non-CLI engine). */
  requiresImages?: boolean;
  /** 401 message body when charging finds no authenticated user. */
  unauthenticatedError: string;
  /** Validate + normalize the parsed JSON body. Owner/attorney gates live here
   *  (they may use `ctx.resolveUser`). Returns its own error response on failure. */
  parse: (ctx: ParseContext) => Promise<ParseOutcome<TInput>> | ParseOutcome<TInput>;
  /** Build the model prompt (+ generate options) for a validated input. */
  prompt: (input: TInput) => PromptSpec;
  /** Coerce raw model text into `TOutput`; return null if unusable → reclaim+mock. */
  guard: (raw: string, input: TInput) => TOutput | null;
  /** Deterministic fallback used when no engine is configured or output is unusable. */
  mock: (input: TInput) => TOutput;
  /** Shape the JSON response body from the domain value + its source label. */
  build: (output: TOutput, source: string, input: TInput) => Record<string, unknown>;
  /**
   * Live adjudication-risk gate (moonshot #1). Score the just-built response
   * against adjudicator-shaped invariants; the report is attached to the body as
   * `{ adjudication }`. Best-effort — a throw never fails the paid response.
   */
  adjudicate?: (
    output: TOutput,
    input: TInput,
    source: string,
    body: Record<string, unknown>,
  ) => AdjudicationReport | null;
  /**
   * UPL hard-stop. When `adjudicate` BLOCKS the output (`attorneyReady === false`
   * / `risk === "blocked"`) — i.e. the live screen caught legal-advice or
   * outcome-prediction language — this hook returns the body that should be sent
   * INSTEAD of the flagged model text, so the offending output never reaches the
   * client at all (a client-only badge would still ship the text over the wire).
   * The returned fields REPLACE the built body. The charge is reclaimed first
   * (the withheld model answer is not billed — the same honesty invariant as a
   * mock fallback), so a block-substituted body should label `source: "mock"`.
   */
  onBlocked?: (
    input: TInput,
    body: Record<string, unknown>,
    report: AdjudicationReport,
  ) => Record<string, unknown>;
  /** Best-effort persistence. Returns fields merged into the response body.
   *  Receives the resolved `source` ("mock" | engine name) so it can record the
   *  provenance of what it persists (e.g. the document's categorization source). */
  persist?: (
    output: TOutput,
    input: TInput,
    user: AuthUser | null,
    source: string,
  ) => Promise<Record<string, unknown>>;
  /** Fields merged into the body when `persist` throws (e.g. `{ saveFailed: true }`). */
  onPersistError?: (input: TInput) => Record<string, unknown>;
}

/** Injectable infra — defaults wired lazily so the static graph stays test-safe. */
export interface AiOperationDeps {
  charge: (operation: string, requestId: string) => Promise<ChargeOutcome>;
  getLlm: (opts?: { requiresImages?: boolean }) => OperationLlm | null;
  resolveUser: () => Promise<AuthUser | null>;
  rateLimit: {
    check: typeof checkRateLimit;
    key: typeof rateLimitKey;
    enabled: typeof isRateLimitEnabled;
    limits: typeof RATE_LIMITS;
  };
  newRequestId: () => string;
  /**
   * Establish the LightTrack cost/margin billing context (customer + feature) around the model
   * call, so the `trackLlm` emission deep in the LLM client is attributed to the metered user.
   * Optional + defaults to a passthrough — the unit suite (which doesn't exercise telemetry) omits
   * it, and the lazy `defaultDeps()` wires the real `runWithBilling` from `@/lib/cost-telemetry`.
   */
  runWithBilling?: <T>(
    ctx: { customerId?: string; feature?: string },
    fn: () => Promise<T>,
  ) => Promise<T>;
}

/** A client idempotency key must be a short, safe token to be used as a ledger
 *  ref — bound the length and charset so an untrusted header can't inject a huge
 *  or weird ref. Returns the trimmed key, or null when absent/invalid. */
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_.:-]{1,200}$/;
function readIdempotencyKey(request: Request): string | null {
  const raw =
    request.headers.get("Idempotency-Key") ?? request.headers.get("idempotency-key");
  if (!raw) return null;
  const key = raw.trim();
  return IDEMPOTENCY_KEY_RE.test(key) ? key : null;
}

let cachedDefaults: AiOperationDeps | null = null;

/**
 * Lazily wire the real server-only infra. Never called from the unit suite.
 *
 * CONTRACT: the deps bundle is wired ONCE and treated as process-lifetime
 * immutable (we only cache to avoid re-importing the modules per request). This
 * is safe because the cached values are STABLE FUNCTION references that re-read
 * their own config on each call — `getLlm(opts)` re-resolves the engine/env per
 * request, and `runWithBilling` reads `cost-telemetry.config()` internally — so
 * an operator rotating a key or toggling telemetry takes effect on the next
 * request WITHOUT a restart. Do NOT cache a value DERIVED from env here (e.g. a
 * pre-resolved engine), or it would pin the first request's config.
 */
async function defaultDeps(): Promise<AiOperationDeps> {
  if (cachedDefaults) return cachedDefaults;
  const [{ chargeForOperation }, { getLlm }, { getUser }, { runWithBilling }] = await Promise.all([
    import("@/lib/tokens/guard"),
    import("@/lib/llm/client"),
    import("@/lib/auth/session"),
    import("@/lib/cost-telemetry"),
  ]);
  cachedDefaults = {
    charge: chargeForOperation,
    getLlm: (opts) => getLlm(opts) as OperationLlm | null,
    resolveUser: () => getUser() as Promise<AuthUser | null>,
    rateLimit: {
      check: checkRateLimit,
      key: rateLimitKey,
      enabled: isRateLimitEnabled,
      limits: RATE_LIMITS,
    },
    newRequestId: randomUUID,
    runWithBilling,
  };
  return cachedDefaults;
}

/**
 * Run one AI operation end-to-end and return the HTTP response.
 *
 * Stage order is fixed and owned here; per-route variation lives entirely in
 * `spec`. `deps` is for tests only — production callers omit it and get the real
 * token guard / LLM client / auth session.
 */
export async function executeAiOperation<TInput, TOutput>(
  request: Request,
  spec: AiOperationSpec<TInput, TOutput>,
  deps?: AiOperationDeps,
): Promise<NextResponse> {
  const d = deps ?? (await defaultDeps());

  // 1. Parse the JSON body. A malformed body is a flat 400 (no disclaimer, to
  //    match the existing routes — there is no domain payload to disclaim yet).
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Memoize the user lookup: parse (owner gates) and persist share one call.
  let userResolved = false;
  let userValue: AuthUser | null = null;
  const resolveUser = async (): Promise<AuthUser | null> => {
    if (!userResolved) {
      userValue = await d.resolveUser();
      userResolved = true;
    }
    return userValue;
  };

  // 2. Route-specific validation + auth gates. Returns its own error response.
  const parsed = await spec.parse({ request, body, resolveUser });
  if (!parsed.ok) return parsed.response;
  const input = parsed.value;

  // 3. Rate-limit BEFORE charging or any model work, so a flood can't run up
  //    model cost or drain a balance unchecked.
  if (spec.rateLimit && d.rateLimit.enabled()) {
    const { bucket, scope, byUser } = spec.rateLimit;
    // For byUser ops, key on the resolved user id; an UNauthenticated caller
    // (these routes 401 at charge anyway) buckets into a SHARED `:u:anon` key,
    // NOT per-IP — so a spoofed x-forwarded-for can't fan out the bucket map and
    // the "user-keying stops IP-rotation evasion" guarantee actually holds.
    const keyUser = byUser ? ((await resolveUser())?.id ?? "anon") : undefined;
    const rl = d.rateLimit.check(
      d.rateLimit.key(request, scope, keyUser),
      d.rateLimit.limits[bucket],
    );
    if (!rl.ok) {
      return NextResponse.json(
        { error: "rate_limited", retryAfterSec: rl.retryAfterSec, disclaimer: DISCLAIMER },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
    }
  }

  // 4. Debit upfront (charge-then-reclaim). A caller who can't pay never reaches
  //    the model. Free pass in keyless/dev builds (handled inside the guard).
  const operationKey =
    typeof spec.operation === "function" ? spec.operation(input) : spec.operation;
  // Request idempotency: a client that retries a dropped/timed-out request (or
  // double-clicks an expensive draft/rfe button) can pass an `Idempotency-Key`
  // header. We fold it into the ledger ref so the retry's charge DE-DUPES against
  // the first (the store keys debits on `(ref, reason)`) — no double-billing.
  // Scoped by user id so two different users can't collide on the same key. (The
  // model may still re-run on the retry; full response-replay/caching is a
  // separate follow-up — this closes the double-CHARGE, the money leak.) Absent
  // or malformed key → a fresh per-call id, i.e. the prior behaviour.
  const idemKey = readIdempotencyKey(request);
  const requestId = idemKey
    ? `idem:${(await resolveUser())?.id ?? "anon"}:${operationKey}:${idemKey}`
    : d.newRequestId();
  const charged = await d.charge(operationKey, requestId);
  if (!charged.ok) {
    if (charged.reason === "unauthenticated") {
      return NextResponse.json({ error: spec.unauthenticatedError }, { status: 401 });
    }
    // 402: out of tokens. Echo cost/balance for the paywall; keep the
    // not-legal-advice disclaimer present on this path too (UPL safeguard).
    return NextResponse.json(
      {
        error: "insufficient_tokens",
        cost: charged.cost,
        balance: charged.balance,
        disclaimer: DISCLAIMER,
      },
      { status: 402 },
    );
  }

  // 5. Call the model. No engine → deterministic mock (legitimate keyless
  //    result, no reclaim). With an engine, an exception OR an unusable response
  //    reclaims the charge and falls back to the mock labelled source:"mock" —
  //    a mock is never billed as model output.
  const llm = d.getLlm({ requiresImages: spec.requiresImages });
  let output: TOutput;
  let source: string;
  // Reclaim at most once. `reclaim()` wraps the refund in try/catch so a ledger
  // hiccup can't (a) double-refund or (b) escalate a serviceable mock fallback
  // into a 500 — the charge stays debited but the user still gets their mock.
  let reclaimed = false;
  const reclaim = async () => {
    if (reclaimed) return;
    reclaimed = true;
    try {
      await charged.reclaim();
    } catch (err) {
      console.error(`[ai] ${operationKey} reclaim failed (charge left debited)`, err);
    }
  };
  try {
    if (!llm) {
      output = spec.mock(input);
      source = "mock";
    } else {
      // (a) Model call. A failure here means NO billable output was produced →
      //     reclaim + mock. `raw` stays null so the guard step is skipped.
      let raw: string | null = null;
      try {
        const { text, options } = spec.prompt(input);
        // Attribute the LLM cost emitted by this generate() (via the client's `trackLlm` seam) to the
        // metered user, so LightTrack can net it against revenue for margin. No-op telemetry-side when
        // unconfigured; the user id may be undefined on the keyless/dev free-pass path.
        const billing = d.runWithBilling ?? ((_ctx, fn) => fn());
        const customerId = (await resolveUser())?.id;
        try {
          raw = await billing(
            { customerId, feature: operationKey },
            () => llm.generate(text, options),
          );
        } catch (billingErr) {
          // The billing/telemetry wrapper failed (ALS context setup, sink hiccup)
          // — telemetry is a SIDE concern, so fail OPEN: retry the model call
          // UNGAUGED rather than degrading a working generation to mock. If the
          // model itself is down, this rethrows → the outer catch reclaims + mocks.
          // (The real runWithBilling only `.run()`s an ALS context, so a throw is
          // at setup, before generate() runs — no double model call.)
          console.error(`[ai] ${operationKey} billing wrapper failed; retrying ungauged`, billingErr);
          raw = await llm.generate(text, options);
        }
      } catch (err) {
        console.error(`[ai] ${operationKey} model call failed; serving mock`, err);
        await reclaim();
      }
      // (b) Guard runs OUTSIDE the model try — it operates on already-returned,
      //     already-BILLED text. A guard *throw* is a parser regression on a paid
      //     response, NOT a model failure: log it loudly so it can't masquerade
      //     as a normal keyless mock forever, then reclaim + mock like guard null.
      if (raw === null) {
        output = spec.mock(input);
        source = "mock";
      } else {
        let guarded: TOutput | null;
        try {
          guarded = spec.guard(raw, input);
        } catch (err) {
          console.error(
            `[ai] ${operationKey} guard threw on a billed response (parser regression)`,
            err,
          );
          guarded = null;
        }
        if (guarded === null) {
          await reclaim();
          output = spec.mock(input);
          source = "mock";
        } else {
          output = guarded;
          source = llm.name;
        }
      }
    }
  } catch {
    // The deterministic mock (the last-resort fallback) itself threw. Reclaim
    // any still-outstanding charge and emit a structured 500 that STILL carries
    // the DISCLAIMER — the UPL invariant: every error body this orchestrator
    // emits includes it (a raw framework 500 would not).
    await reclaim();
    return NextResponse.json(
      { error: "generation_failed", disclaimer: DISCLAIMER },
      { status: 500 },
    );
  }

  // 6. Persist best-effort — a storage hiccup must never fail a paid response.
  let persisted: Record<string, unknown> = {};
  if (spec.persist) {
    try {
      persisted = await spec.persist(output, input, await resolveUser(), source);
    } catch {
      persisted = spec.onPersistError?.(input) ?? {};
    }
  }

  // 7. Respond. `build` owns the domain body (incl. its own DISCLAIMER); persist
  //    fields (caseId / version / saveFailed) are merged on top.
  const responseBody = spec.build(output, source, input);

  // 8. Live adjudication-risk gate — score the built body and attach the report.
  //    Best-effort: a throw here must never fail a generation the user paid for.
  //    Skipped on a mock: a deterministic template's "risk score" would be
  //    constant theater that reads like a real assessment of the user's case
  //    (mirrors the "a mock is never billed as model output" honesty invariant).
  //
  //    CONTRACT (persist-always vs adjudicate-skip-on-mock): step 6 persists EVERY
  //    non-error outcome, INCLUDING a mock — so a persisted draft/qualify/RFE may
  //    carry NO adjudication report while an engine-generated twin does. This is
  //    intentional and safe: (a) a mock is a deterministic TEMPLATE — it has no
  //    fabricated specifics / leaked codes / invented case law for the gate to
  //    catch, so adjudicating it would be theater; (b) `source: "mock"` is
  //    persisted end-to-end (persist receives `source`) and the UI flags
  //    "Placeholder output" before any attorney action; (c) filing is separately
  //    guarded (pre-file draft-exists gate + the exhibit-citation gate). So an
  //    unadjudicated mock can be SAVED but never silently presents as a screened,
  //    attorney-ready work product. Do not "fix" this by adjudicating mocks.
  let adjudication: AdjudicationReport | null = null;
  if (spec.adjudicate && source !== "mock") {
    try {
      adjudication = spec.adjudicate(output, input, source, responseBody) ?? null;
    } catch {
      adjudication = null;
    }
  }

  // 9. UPL hard-stop. If the live screen BLOCKED the output and the route opts in
  //    via `onBlocked`, withhold the flagged model text entirely: reclaim the
  //    charge (a withheld answer is not billed) and send the safe replacement
  //    body instead. Without this, a `risk: "blocked"` answer (e.g. "you should
  //    file an O-1A") would still be shipped to the client and merely badged —
  //    the exact unauthorized-practice text the gate exists to suppress.
  let finalBody = responseBody;
  if (adjudication && adjudication.attorneyReady === false && spec.onBlocked) {
    await reclaim();
    finalBody = spec.onBlocked(input, responseBody, adjudication);
  }

  return NextResponse.json({
    ...finalBody,
    ...persisted,
    ...(adjudication ? { adjudication } : {}),
  });
}
