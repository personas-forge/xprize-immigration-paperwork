import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  DISCLAIMER,
  buildGuidancePrompt,
  buildGuidanceResponse,
  mockGuidance,
  parseGuidanceRequest,
} from "@/features/guidance/guidance";
import { chargeForOperation } from "@/lib/tokens/guard";
import { getLlm } from "@/lib/llm/client";
import {
  RATE_LIMITS,
  checkRateLimit,
  isRateLimitEnabled,
  rateLimitKey,
} from "@/lib/rate-limit";

// USCIS form-field guidance endpoint.
//
// Given { formId, fieldLabel, situation } it returns
// { guidance, disclaimer, source } where `disclaimer` ALWAYS states this is
// general information, not legal advice, and that an attorney of record is
// required. The disclaimer is attached in buildGuidanceResponse — there is no
// code path that returns guidance without it.
//
// Graceful fallback: with no GEMINI_API_KEY (the default, secret-free build),
// we return deterministic templated guidance. With a key set, we call Gemini
// using a prompt that instructs the model to give general informational
// guidance only, never legal advice, and to recommend attorney review.

// Node runtime — the Google SDK is not Edge-safe.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseGuidanceRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const req = parsed.value;

  // Rate limit BEFORE charging or any model work. Keyed by client IP (this route
  // stays auth-decoupled for the keyless build), so a flood can't run up model
  // cost or drain a balance unchecked.
  if (isRateLimitEnabled()) {
    const rl = checkRateLimit(rateLimitKey(request, "guidance"), RATE_LIMITS.guidance);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "rate_limited", retryAfterSec: rl.retryAfterSec, disclaimer: DISCLAIMER },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
    }
  }

  // Token economy (Procedure 2): debit one "light" token up front, before any
  // model work. The guard is a free pass when auth/DB/TOKENS_BYPASS aren't
  // configured, so the keyless/mock build keeps working unmetered.
  const requestId = randomUUID();
  const charged = await chargeForOperation("guidance", requestId);
  if (!charged.ok) {
    if (charged.reason === "unauthenticated") {
      return NextResponse.json({ error: "Sign in to use guidance." }, { status: 401 });
    }
    // 402: out of tokens. Echo cost/balance for the paywall, and keep the
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

  const llm = getLlm();

  // No engine → templated informational fallback. Build stays secret-free.
  if (!llm) {
    return NextResponse.json(buildGuidanceResponse(mockGuidance(req), "mock"));
  }

  // Engine present → generate with the not-legal-advice prompt.
  try {
    const text = await llm.generate(buildGuidancePrompt(req), { tier: "fast" });
    const guidance = text.trim() || mockGuidance(req);
    return NextResponse.json(buildGuidanceResponse(guidance, llm.name));
  } catch {
    // Model/network failure must still return safe, disclaimed guidance — and
    // we refund the token since the user never got a model-generated answer.
    await charged.reclaim();
    return NextResponse.json(buildGuidanceResponse(mockGuidance(req), "mock"), {
      status: 200,
    });
  }
}
