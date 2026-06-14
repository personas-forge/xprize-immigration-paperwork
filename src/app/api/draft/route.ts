import { type NextResponse } from "next/server";
import { executeAiOperation } from "@/lib/ai/operation";
import { draftSpec } from "@/features/drafting/draftOperation";

// Petition-letter drafting endpoint (migrated to the shared orchestrator, ADR-0004).
//
// Two ways to call it:
//   • { caseId }                                → drafts from the user's persisted
//                                                 case + criteria (DB path, owner-only)
//   • { petitioner, classification, criteria }  → drafts from an inline payload
//                                                 (keyless/no-DB demo path)
// Optional { focus: "<criterion name>" } regenerates a single section (cheaper
// "draft_section" charge) and merges it into the latest stored draft.
//
// The whole money path — rate-limit → charge → model → guard → reclaim-on-unusable
// → 401/402/429 + DISCLAIMER — is owned by executeAiOperation. The two-path
// dispatch + the owner-only gate + the section-merge persistence live in the
// declarative, unit-tested `draftSpec` (see features/drafting/draftOperation.ts).

// Node runtime — the Google SDK and `pg` are not Edge-safe.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request): Promise<NextResponse> {
  return executeAiOperation(request, draftSpec);
}
