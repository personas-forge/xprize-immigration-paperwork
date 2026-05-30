import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  DISCLAIMER,
  buildDraftPrompt,
  buildDraftResult,
  buildSectionPrompt,
  buildSectionResult,
  mockDraft,
  mockSection,
  parseDraftRequest,
  parseFocus,
  parseDraftResponse,
  parseSectionResponse,
  type DraftRequest,
} from "@/features/drafting";
import { chargeForOperation } from "@/lib/tokens/guard";
import { getLlm } from "@/lib/llm/client";
import { getUser } from "@/lib/auth/session";
import {
  getCaseForUser,
  getCriteriaForCase,
  saveDraft,
} from "@/lib/data/petitions";

// Petition-letter drafting endpoint.
//
// Two ways to call it:
//   • { caseId }                          → loads the user's persisted case +
//                                            criteria from the database (DB path)
//   • { petitioner, classification, criteria } → drafts from an inline payload
//                                            (the keyless/no-DB demo path)
// Optional { focus: "<criterion name>" } regenerates a single section instead
// of the whole letter (cheaper "draft_section" charge).
//
// Same graceful fallback as the other AI routes: no GEMINI_API_KEY → a
// deterministic templated draft; on model failure the token is reclaimed and a
// safe draft is still returned. Every payload carries the not-legal-advice
// DISCLAIMER — a draft is work product for the attorney of record, never final.

// Node runtime — the Google SDK and `pg` are not Edge-safe.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const record = (body ?? {}) as Record<string, unknown>;
  const focus = parseFocus(record.focus);
  const caseId = typeof record.caseId === "string" ? record.caseId : null;

  // Resolve the draft request (validate BEFORE charging, like the other routes).
  // Prefer the authoritative DB case when a caseId is supplied and reachable.
  let req: DraftRequest | null = null;
  let resolvedCaseId: string | null = null;
  if (caseId) {
    const user = await getUser();
    if (user) {
      const stored = await getCaseForUser(user.id, caseId);
      if (stored) {
        const criteria = await getCriteriaForCase(caseId);
        const parsed = parseDraftRequest({
          petitioner: stored.petitioner,
          classification: stored.classification,
          criteria,
        });
        if (parsed.ok) {
          req = parsed.value;
          resolvedCaseId = stored.id;
        }
      }
    }
  }
  if (!req) {
    const parsed = parseDraftRequest(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    req = parsed.value;
  }

  // Token economy: full draft = "draft" (xl/12), single section = "draft_section"
  // (heavy/5). Free pass when auth/DB/TOKENS_BYPASS aren't configured.
  const operation = focus ? "draft_section" : "draft";
  const requestId = randomUUID();
  const charged = await chargeForOperation(operation, requestId);
  if (!charged.ok) {
    if (charged.reason === "unauthenticated") {
      return NextResponse.json(
        { error: "Sign in to draft a petition." },
        { status: 401 },
      );
    }
    return NextResponse.json(
      {
        error: "insufficient_tokens",
        cost: charged.cost,
        balance: charged.balance,
        disclaimer: DISCLAIMER,
      },
      { status: 402 },
    );
  }

  const llm = getLlm();

  // — Single-section regeneration ───────────────────────────────────────────
  if (focus) {
    if (!llm) {
      return NextResponse.json({
        ...buildSectionResult(mockSection(req, focus), "mock"),
        caseId: resolvedCaseId,
      });
    }
    try {
      const text = await llm.generate(buildSectionPrompt(req, focus), {
        json: true,
        tier: "long",
      });
      const section = parseSectionResponse(text, req, focus);
      return NextResponse.json({
        ...buildSectionResult(section, llm.name),
        caseId: resolvedCaseId,
      });
    } catch {
      await charged.reclaim();
      return NextResponse.json({
        ...buildSectionResult(mockSection(req, focus), "mock"),
        caseId: resolvedCaseId,
      });
    }
  }

  // — Full petition letter ───────────────────────────────────────────────────
  let result = buildDraftResult(mockDraft(req), "mock");
  if (llm) {
    try {
      const text = await llm.generate(buildDraftPrompt(req), { json: true, tier: "long" });
      result = buildDraftResult(parseDraftResponse(text, req), llm.name);
    } catch {
      await charged.reclaim();
      result = buildDraftResult(mockDraft(req), "mock");
    }
  }

  // Persist as a new draft version (no-op when no DB). Best-effort: a storage
  // hiccup must not fail the draft the user already paid for.
  let version: number | null = null;
  if (resolvedCaseId) {
    try {
      version = await saveDraft(resolvedCaseId, result.sections, result.source);
    } catch {
      version = null;
    }
  }

  return NextResponse.json({ ...result, caseId: resolvedCaseId, version });
}
