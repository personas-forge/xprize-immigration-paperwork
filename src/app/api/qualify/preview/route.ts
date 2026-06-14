import { NextResponse } from "next/server";
import {
  buildQualifyResult,
  mockQualification,
  parseQualifyRequest,
} from "@/features/qualification";
import {
  checkRateLimit,
  isRateLimitEnabled,
  rateLimitKey,
} from "@/lib/tokens/rate-limit";
import { DISCLAIMER } from "@/lib/result";

// Anonymous Instant-Verdict preview (moonshot #16).
//
// The hero screener calls this so a visitor gets a personalized, branded
// verdict with ZERO signup. It deliberately runs ONLY the deterministic,
// keyless screening (`parseQualifyRequest` → `mockQualification` →
// `buildQualifyResult`): no charge, no persistence, no per-user rate limit, and
// — critically — no model call, so it can never run up cost or leak a paid
// engine to anonymous traffic. The real (charged, model-backed) screening stays
// behind the authenticated /api/qualify. The result is always labelled
// `source: "mock"` and carries the not-legal-advice DISCLAIMER like every other
// AI output path.
//
// The only abuse surface is a flood, so a generous per-IP cap (far above real
// hero use) is applied before any work. Keyed by IP (not user) on its own
// `qualify_preview` scope so it can't exhaust the authenticated qualify bucket.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Per-IP/minute cap. Generous: the preview is free + instant, so this only
 *  exists to stop a flood, not to ration legitimate use. */
const PREVIEW_LIMIT = 30;

export async function POST(request: Request): Promise<NextResponse> {
  if (isRateLimitEnabled()) {
    const rl = checkRateLimit(
      rateLimitKey(request, "qualify_preview"),
      PREVIEW_LIMIT,
    );
    if (!rl.ok) {
      return NextResponse.json(
        {
          error: "rate_limited",
          retryAfterSec: rl.retryAfterSec,
          disclaimer: DISCLAIMER,
        },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
    }
  }

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

  // Deterministic, keyless screening — never the model, never a charge, never
  // persisted. Always labelled "mock".
  const assessment = mockQualification(parsed.value);
  return NextResponse.json(buildQualifyResult(assessment, "mock"));
}
