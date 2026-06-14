import { NextResponse } from "next/server";
import {
  buildRfePrompt,
  buildRfeResult,
  mockRfe,
  parseRfeRequest,
  tryParseRfeResponse,
  type RfeRequest,
  type RfeResponse,
} from "@/features/rfe";
import { executeAiOperation } from "@/lib/ai/operation";
import { petitions } from "@/lib/data/adapters/petition";
import { type CaseAccess } from "@/lib/data/adapters/access";
import { toErrorResponse } from "@/lib/data/adapters/http";

// RFE (Request for Evidence) response drafting endpoint (migrated to the shared
// orchestrator, ADR-0004).
//
// Body: { rfeText, caseId? } or { rfeText, petitioner?, classification?, criteria? }.
// The RFE notice text is required; the petition context comes from the case
// (DB path — owner, or an EXPLICITLY allow-listed attorney of record) or from an
// inline payload (demo path, caseId-less only).
//
// The parse -> rate-limit -> charge -> model -> guard -> reclaim -> persist
// pipeline (incl. the 401/402/429 + DISCLAIMER envelope and charge-then-reclaim
// recovery) is owned by `executeAiOperation`. The owner-or-attorney case gate
// lives in `parse` (it must run before charge): a caseId the caller can't access
// never falls through to the inline payload — unauthenticated -> 401, no access
// -> 403 — and the criteria read + RFE persist gate through the PetitionAdapter's
// resolveCase seam (ADR-0010).

// Node runtime — the Google SDK and `pg` are not Edge-safe.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Validated input: the RFE request plus the case it persists to (null = demo). */
interface RfeInput {
  req: RfeRequest;
  caseId: string | null;
}

export function POST(request: Request): Promise<NextResponse> {
  return executeAiOperation<RfeInput, RfeResponse>(request, {
    operation: "rfe",
    // Keyed by the signed-in user (RFE is an authenticated, persisted op); falls
    // back to client IP on the inline/demo path.
    rateLimit: { bucket: "rfe", scope: "rfe", byUser: true },
    unauthenticatedError: "Sign in to draft an RFE response.",
    parse: async ({ body, resolveUser }) => {
      const record = (body ?? {}) as Record<string, unknown>;
      const caseId =
        typeof record.caseId === "string" && record.caseId.trim() !== ""
          ? record.caseId.trim()
          : null;

      // DB path: resolve the case fail-closed (owner or configured attorney) and
      // load its criteria through the adapter gate, BEFORE any charge.
      if (caseId) {
        const user = await resolveUser();
        if (!user) {
          return {
            ok: false,
            response: NextResponse.json(
              { error: "Sign in to respond to an RFE on a saved case." },
              { status: 401 },
            ),
          };
        }
        const access: CaseAccess = { userId: user.id, email: user.email ?? null };
        const gate = await petitions.resolveCase(access, caseId);
        if (!gate.ok) {
          // forbidden/not_found -> 403 (no existence leak); store faults -> typed.
          if (gate.error.kind === "forbidden" || gate.error.kind === "not_found") {
            return {
              ok: false,
              response: NextResponse.json(
                { error: "You don't have access to this case." },
                { status: 403 },
              ),
            };
          }
          return { ok: false, response: toErrorResponse(gate.error) };
        }
        const criteria = await petitions.getCriteria(access, caseId);
        if (!criteria.ok) return { ok: false, response: toErrorResponse(criteria.error) };
        const parsed = parseRfeRequest({
          petitioner: gate.value.petitioner,
          classification: gate.value.classification,
          criteria: criteria.value,
          rfeText: record.rfeText,
        });
        if (!parsed.ok) {
          return { ok: false, response: NextResponse.json({ error: parsed.error }, { status: 400 }) };
        }
        return { ok: true, value: { req: parsed.value, caseId } };
      }

      // Inline/demo path (caseId-less): validate the supplied payload.
      const parsed = parseRfeRequest(body);
      if (!parsed.ok) {
        return { ok: false, response: NextResponse.json({ error: parsed.error }, { status: 400 }) };
      }
      return { ok: true, value: { req: parsed.value, caseId: null } };
    },
    prompt: (input) => ({ text: buildRfePrompt(input.req), options: { json: true, tier: "long" } }),
    guard: (raw) => tryParseRfeResponse(raw),
    mock: (input) => mockRfe(input.req),
    build: (response, source) =>
      buildRfeResult(
        response,
        source as Parameters<typeof buildRfeResult>[1],
      ) as unknown as Record<string, unknown>,
    // Persist a new RFE response version through the adapter (gated). The user
    // already paid, so a storage failure is SURFACED (saveFailed), never swallowed.
    persist: async (response, input, user, source) => {
      if (!input.caseId || !user) {
        return { caseId: input.caseId, version: null, saveFailed: false };
      }
      const access: CaseAccess = { userId: user.id, email: user.email ?? null };
      const saved = await petitions.saveRfeResponse(
        access,
        input.caseId,
        input.req.rfeText,
        response.sections,
        source,
      );
      if (!saved.ok) {
        console.error("[/api/rfe] failed to persist RFE response version", saved.error);
        return { caseId: input.caseId, version: null, saveFailed: true };
      }
      return { caseId: input.caseId, version: saved.value, saveFailed: false };
    },
    onPersistError: (input) => ({ caseId: input.caseId, version: null, saveFailed: true }),
  });
}
