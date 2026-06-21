import { NextResponse } from "next/server";
import {
  buildGuidancePrompt,
  buildGuidanceResponse,
  mockGuidance,
  parseGuidanceRequest,
  type GuidanceRequest,
} from "@/features/guidance/guidance";
import { executeAiOperation } from "@/lib/ai/operation";
import { runAdjudication } from "@/lib/llm/adjudication-gates";

// USCIS form-field guidance endpoint (migrated to the shared orchestrator,
// ADR-0004 task 3/6).
//
// Given { formId, fieldLabel, situation } it returns { guidance, disclaimer,
// source } where `disclaimer` ALWAYS states this is general information, not
// legal advice, and that an attorney of record is required. The disclaimer is
// attached in buildGuidanceResponse — there is no code path that returns
// guidance without it. The entire parse → rate-limit → charge → model → guard →
// respond pipeline (incl. the 400/401/402/429 + DISCLAIMER boilerplate and the
// charge-then-reclaim-to-mock recovery) is owned by `executeAiOperation`; this
// route is the declarative spec for the guidance op. The output is the raw
// guidance text (TOutput = string); `build` wraps it in the response contract.
//
// This is a behaviour-preserving refactor with ONE consistency fix: when an
// engine is configured but returns empty/blank text, the route now reclaims the
// charge and labels the templated fallback `source: "mock"` — matching every
// other AI route and the orchestrator's honest-mock invariant. The
// pre-orchestrator route returned the templated fallback stamped with the
// engine name and kept the charge (billing a mock as a model answer).

// Node runtime — the Google SDK is not Edge-safe.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request): Promise<NextResponse> {
  return executeAiOperation<GuidanceRequest, string>(request, {
    operation: "guidance",
    // Keyed by client IP (this route stays auth-decoupled for the keyless
    // build), so a flood can't run up model cost or drain a balance unchecked.
    rateLimit: { bucket: "guidance", scope: "guidance" },
    unauthenticatedError: "Sign in to use guidance.",
    parse: ({ body }) => {
      const parsed = parseGuidanceRequest(body);
      return parsed.ok
        ? { ok: true, value: parsed.value }
        : {
            ok: false,
            response: NextResponse.json({ error: parsed.error }, { status: 400 }),
          };
    },
    // No json mode for guidance — the model returns free-form informational
    // text, not a structured payload.
    prompt: (req) => ({ text: buildGuidancePrompt(req), options: { tier: "fast" } }),
    // Blank/whitespace model output is unusable → null, which the orchestrator
    // turns into reclaim + deterministic mock labelled source:"mock".
    guard: (raw) => {
      const text = raw.trim();
      return text.length > 0 ? text : null;
    },
    mock: (req) => mockGuidance(req),
    // The orchestrator widens `source` to string; buildGuidanceResponse takes
    // the ModelSource union (engine name | "mock"), which is exactly what the
    // orchestrator produces.
    build: (guidance, source) =>
      buildGuidanceResponse(
        guidance,
        source as Parameters<typeof buildGuidanceResponse>[1],
      ) as unknown as Record<string, unknown>,
    // Live UPL screen: guidance is the most "tell me what to do"-prone route, and
    // `runAdjudication` ships a dedicated `case "guidance"` (disclaimer + legal-
    // advice tripwire). Wire it so outcome/advice language is flagged on the
    // panel via AdjudicationBadge — matching /api/qualify and /api/rfe. There's
    // no per-criterion grounding here, so inputText is the field + situation.
    adjudicate: (guidance, req, source, body) =>
      runAdjudication({
        operation: "guidance",
        classification: "",
        source,
        result: body,
        inputText: `${req.fieldLabel} ${req.situation}`,
        outputText: guidance,
      }),
  });
}
