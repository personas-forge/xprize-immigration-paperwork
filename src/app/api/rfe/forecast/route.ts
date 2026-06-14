import { type NextResponse } from "next/server";
import { executeAiOperation } from "@/lib/ai/operation";
import { forecastSpec } from "@/features/rfe/forecastOperation";

// RFE Risk Radar endpoint (moonshot #20).
//
// Predicts which criteria USCIS is most likely to challenge BEFORE filing, so
// the petition ships pre-hardened. Billed as the heavy `rfe` op and owner-gated
// (when a caseId is supplied) by the declarative forecastSpec; the whole money
// path is owned by executeAiOperation. It never persists.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request): Promise<NextResponse> {
  return executeAiOperation(request, forecastSpec);
}
