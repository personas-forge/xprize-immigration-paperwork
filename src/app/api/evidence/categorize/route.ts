import { NextResponse } from "next/server";
import {
  buildCategorizePrompt,
  buildCategorizeResult,
  mockCategorize,
  parseCategorizeRequest,
  tryParseCategorizeResponse,
  type CategorizeAssessment,
  type CategorizeRequest,
} from "@/features/evidence";
import { executeAiOperation } from "@/lib/ai/operation";
import { evidence } from "@/lib/data/adapters/evidence";

// Evidence categorization endpoint (migrated to the shared orchestrator, ADR-0004).
//
// Body: { name, content, caseId?, classification? }. Classifies a document into
// one of the eight O-1A criteria (or "Unsorted") and extracts key facts. When a
// caseId resolves to a case the user can access (owner or configured attorney),
// the document is persisted to the vault with an auto-assigned exhibit number.
//
// The entire parse → rate-limit → charge → model → guard → respond pipeline
// (incl. the 400/401/402/429 + DISCLAIMER boilerplate and the
// charge-then-reclaim-to-mock recovery) is owned by `executeAiOperation`; this
// route is the declarative spec. Persistence stays best-effort and gates through
// the EvidenceAdapter's resolveCase seam — a storage/access failure simply yields
// no document, never a hard error (matching the pre-orchestrator behavior).

// Node runtime — the Google SDK and `pg` are not Edge-safe.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Validated input: the categorize request plus the case context for persistence. */
interface CategorizeInput {
  req: CategorizeRequest;
  classification: string;
  caseId: string | null;
}

export function POST(request: Request): Promise<NextResponse> {
  return executeAiOperation<CategorizeInput, CategorizeAssessment>(request, {
    operation: "categorize",
    // Keyed by client IP (this route stays auth-decoupled for the keyless build),
    // so a flood can't run up model cost or drain a balance unchecked.
    rateLimit: { bucket: "categorize", scope: "categorize" },
    unauthenticatedError: "Sign in to add evidence.",
    parse: ({ body }) => {
      const parsed = parseCategorizeRequest(body);
      if (!parsed.ok) {
        return {
          ok: false,
          response: NextResponse.json({ error: parsed.error }, { status: 400 }),
        };
      }
      const record = (body ?? {}) as Record<string, unknown>;
      const classification =
        typeof record.classification === "string" ? record.classification : "O-1A";
      const caseId = typeof record.caseId === "string" ? record.caseId : null;
      return { ok: true, value: { req: parsed.value, classification, caseId } };
    },
    // Text categorization works on any engine. NOTE: when binary PDF/image OCR is
    // added, set requiresImages so it never lands on the image-less Claude CLI.
    prompt: (input) => ({
      text: buildCategorizePrompt(input.req, input.classification),
      options: { json: true, tier: "fast" },
    }),
    // Unusable JSON → null → orchestrator reclaims the charge + labels source "mock".
    guard: (raw, input) => tryParseCategorizeResponse(raw, input.classification),
    mock: (input) => mockCategorize(input.req, input.classification),
    build: (assessment, source) =>
      buildCategorizeResult(
        assessment,
        source as Parameters<typeof buildCategorizeResult>[1],
      ) as unknown as Record<string, unknown>,
    // Persist to the case vault through the EvidenceAdapter (ADR-0010), which
    // gates owner-or-configured-attorney via resolveCase. Best-effort: any
    // adapter error (forbidden / store fault) yields no document, never an error.
    // `source` records whether the categorization was model- or mock-generated.
    persist: async (assessment, input, user, source) => {
      if (!user || !input.caseId) return { document: null };
      const saved = await evidence.addDocument(
        { userId: user.id, email: user.email ?? null },
        {
          caseId: input.caseId,
          name: input.req.name,
          criterion: assessment.criterion,
          facts: assessment.facts,
          source,
        },
      );
      return { document: saved.ok ? saved.value : null };
    },
    onPersistError: () => ({ document: null }),
  });
}
