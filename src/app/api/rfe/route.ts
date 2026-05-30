import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  DISCLAIMER,
  buildRfePrompt,
  buildRfeResult,
  mockRfe,
  parseRfeRequest,
  parseRfeResponse,
  type RfeRequest,
  type RfeResult,
} from "@/features/rfe";
import { chargeForOperation } from "@/lib/tokens/guard";
import { getLlm } from "@/lib/llm/client";
import { getUser } from "@/lib/auth/session";
import { isAttorney } from "@/lib/auth/roles";
import {
  getCaseAnyOwner,
  getCaseForUser,
  getCriteriaForCase,
  saveRfeResponse,
} from "@/lib/data/petitions";

// RFE (Request for Evidence) response drafting endpoint.
//
// Body: { rfeText, caseId? } or { rfeText, petitioner?, classification?, criteria? }.
// The RFE notice text is required; the petition context comes from the case
// (DB path — owner or attorney) or from an inline payload (demo path). Same
// graceful fallback + token discipline as /api/draft. Charges the "rfe" op.

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

  const record = (body ?? {}) as Record<string, unknown>;
  const caseId = typeof record.caseId === "string" ? record.caseId : null;

  // Resolve the request (validate BEFORE charging). Prefer the DB case context.
  let resolved: RfeRequest | null = null;
  let resolvedCaseId: string | null = null;

  if (caseId) {
    const user = await getUser();
    if (user) {
      const stored =
        (await getCaseForUser(user.id, caseId)) ??
        (isAttorney(user.email) ? await getCaseAnyOwner(caseId) : null);
      if (stored) {
        const criteria = await getCriteriaForCase(caseId);
        const parsed = parseRfeRequest({
          petitioner: stored.petitioner,
          classification: stored.classification,
          criteria,
          rfeText: record.rfeText,
        });
        if (!parsed.ok) {
          return NextResponse.json({ error: parsed.error }, { status: 400 });
        }
        resolved = parsed.value;
        resolvedCaseId = stored.id;
      }
    }
  }
  if (!resolved) {
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
      result = buildRfeResult(parseRfeResponse(text, req), llm.name);
    } catch {
      await charged.reclaim();
      result = buildRfeResult(mockRfe(req), "mock");
    }
  }

  // Persist a new RFE response version (no-op without DB). Best-effort.
  let version: number | null = null;
  if (resolvedCaseId) {
    try {
      version = await saveRfeResponse(resolvedCaseId, req.rfeText, result.sections, result.source);
    } catch {
      version = null;
    }
  }

  return NextResponse.json({ ...result, caseId: resolvedCaseId, version });
}
