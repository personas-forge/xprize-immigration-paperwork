import { NextResponse } from "next/server";
import {
  attachFiledPetition,
  attachRfeExhibits,
  buildRfePrompt,
  buildRfeResult,
  mockRfe,
  parseRfeRequest,
  rfeGroundingText,
  tryParseRfeResponse,
  type RfeRequest,
  type RfeResponse,
} from "@/features/rfe";
import { executeAiOperation } from "@/lib/ai/operation";
import { runAdjudication } from "@/lib/llm/adjudication-gates";
import { petitions } from "@/lib/data/adapters/petition";
import { evidence } from "@/lib/data/adapters/evidence";
import { caseAccessFor } from "@/lib/data/adapters/access";
import { parseCaseId, resolveCaseForParse } from "@/lib/data/adapters/parse-gate";
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
      const caseId = parseCaseId(record);

      // DB path: resolve the case fail-closed (owner or configured attorney) and
      // load its criteria through the adapter gate, BEFORE any charge.
      if (caseId) {
        const r = await resolveCaseForParse(resolveUser, caseId, {
          unauthenticatedError: "Sign in to respond to an RFE on a saved case.",
        });
        if (!r.ok) return r;
        const { access } = r;
        const criteria = await petitions.getCriteria(access, caseId);
        if (!criteria.ok) return { ok: false, response: toErrorResponse(criteria.error) };
        const parsed = parseRfeRequest({
          petitioner: r.case.petitioner,
          classification: r.case.classification,
          criteria: criteria.value,
          rfeText: record.rfeText,
        });
        if (!parsed.ok) {
          return { ok: false, response: NextResponse.json({ error: parsed.error }, { status: 400 }) };
        }
        // Fuse the evidence vault so the RFE response cites real exhibits
        // (moonshot #21). Best-effort: a vault fault degrades to exhibit-free.
        const docs = await evidence.getDocuments(access, caseId);
        let req = docs.ok ? attachRfeExhibits(parsed.value, docs.value) : parsed.value;
        // Fuse the as-filed petition letter so the response tracks its own language
        // (G1.2/dc-rfe-02). Best-effort: no stored draft → criteria-only grounding.
        const latest = await petitions.getLatestDraft(access, caseId);
        if (latest.ok && latest.value) req = attachFiledPetition(req, latest.value.sections);
        return { ok: true, value: { req, caseId } };
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
      buildRfeResult(response, source) as unknown as Record<string, unknown>,
    // Live adjudication PARITY with /api/draft (moonshot #1): an RFE response is
    // equally signable, attorney-of-record work product, so it gets the same
    // runtime fabricated-specifics / leaked-case-law / wrong-classification scan.
    // The grounding text includes the RFE notice AND the as-filed petition prose
    // (rfeGroundingText) so specifics the response legitimately quotes from either
    // aren't flagged as fabricated (Tiger #9).
    adjudicate: (response, input, source, body) => {
      const outputText = response.sections.map((s) => `${s.heading} ${s.body}`).join("\n");
      const inputText = rfeGroundingText(input.req);
      return runAdjudication({
        operation: "rfe",
        classification: input.req.classification,
        source,
        result: body,
        inputText,
        outputText,
      });
    },
    // Persist a new RFE response version through the adapter (gated). The user
    // already paid, so a storage failure is SURFACED (saveFailed), never swallowed.
    persist: async (response, input, user, source) => {
      if (!input.caseId || !user) {
        return { caseId: input.caseId, version: null, saveFailed: false };
      }
      const access = caseAccessFor(user);
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
