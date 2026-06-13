import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  DISCLAIMER,
  buildRfePrompt,
  buildRfeResult,
  mockRfe,
  parseRfeRequest,
  tryParseRfeResponse,
  type RfeRequest,
  type RfeResult,
} from "@/features/rfe";
import { chargeForOperation } from "@/lib/tokens/guard";
import { getLlm } from "@/lib/llm/client";
import { authorizeRoute } from "@/lib/auth/authorizeRoute";
import { getCriteriaForCase, saveRfeResponse } from "@/lib/data/petitions";
import {
  RATE_LIMITS,
  checkRateLimit,
  isRateLimitEnabled,
  rateLimitKey,
} from "@/lib/rate-limit";

// RFE (Request for Evidence) response drafting endpoint.
//
// Body: { rfeText, caseId? } or { rfeText, petitioner?, classification?, criteria? }.
// The RFE notice text is required; the petition context comes from the case
// (DB path — owner, or an EXPLICITLY allow-listed attorney of record) or from an
// inline payload (demo path, caseId-less only). Same graceful fallback + token
// discipline as /api/draft. Charges the "rfe" op.

// Node runtime — the Google SDK and `pg` are not Edge-safe.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  // Resolve user + case access up front (ADR-0006: authorizeRoute owns the
  // owner-or-configured-attorney fail-closed decision). It reads the body's
  // caseId from a clone, so the original request is still parseable below. A
  // supplied caseId that the caller can't access never falls through to the
  // inline payload — unauthenticated → 401, no access → 403. Case resolution now
  // runs as part of authorizeRoute (one indexed read) ahead of the rate limit;
  // the rate-limit invariant protects the charge + model call, which still come
  // after, so this is the one documented behavior nuance.
  const auth = await authorizeRoute(request, {
    requiresCase: true,
    requiresAttorney: true,
  });
  if (auth.status === "unauthenticated") {
    return NextResponse.json(
      { error: "Sign in to respond to an RFE on a saved case." },
      { status: 401 },
    );
  }
  if (auth.status === "forbidden") {
    return NextResponse.json(
      { error: "You don't have access to this case." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const record = (body ?? {}) as Record<string, unknown>;

  // user (possibly null on the inline/demo path) keys the rate limit.
  const user = auth.user;

  // Rate limit BEFORE charging or any model work.
  if (isRateLimitEnabled()) {
    const rl = checkRateLimit(rateLimitKey(request, "rfe", user?.id), RATE_LIMITS.rfe);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "rate_limited", retryAfterSec: rl.retryAfterSec, disclaimer: DISCLAIMER },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
    }
  }

  // Build the request context (validate BEFORE charging): from the authorized
  // case (DB path) or the inline payload (demo path, caseId-less only).
  let resolved: RfeRequest;
  let resolvedCaseId: string | null = null;

  if (auth.status === "ok") {
    // Loading the case criteria can throw if the store errors mid-query (a
    // configured store does NOT degrade to []). Catch it here — before any
    // charge — so it returns a structured, disclaimer-bearing error instead of a
    // raw Next.js 500, matching the rest of this route's contract.
    let criteria: Awaited<ReturnType<typeof getCriteriaForCase>>;
    try {
      criteria = await getCriteriaForCase(auth.case.id);
    } catch (err) {
      console.error("[/api/rfe] failed to load case criteria", err);
      return NextResponse.json(
        {
          error: "We couldn't load the case criteria. Please try again.",
          disclaimer: DISCLAIMER,
        },
        { status: 503 },
      );
    }
    const parsed = parseRfeRequest({
      petitioner: auth.case.petitioner,
      classification: auth.case.classification,
      criteria,
      rfeText: record.rfeText,
    });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    resolved = parsed.value;
    resolvedCaseId = auth.case.id;
  } else {
    const parsed = parseRfeRequest(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    resolved = parsed.value;
  }
  const req = resolved;

  // Token economy: "rfe" = heavy (5). Free pass when auth/DB/TOKENS_BYPASS off.
  const requestId = randomUUID();
  const charged = await chargeForOperation("rfe", requestId);
  if (!charged.ok) {
    if (charged.reason === "unauthenticated") {
      return NextResponse.json(
        { error: "Sign in to draft an RFE response." },
        { status: 401 },
      );
    }
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

  const llm = getLlm();
  let result: RfeResult = buildRfeResult(mockRfe(req), "mock");
  if (llm) {
    try {
      const text = await llm.generate(buildRfePrompt(req), { json: true, tier: "long" });
      const parsed = tryParseRfeResponse(text);
      if (parsed) {
        result = buildRfeResult(parsed, llm.name);
      } else {
        // Unusable model output: reclaim the heavy charge and label the fallback
        // "mock" — otherwise the mock is billed AND persisted stamped as a model
        // response, permanently mislabeling the case history.
        await charged.reclaim();
        result = buildRfeResult(mockRfe(req), "mock");
      }
    } catch {
      await charged.reclaim();
      result = buildRfeResult(mockRfe(req), "mock");
    }
  }

  // Persist a new RFE response version (no-op without DB). The user already paid,
  // so a storage failure is SURFACED (saveFailed), never silently swallowed.
  let version: number | null = null;
  let saveFailed = false;
  if (resolvedCaseId) {
    try {
      version = await saveRfeResponse(resolvedCaseId, req.rfeText, result.sections, result.source);
    } catch (err) {
      saveFailed = true;
      console.error("[/api/rfe] failed to persist RFE response version", err);
    }
  }

  return NextResponse.json({ ...result, caseId: resolvedCaseId, version, saveFailed });
}
