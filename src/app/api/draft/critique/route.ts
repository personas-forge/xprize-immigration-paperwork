import { type NextResponse } from "next/server";
import { executeAiOperation } from "@/lib/ai/operation";
import { critiqueSpec } from "@/features/drafting/critiqueOperation";

// Adjudicator-redline endpoint (moonshot #19).
//
// A second, charged model pass that grades the draft sections the client is
// holding and returns a per-section score + weakness + ready rewrite. Billed as
// the heavy `draft_section` op and owner-gated (when a caseId is supplied) by
// the declarative critiqueSpec; the whole money path is owned by
// executeAiOperation. It never persists — the studio's "Apply" saves an accepted
// rewrite through /api/draft/save.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request): Promise<NextResponse> {
  return executeAiOperation(request, critiqueSpec);
}
