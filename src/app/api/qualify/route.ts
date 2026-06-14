import { NextResponse } from "next/server";
import {
  buildQualifyPrompt,
  buildQualifyResult,
  mockQualification,
  parseQualifyRequest,
  parseQualifyResponse,
  type QualifyAssessment,
  type QualifyRequest,
} from "@/features/qualification";
import { petitions } from "@/lib/data/adapters/petition";
import { executeAiOperation } from "@/lib/ai/operation";
import { runAdjudication } from "@/lib/llm/adjudication-gates";

// O-1A qualification screening endpoint (migrated to the shared orchestrator,
// ADR-0004 task 4/6).
//
// Given { profile, name, classification } it returns a QualifyResult — the
// classification's criteria scored, an overall likelihood, gaps, and (always)
// the not-legal-advice DISCLAIMER. The entire parse → rate-limit → charge →
// model → guard → persist → respond pipeline (incl. the 400/401/402/429 +
// DISCLAIMER boilerplate and the charge-then-reclaim-to-mock recovery) is owned
// by `executeAiOperation`; this route is the declarative spec for the screening.
//
// BEHAVIOUR CHANGE vs the pre-orchestrator route: qualify now enforces a
// per-window rate limit (bucket `qualify`, keyed by user). Previously this was
// the only token-charged AI route with NO frequency cap, so an authenticated
// caller could loop the medium-cost screening to drain their balance and run up
// real model cost. It now matches /api/draft, /api/rfe, /api/guidance and
// /api/evidence/categorize.

// Node runtime — the Google SDK and `pg` are not Edge-safe.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request): Promise<NextResponse> {
  return executeAiOperation<QualifyRequest, QualifyAssessment>(request, {
    operation: "qualify",
    // Rate-limit BEFORE charge, keyed by the signed-in user (a screening is an
    // authenticated, persisted op — keying by user stops IP-rotation evasion).
    rateLimit: { bucket: "qualify", scope: "qualify", byUser: true },
    unauthenticatedError: "Sign in to run a qualification assessment.",
    parse: ({ body }) => {
      const parsed = parseQualifyRequest(body);
      return parsed.ok
        ? { ok: true, value: parsed.value }
        : {
            ok: false,
            response: NextResponse.json({ error: parsed.error }, { status: 400 }),
          };
    },
    // temperature 0: a screening should be as deterministic as the engine allows
    // (Gemini honors this; the Claude CLI path has no temperature knob).
    prompt: (req) => ({
      text: buildQualifyPrompt(req),
      options: { json: true, tier: "fast", temperature: 0 },
    }),
    // Strict-JSON normalization. A throw here (malformed model output) is caught
    // by the orchestrator → reclaim + deterministic mock labelled source:"mock".
    guard: (raw, req) => parseQualifyResponse(raw, req),
    mock: (req) => mockQualification(req),
    build: (assessment, source) =>
      // The orchestrator widens `source` to string; buildQualifyResult takes the
      // ModelSource union (engine name | "mock"), which is exactly what the
      // orchestrator produces.
      buildQualifyResult(
        assessment,
        source as Parameters<typeof buildQualifyResult>[1],
      ) as unknown as Record<string, unknown>,
    // Live adjudication: canonical criteria, valid statuses, likelihood range,
    // and the UPL tripwire over the screening's own evidence/rationale/gaps text.
    adjudicate: (assessment, req, source, body) =>
      runAdjudication({
        operation: "qualify",
        classification: req.classification,
        source,
        result: body,
        inputText: req.profile,
        outputText:
          assessment.criteria.map((c) => `${c.evidence} ${c.rationale}`).join(" ") +
          " " +
          assessment.gaps.join(" "),
      }),
    // Persist as a case for the signed-in user (no-op when no DB / no user).
    // Best-effort: a storage hiccup must not fail the screening already paid for.
    persist: async (assessment, req, user) => {
      if (!user) return { caseId: null };
      // Persist via the PetitionAdapter (ADR-0010) — createCase owns the
      // userId/store-configured checks and wraps the write in store_error.
      // Best-effort: any non-ok result yields no caseId (the screening is paid).
      const created = await petitions.createCase(
        // createCase creates a NEW owned case and gates on userId only (no
        // per-case owner-or-attorney check), so email is irrelevant here.
        { userId: user.id, email: null },
        {
          petitioner: req.name,
          classification: req.classification,
          approvalLikelihood: assessment.likelihood,
          criteria: assessment.criteria,
        },
      );
      return { caseId: created.ok ? created.value.id : null };
    },
    onPersistError: () => ({ caseId: null }),
  });
}
