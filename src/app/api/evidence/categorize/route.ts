import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  DISCLAIMER,
  buildCategorizePrompt,
  buildCategorizeResult,
  mockCategorize,
  parseCategorizeRequest,
  tryParseCategorizeResponse,
  type CategorizeResult,
} from "@/features/evidence";
import { chargeForOperation } from "@/lib/tokens/guard";
import { getLlm } from "@/lib/llm/client";
import { authorizeRoute, type Authorized } from "@/lib/auth/authorizeRoute";
import {
  RATE_LIMITS,
  checkRateLimit,
  isRateLimitEnabled,
  rateLimitKey,
} from "@/lib/rate-limit";
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
  // Resolve case access BEFORE consuming the body, so authorizeRoute can read
  // the caseId from a clone (ADR-0006). Best-effort for this route: persistence
  // is a side effect, so any resolution failure simply means "no document" —
  // never a hard 401/403. The owner-or-configured-attorney fail-closed rule
  // (which keeps a stranger from injecting an exhibit into another applicant's
  // vault) now lives in authorizeRoute, not inline here.
  let auth: Authorized | null;
  try {
    auth = await authorizeRoute(request, {
      requiresCase: true,
      requiresAttorney: true,
    });
  } catch {
    auth = null;
  }

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
  const classification =
    typeof record.classification === "string" ? record.classification : "O-1A";

  // Rate limit BEFORE charging or any model work, keyed by client IP (this route
  // stays auth-decoupled for the keyless build) — so a flood can't run up model
  // cost or drain a balance unchecked, matching the other charged AI routes.
  if (isRateLimitEnabled()) {
    const rl = checkRateLimit(rateLimitKey(request, "categorize"), RATE_LIMITS.categorize);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "rate_limited", retryAfterSec: rl.retryAfterSec, disclaimer: DISCLAIMER },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
    }
  }

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
      const parsed = tryParseCategorizeResponse(text, classification);
      if (parsed) {
        result = buildCategorizeResult(parsed, llm.name);
      } else {
        // Unusable model output: reclaim the charge and label honestly, instead
        // of billing for a deterministic mock stamped as model output.
        await charged.reclaim();
        result = buildCategorizeResult(mockCategorize(req, classification), "mock");
      }
    } catch {
      await charged.reclaim();
      result = buildCategorizeResult(mockCategorize(req, classification), "mock");
    }
  }

  // Persist to the case vault when the caller can access the case (resolved
  // above by authorizeRoute: owner, or the configured attorney of record).
  // Best-effort — a storage failure just yields no document, never an error.
  let document = null;
  if (auth?.status === "ok") {
    try {
      document = await addCaseDocument({
        caseId: auth.case.id,
        name: req.name,
        criterion: result.criterion,
        facts: result.facts,
        source: result.source,
      });
    } catch {
      document = null;
    }
  }

  return NextResponse.json({ ...result, document });
}
