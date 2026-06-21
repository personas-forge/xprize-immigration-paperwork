import { NextResponse } from "next/server";
import { parseQualifyRequest } from "@/features/qualification";
import { recommendBestPath } from "@/features/qualification/best-path";
import {
  PREVIEW_RATE_LIMIT,
  checkRateLimit,
  isRateLimitEnabled,
  rateLimitKey,
} from "@/lib/tokens/rate-limit";
import { DISCLAIMER } from "@/lib/result";

// Anonymous best-path recommender (moonshot #7).
//
// Scores ONE profile against EVERY live program in a single pass and returns
// them ranked, with the strongest/fastest route recommended — answering "which
// visa should I even pursue?" before the applicant has to guess. Like the
// Instant-Verdict preview it runs only the deterministic, keyless engine
// (`recommendBestPath` → `scoreAllPrograms` over `mockQualification`): no charge,
// no model, no persistence. Generous per-IP cap on its own scope guards a flood.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  if (isRateLimitEnabled()) {
    const rl = checkRateLimit(
      rateLimitKey(request, "best_path_preview"),
      PREVIEW_RATE_LIMIT,
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

  // Reuse the screening validator (profile length + name); the classification it
  // parses is ignored — best-path scores all live programs.
  const parsed = parseQualifyRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = recommendBestPath({
    profile: parsed.value.profile,
    name: parsed.value.name,
  });
  return NextResponse.json(result);
}
