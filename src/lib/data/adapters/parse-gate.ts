import { NextResponse } from "next/server";
import type { StoredCase } from "@/lib/data/petitions";
import { petitions } from "./petition";
import { type CaseAccess } from "./access";
import { toErrorResponse } from "./http";

/** The minimal user shape the gate reads — id, and (for the attorney fallback)
 *  email. Structural so callers needn't import AppUser. */
type ParseUser = { id: string; email?: string | null };

/** Extract a non-empty, trimmed caseId from a parsed request body, else null —
 *  the idiom every AI spec's parse opens with. (The categorize route previously
 *  skipped the trim, so a whitespace-padded id reached the data layer
 *  un-normalized; this folds it onto the same rule.) */
export function parseCaseId(record: Record<string, unknown>): string | null {
  return typeof record.caseId === "string" && record.caseId.trim() !== ""
    ? record.caseId.trim()
    : null;
}

/**
 * The owner/attorney case-resolve preamble every AI spec runs at the top of its
 * `parse` stage, BEFORE any charge: authenticate → build the access context →
 * gate the case fail-closed → map a failure to the canonical 401/403/store-fault
 * response.
 *
 * ONE definition so the four specs (draft / rfe / critique / forecast) can't
 * drift on this access-control decision. The store-fault leg previously already
 * diverged — typed `toErrorResponse` on rfe/draft vs a literal 503 on critique/
 * forecast; this settles every spec on `toErrorResponse` (so a store fault now
 * surfaces the same body/shape everywhere: `unconfigured`→503, a throw→500).
 *
 * `ownerOnly` nulls the email so the configured-attorney cross-tenant fallback
 * can't fire — draft and critique are owner-only work product. rfe and forecast
 * pass the caller's email so an attorney of record can act on a case they can
 * already draft.
 */
export async function resolveCaseForParse(
  resolveUser: () => Promise<ParseUser | null>,
  caseId: string,
  opts: { unauthenticatedError: string; ownerOnly?: boolean },
): Promise<
  | { ok: true; access: CaseAccess; case: StoredCase }
  | { ok: false; response: NextResponse }
> {
  const user = await resolveUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: opts.unauthenticatedError }, { status: 401 }),
    };
  }
  const access: CaseAccess = {
    userId: user.id,
    email: opts.ownerOnly ? null : user.email ?? null,
  };
  const gate = await petitions.resolveCase(access, caseId);
  if (!gate.ok) {
    // forbidden/not_found → 403 (no existence leak); store faults → typed.
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
  return { ok: true, access, case: gate.value };
}
