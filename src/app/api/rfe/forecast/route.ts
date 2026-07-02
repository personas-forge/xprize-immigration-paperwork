import { type NextResponse } from "next/server";
import { executeAiOperation } from "@/lib/ai/operation";
import { forecastSpec } from "@/features/rfe/forecastOperation";

// RFE Risk Radar endpoint (moonshot #20).
//
// Predicts which criteria USCIS is most likely to challenge BEFORE filing, so
// the petition ships pre-hardened. Billed as the heavy `rfe` op and owner-gated
// (when a caseId is supplied) by the declarative forecastSpec; the whole money
// path is owned by executeAiOperation. It never persists.


export function POST(request: Request): Promise<NextResponse> {
  return executeAiOperation(request, forecastSpec);
}

// A charged generation can legitimately run past serverless defaults (per-tier
// engine deadlines + bounded retries in src/lib/llm/engines.ts). On Vercel this
// raises the function cap; lower-tier plans clamp it automatically.
export const maxDuration = 120;
