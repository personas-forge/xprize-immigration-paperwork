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
  tryParseDraftResponse,
  tryParseSectionResponse,
  type DraftRequest,
  type DraftSection,
} from "@/features/drafting";
import { type ModelSource } from "@/lib/llm/label";
import { chargeForOperation } from "@/lib/tokens/guard";
import { getLlm } from "@/lib/llm/client";
import { authorizeRoute } from "@/lib/auth/authorizeRoute";
import { petitions } from "@/lib/data/adapters/petition";
import { type CaseAccess } from "@/lib/data/adapters/access";
import { toErrorResponse } from "@/lib/data/adapters/http";
import {
  RATE_LIMITS,
  checkRateLimit,
  isRateLimitEnabled,
  rateLimitKey,
} from "@/lib/rate-limit";

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
// A supplied caseId MUST authorize (the caller owns it) — it never silently
// degrades to the inline path (that masked an access boundary). On model
// failure OR unusable model output the token is reclaimed and the result is
// honestly labelled "mock". Every payload carries the not-legal-advice
// DISCLAIMER — a draft is work product for the attorney of record, never final.

// Node runtime — the Google SDK and `pg` are not Edge-safe.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  // Resolve user + case access up front (ADR-0006: authorizeRoute owns the
  // fail-closed case-access decision). draft is OWNER-ONLY — requiresAttorney is
  // OMITTED, so the configured-attorney cross-tenant fallback is NOT honored
  // here (a draft is the owner's work product, not the attorney-of-record's to
  // generate by id). authorizeRoute reads the body's caseId from a clone, so the
  // original request is still parseable below; it MUST run before the route's
  // own request.json() (a body stream is single-consumption). A supplied caseId
  // the caller can't access never degrades to the inline payload —
  // unauthenticated → 401, no access → 403. Case resolution now runs as part of
  // authorizeRoute (one indexed read) ahead of the rate limit; the rate-limit
  // invariant protects the charge + model call, which still come after, so this
  // is the one documented behavior nuance (mirrors /api/rfe).
  const auth = await authorizeRoute(request, { requiresCase: true });
  if (auth.status === "unauthenticated") {
    return NextResponse.json(
      { error: "Sign in to draft from a saved case." },
      { status: 401 },
    );
  }
  if (auth.status === "forbidden") {
    return NextResponse.json(
      { error: "You don't have access to this case." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const record = (body ?? {}) as Record<string, unknown>;
  const focus = parseFocus(record.focus);

  // user (possibly null on the inline/demo path) keys the rate limit.
  const user = auth.user;

  // Owner-only access context for the PetitionAdapter (ADR-0010). draft never
  // honors the configured-attorney cross-tenant fallback (requiresAttorney was
  // OMITTED on authorizeRoute above), so `email` is deliberately null — the
  // adapter's own resolveCase gate then resolves owner-only, matching the
  // decision already made by authorizeRoute. The adapter is the single seam for
  // the criteria read + draft persistence below; it owns null-handling, Firestore
  // error handling and access re-validation so this route no longer hand-wraps
  // each Store call.
  const access: CaseAccess = { userId: user?.id ?? null, email: null };

  // Rate limit BEFORE charging or any model work. Keyed by user when known, else
  // by IP, so a flood can't drain a balance or run up model cost unchecked.
  if (isRateLimitEnabled()) {
    const rl = checkRateLimit(rateLimitKey(request, "draft", user?.id), RATE_LIMITS.draft);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "rate_limited", retryAfterSec: rl.retryAfterSec, disclaimer: DISCLAIMER },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
    }
  }

  // Build the draft request (validate BEFORE charging): from the authorized case
  // (DB path) or the inline payload (demo path, caseId-less only).
  let req: DraftRequest;
  let resolvedCaseId: string | null = null;
  if (auth.status === "ok") {
    const criteriaResult = await petitions.getCriteria(access, auth.case.id);
    if (!criteriaResult.ok) {
      // A store fault / lost backend on the criteria read is now a typed
      // adapter error mapped to its own status (503/500/…) instead of an
      // uncaught throw that 500s — "no access" / "not found" / "store down" no
      // longer collapse into one shape.
      return toErrorResponse(criteriaResult.error);
    }
    const parsed = parseDraftRequest({
      petitioner: auth.case.petitioner,
      classification: auth.case.classification,
      criteria: criteriaResult.value,
    });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    req = parsed.value;
    resolvedCaseId = auth.case.id;
  } else {
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
    // Pin the regenerated section's heading to the requested `focus` so the
    // client (and the persisted merge below) always match by heading, even if
    // the model renames it — otherwise a paid regenerate is a silent no-op.
    let section: DraftSection;
    let source: ModelSource;
    if (!llm) {
      section = { ...mockSection(req, focus), heading: focus };
      source = "mock";
    } else {
      try {
        const text = await llm.generate(buildSectionPrompt(req, focus), {
          json: true,
          tier: "long",
        });
        const parsed = tryParseSectionResponse(text);
        if (parsed) {
          section = { heading: focus, body: parsed.body };
          source = llm.name;
        } else {
          // Model produced unusable output → refund and label honestly.
          await charged.reclaim();
          section = { ...mockSection(req, focus), heading: focus };
          source = "mock";
        }
      } catch {
        await charged.reclaim();
        section = { ...mockSection(req, focus), heading: focus };
        source = "mock";
      }
    }

    // Persist the regenerated section by merging it into the latest stored draft
    // as a NEW version. Previously the focus path never saved, so a paid
    // regenerate diverged from the stored draft and was lost on reload.
    let version: number | null = null;
    let saveFailed = false;
    if (resolvedCaseId) {
      const latestResult = await petitions.getLatestDraft(access, resolvedCaseId);
      if (!latestResult.ok) {
        // User already paid → surface the failure, never swallow it.
        saveFailed = true;
        console.error(
          "[/api/draft] failed to load latest draft for merge",
          latestResult.error,
        );
      } else if (latestResult.value) {
        const merged = latestResult.value.sections.map((s) =>
          s.heading === focus ? { heading: focus, body: section.body } : s,
        );
        const saved = await petitions.saveDraft(
          access,
          resolvedCaseId,
          merged,
          source,
        );
        if (!saved.ok) {
          saveFailed = true;
          console.error(
            "[/api/draft] failed to persist regenerated section",
            saved.error,
          );
        } else {
          version = saved.value;
        }
      }
    }

    return NextResponse.json({
      ...buildSectionResult(section, source),
      caseId: resolvedCaseId,
      version,
      saveFailed,
    });
  }

  // — Full petition letter ───────────────────────────────────────────────────
  let result = buildDraftResult(mockDraft(req), "mock");
  if (llm) {
    try {
      const text = await llm.generate(buildDraftPrompt(req), { json: true, tier: "long" });
      const parsed = tryParseDraftResponse(text);
      if (parsed) {
        result = buildDraftResult(parsed, llm.name);
      } else {
        // Unusable model output: reclaim the xl charge and label the fallback
        // "mock" instead of stamping boilerplate as a model draft.
        await charged.reclaim();
        result = buildDraftResult(mockDraft(req), "mock");
      }
    } catch {
      await charged.reclaim();
      result = buildDraftResult(mockDraft(req), "mock");
    }
  }

  // Persist as a new draft version (no-op when no DB). The user already paid, so
  // a storage failure is SURFACED (saveFailed), never silently swallowed — the
  // saved version is the work product the attorney reviews and signs.
  let version: number | null = null;
  let saveFailed = false;
  if (resolvedCaseId) {
    const saved = await petitions.saveDraft(
      access,
      resolvedCaseId,
      result.sections,
      result.source,
    );
    if (!saved.ok) {
      saveFailed = true;
      console.error("[/api/draft] failed to persist draft version", saved.error);
    } else {
      version = saved.value;
    }
  }

  return NextResponse.json({ ...result, caseId: resolvedCaseId, version, saveFailed });
}
