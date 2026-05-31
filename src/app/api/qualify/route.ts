import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  DISCLAIMER,
  buildQualifyPrompt,
  buildQualifyResult,
  mockQualification,
  parseQualifyRequest,
  parseQualifyResponse,
  type QualifyResult,
} from "@/features/qualification";
import { chargeForOperation } from "@/lib/tokens/guard";
import { getLlm } from "@/lib/llm/client";
import { getUser } from "@/lib/auth/session";
import { createCaseWithCriteria } from "@/lib/data/petitions";

// O-1A qualification screening endpoint.
//
// Given { profile, name } it returns a QualifyResult — the eight O-1A criteria
// scored, an overall likelihood, gaps, and (always) the not-legal-advice
// DISCLAIMER. Same shape of graceful fallback as /api/guidance: with no
// GEMINI_API_KEY it returns a deterministic keyword-based screening; with a key
// it asks Gemini for strict JSON and normalizes it.
//
// On success, if a user is signed in and a database is configured, the result
// is persisted as a case (+ its criteria) so it can be drafted later; the
// response carries the new `caseId` (null when not persisted).

// Node runtime — the Google SDK and `pg` are not Edge-safe.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseQualifyRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const req = parsed.value;

  // Token economy: debit one "medium" charge up front (structured screening),
  // before any model work. Free pass when auth/DB/TOKENS_BYPASS aren't set.
  const requestId = randomUUID();
  const charged = await chargeForOperation("qualify", requestId);
  if (!charged.ok) {
    if (charged.reason === "unauthenticated") {
      return NextResponse.json(
        { error: "Sign in to run a qualification assessment." },
        { status: 401 },
      );
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

  const llm = getLlm();
  let result: QualifyResult;

  if (!llm) {
    // No engine → deterministic informational screening. Build stays secret-free.
    result = buildQualifyResult(mockQualification(req), "mock");
  } else {
    try {
      // temperature 0: a screening should be as deterministic as the engine
      // allows (Gemini honors this; the Claude CLI path has no temperature knob).
      const text = await llm.generate(buildQualifyPrompt(req), { json: true, tier: "fast", temperature: 0 });
      result = buildQualifyResult(parseQualifyResponse(text, req), llm.name);
    } catch {
      // Model/network failure must still return a safe, disclaimed screening —
      // and we refund the token since the user never got a model answer.
      await charged.reclaim();
      result = buildQualifyResult(mockQualification(req), "mock");
    }
  }

  // Persist as a case for the signed-in user (no-op when no DB). Best-effort:
  // a storage hiccup must not fail the screening the user already paid for.
  let caseId: string | null = null;
  try {
    const user = await getUser();
    if (user) {
      const created = await createCaseWithCriteria({
        userId: user.id,
        petitioner: req.name,
        classification: req.classification,
        approvalLikelihood: result.likelihood,
        criteria: result.criteria,
      });
      caseId = created?.id ?? null;
    }
  } catch {
    caseId = null;
  }

  return NextResponse.json({ ...result, caseId });
}
