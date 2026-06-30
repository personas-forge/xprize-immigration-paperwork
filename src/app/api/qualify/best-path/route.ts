import { NextResponse } from "next/server";
import { parseQualifyRequest } from "@/features/qualification";
import {
  buildBestPathPrompt,
  parseBestPathResponse,
  recommendBestPath,
  type BestPathRequest,
  type BestPathResult,
} from "@/features/qualification/best-path";
import { executeAiOperation } from "@/lib/ai/operation";

// Model-backed best-path (LLM-1 / UAT T1). Unlike the keyless preview, this runs
// the REAL model to read the whole record against every live pack and recommend
// a path WITH cross-classification reasoning + EB-1A higher-bar candor — fixing
// the first-screen defect where the keyword mock under-reads non-default
// profiles (director, composer, chef, athlete) and frames EB-1A as a free bonus.
//
// Authenticated + metered (reuses the `qualify` op tier + rate-limit bucket, so
// no new economy entry). On a model throw OR unusable output the orchestrator
// reclaims the charge and returns the deterministic keyword ranking labelled
// `source: "mock"` — a mock is never billed as model output.


export function POST(request: Request): Promise<NextResponse> {
  return executeAiOperation<BestPathRequest, BestPathResult>(request, {
    operation: "qualify",
    rateLimit: { bucket: "qualify", scope: "best_path", byUser: true },
    unauthenticatedError: "Sign in to run a model-backed best-path comparison.",
    parse: ({ body }) => {
      // Reuse the screening validator (profile length + name); the classification
      // it parses is ignored — best-path scores all live programs.
      const parsed = parseQualifyRequest(body);
      return parsed.ok
        ? {
            ok: true,
            value: { profile: parsed.value.profile, name: parsed.value.name },
          }
        : {
            ok: false,
            response: NextResponse.json({ error: parsed.error }, { status: 400 }),
          };
    },
    // temperature 0: a screening should be as deterministic as the engine allows.
    prompt: (req) => ({
      text: buildBestPathPrompt(req),
      options: { json: true, tier: "fast", temperature: 0 },
    }),
    guard: (raw, req) => parseBestPathResponse(raw, req),
    mock: (req) => recommendBestPath(req),
    build: (output, source) => ({
      programs: output.programs,
      recommendation: output.recommendation,
      disclaimer: output.disclaimer,
      source,
    }),
  });
}
