import { NextResponse } from "next/server";
import {
  buildCategorizePrompt,
  buildCategorizeResult,
  mockCategorize,
  parseCategorizeRequest,
  summarizeVaultBuckets,
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

/** Validated input: the categorize request, the case context for persistence, and
 *  a read-only summary of what's already in the vault (G2.1 — consistency). */
interface CategorizeInput {
  req: CategorizeRequest;
  classification: string;
  caseId: string | null;
  existingBuckets: string;
}

export function POST(request: Request): Promise<NextResponse> {
  return executeAiOperation<CategorizeInput, CategorizeAssessment>(request, {
    operation: "categorize",
    // Keyed by client IP (this route stays auth-decoupled for the keyless build),
    // so a flood can't run up model cost or drain a balance unchecked.
    rateLimit: { bucket: "categorize", scope: "categorize" },
    unauthenticatedError: "Sign in to add evidence.",
    parse: async ({ body, resolveUser }) => {
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
      // Whole-vault context (G2.1/PN-EVID-01): summarize what's already filed so
      // the categorizer places this doc consistently with its siblings. Best-effort
      // and gated owner-or-attorney via the adapter; a fault → no summary.
      let existingBuckets = "";
      if (caseId) {
        const user = await resolveUser();
        if (user) {
          const docs = await evidence.getDocuments(
            { userId: user.id, email: user.email ?? null },
            caseId,
          );
          if (docs.ok) existingBuckets = summarizeVaultBuckets(docs.value);
        }
      }
      return { ok: true, value: { req: parsed.value, classification, caseId, existingBuckets } };
    },
    // Text categorization works on any engine. NOTE: when binary PDF/image OCR is
    // added, set requiresImages so it never lands on the image-less Claude CLI.
    prompt: (input) => ({
      text: buildCategorizePrompt(input.req, input.classification, input.existingBuckets),
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
      // No caseId (or no user) → no save was attempted; a null document here is
      // the legitimate keyless/no-case path, NOT a failure.
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
      if (saved.ok) return { document: saved.value };
      // A caseId WAS supplied but the save failed (forbidden / not_found / store
      // fault). Don't collapse this into the no-case null — emit saveFailed so the
      // user (who was charged) is told their evidence didn't persist instead of
      // seeing a phantom doc that vanishes on reload.
      return { document: null, saveFailed: true };
    },
    onPersistError: (input) => ({ document: null, saveFailed: input.caseId != null }),
  });
}
