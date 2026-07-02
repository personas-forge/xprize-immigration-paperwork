import { NextResponse } from "next/server";
import { DISCLAIMER } from "@/lib/result";
import { parseSaveDraftRequest } from "@/features/drafting/saveRecovery";
import { str } from "@/lib/validation";
import { authorizeRoute } from "@/lib/auth/authorizeRoute";
import { petitions } from "@/lib/data/adapters/petition";
import { caseAccessFor } from "@/lib/data/adapters/access";
import { toErrorResponse } from "@/lib/data/adapters/http";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/tokens/rate-limit";

// Persistence-only rescue for an RFE response that was charged + generated but
// whose version save failed (/api/rfe responded `saveFailed: true`) — the
// parity twin of /api/draft/save, closing the "drafts have a rescue, RFE
// responses are charged-but-lost" gap. NEVER charges, NEVER calls a model.
//
// Access mirrors /api/rfe: owner OR configured attorney (requiresAttorney) —
// the attorney of record legitimately drafts RFE responses on cases they
// don't own. No caseId → nothing to persist → 400.

// Node runtime — the storage drivers are not Edge-safe.

const MAX_RFE_TEXT = 4000; // matches the RFE request's own field cap

export async function POST(request: Request): Promise<NextResponse> {
  // authorizeRoute reads caseId from a clone, so it MUST run before this
  // route's own request.json() (a body stream is single-consumption).
  const auth = await authorizeRoute(request, { requiresCase: true, requiresAttorney: true });
  if (auth.status === "unauthenticated") {
    return NextResponse.json(
      { error: "Sign in to save the RFE response to your case." },
      { status: 401 },
    );
  }
  if (auth.status === "forbidden") {
    return NextResponse.json(
      { error: "You don't have access to this case." },
      { status: 403 },
    );
  }
  if (auth.status === "anonymous") {
    return NextResponse.json({ error: "caseId is required." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Same {sections, source} contract as the draft rescue; the RFE version row
  // additionally records the notice text it responds to.
  const parsed = parseSaveDraftRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const rfeText = str((body as Record<string, unknown>).rfeText, MAX_RFE_TEXT);

  const user = auth.user;

  // Own bucket so rescue retries can't be starved by (or starve) paid
  // generate calls; reuses the rfe limit config — saving is strictly cheaper.
  const limited = await enforceRateLimit(request, "rfe_save", RATE_LIMITS.rfe, DISCLAIMER, user?.id);
  if (limited) return limited;

  const saved = await petitions.saveRfeResponse(
    caseAccessFor(user),
    auth.case.id,
    rfeText,
    parsed.value.sections,
    parsed.value.source,
  );
  if (!saved.ok) return toErrorResponse(saved.error);

  return NextResponse.json({
    caseId: auth.case.id,
    version: saved.value,
    persisted: true,
  });
}
