import { NextResponse } from "next/server";
import { DISCLAIMER } from "@/lib/result";
import { parseSaveDraftRequest } from "@/features/drafting/saveRecovery";
import { authorizeRoute } from "@/lib/auth/authorizeRoute";
import { petitions } from "@/lib/data/adapters/petition";
import { type CaseAccess } from "@/lib/data/adapters/access";
import { toErrorResponse } from "@/lib/data/adapters/http";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/tokens/rate-limit";

// Persistence-only rescue endpoint for a draft that was charged + generated
// but whose version save failed (/api/draft responded `saveFailed: true`).
//
// This route NEVER charges tokens and NEVER calls a model — it only re-attempts
// `petitions.saveDraft` with the sections the client is already holding. A
// retry that re-generated would bill the user a second time for work product
// they already paid for.
//
// Access mirrors /api/draft: OWNER-ONLY (requiresAttorney omitted on
// authorizeRoute), because the draft being rescued is the owner's work
// product. There is no inline/demo path — without a caseId there is nothing
// to persist, so `anonymous` is a 400, not a fallthrough.

// Node runtime — the storage drivers are not Edge-safe.

export async function POST(request: Request): Promise<NextResponse> {
  // authorizeRoute reads caseId from a clone, so it MUST run before this
  // route's own request.json() (a body stream is single-consumption).
  const auth = await authorizeRoute(request, { requiresCase: true });
  if (auth.status === "unauthenticated") {
    return NextResponse.json(
      { error: "Sign in to save the draft to your case." },
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

  const parsed = parseSaveDraftRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const user = auth.user;

  // Same keying strategy as /api/draft but its own bucket name, so rescue
  // retries can't be starved by (or starve) paid generate calls. Reuses the
  // draft limit config — saving is strictly cheaper than generating.
  const limited = await enforceRateLimit(
    request,
    "draft_save",
    RATE_LIMITS.draft,
    DISCLAIMER,
    user?.id,
  );
  if (limited) return limited;

  // Owner-only access context (email deliberately null — matches the
  // owner-only decision authorizeRoute already made, as in /api/draft).
  const access: CaseAccess = { userId: user?.id ?? null, email: null };

  const saved = await petitions.saveDraft(
    access,
    auth.case.id,
    parsed.value.sections,
    parsed.value.source,
  );
  if (!saved.ok) return toErrorResponse(saved.error);

  // `saved.value` is always a real version number here: the adapter converts a
  // no-store (null) into err("unconfigured") → 503 above, so a 2xx can't carry a
  // null version. Emit an explicit `persisted` so the client never infers "saved"
  // from a 2xx alone (defensive against a future adapter regression).
  return NextResponse.json({
    caseId: auth.case.id,
    version: saved.value,
    persisted: true,
  });
}
