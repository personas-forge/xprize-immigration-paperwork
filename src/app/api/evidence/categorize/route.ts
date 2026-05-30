import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  DISCLAIMER,
  buildCategorizePrompt,
  buildCategorizeResult,
  mockCategorize,
  parseCategorizeRequest,
  parseCategorizeResponse,
  type CategorizeResult,
} from "@/features/evidence";
import { chargeForOperation } from "@/lib/tokens/guard";
import { getLlm } from "@/lib/llm/client";
import { getUser } from "@/lib/auth/session";
import { isAttorney } from "@/lib/auth/roles";
import { getCaseAnyOwner, getCaseForUser } from "@/lib/data/petitions";
import { addCaseDocument } from "@/lib/data/evidence";

// Evidence categorization endpoint.
//
// Body: { name, content, caseId? }. Classifies a document into one of the eight
// O-1A criteria (or "Unsorted") and extracts key facts. When a caseId resolves
// to a case the user can access (owner or attorney), the document is persisted
// to the vault with an auto-assigned exhibit number. Same graceful fallback +
// token discipline as the other AI routes. Charges the "categorize" op.

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

  const parsed = parseCategorizeRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const req = parsed.value;
  const record = (body ?? {}) as Record<string, unknown>;
  const caseId = typeof record.caseId === "string" ? record.caseId : null;
  const classification =
    typeof record.classification === "string" ? record.classification : "O-1A";

  // Token economy: categorize = light (1). Free pass when auth/DB/bypass off.
  const requestId = randomUUID();
  const charged = await chargeForOperation("categorize", requestId);
  if (!charged.ok) {
    if (charged.reason === "unauthenticated") {
      return NextResponse.json({ error: "Sign in to add evidence." }, { status: 401 });
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

  // Text categorization works on any engine. NOTE: when binary PDF/image OCR is
  // added, that path must use getLlm({ requiresImages: true }) so it never lands
  // on the Claude CLI engine (which doesn't process images).
  const llm = getLlm();
  let result: CategorizeResult;
  if (!llm) {
    result = buildCategorizeResult(mockCategorize(req, classification), "mock");
  } else {
    try {
      const text = await llm.generate(buildCategorizePrompt(req, classification), {
        json: true,
        tier: "fast",
      });
      result = buildCategorizeResult(
        parseCategorizeResponse(text, req, classification),
        llm.name,
      );
    } catch {
      await charged.reclaim();
      result = buildCategorizeResult(mockCategorize(req, classification), "mock");
    }
  }

  // Persist to the case vault when the user can access the case. Best-effort.
  let document = null;
  if (caseId) {
    try {
      const user = await getUser();
      if (user) {
        const stored =
          (await getCaseForUser(user.id, caseId)) ??
          (isAttorney(user.email) ? await getCaseAnyOwner(caseId) : null);
        if (stored) {
          document = await addCaseDocument({
            caseId: stored.id,
            name: req.name,
            criterion: result.criterion,
            facts: result.facts,
            source: result.source,
          });
        }
      }
    } catch {
      document = null;
    }
  }

  return NextResponse.json({ ...result, document });
}
