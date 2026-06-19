/**
 * The /api/draft operation spec (ADR-0004) — extracted from the route so the
 * two-path dispatch logic is unit-testable.
 *
 * draft is the one route with TWO shapes behind one endpoint:
 *  - full letter   (no `focus`)  → bills "draft" (xl), persists a new draft version
 *  - one section   (`focus` set) → bills "draft_section" (heavy), merges the
 *                                  regenerated section into the latest stored
 *                                  draft by heading and persists that
 *
 * Modeled as a discriminated-union output so a single declarative spec covers
 * both: `operation`, `guard`, `mock`, `build`, and `persist` branch on the
 * output kind / the presence of `focus`. The orchestrator owns the money path
 * (rate-limit → charge → reclaim-on-unusable → 401/402/429 + DISCLAIMER); this
 * spec only owns the draft-specific parse / prompt / guard / mock / build / save.
 *
 * Access is OWNER-ONLY: a draft is the owner's work product, so the gate runs
 * with `email: null` (no configured-attorney cross-tenant fallback), matching
 * the route's prior authorizeRoute({ requiresCase: true }) — requiresAttorney
 * was deliberately omitted.
 */

import { NextResponse } from "next/server";
import {
  attachExhibits,
  buildDraftPrompt,
  buildDraftResult,
  buildSectionPrompt,
  buildSectionResult,
  mockDraft,
  mockSection,
  parseDraftRequest,
  parseFocus,
  toSection,
  tryParseDraftResponse,
  tryParseSectionResponse,
  type DraftRequest,
  type DraftSection,
  type PetitionDraft,
} from "./index";
import { petitions } from "@/lib/data/adapters/petition";
import { evidence } from "@/lib/data/adapters/evidence";
import { type CaseAccess } from "@/lib/data/adapters/access";
import { runAdjudication } from "@/lib/llm/adjudication-gates";
import { toErrorResponse } from "@/lib/data/adapters/http";
import { type AiOperationSpec } from "@/lib/ai/operation";

/** Validated input: the draft request, the optional single-section focus, the
 *  case it persists to (null = inline/demo payload, no persistence), and — on a
 *  single-section regenerate — the client's CURRENT sections, so unsaved edits
 *  to OTHER sections survive the merge (see `pickMergeBase`). */
export interface DraftInput {
  req: DraftRequest;
  focus: string | null;
  caseId: string | null;
  /** The sections the client is currently holding (regenerate path). Absent on a
   *  full draft and on legacy clients that don't send it. */
  clientSections?: DraftSection[] | null;
}

/** Either a full letter or one regenerated section — the two shapes the route
 *  returns, discriminated so guard/mock/build/persist can dispatch. */
export type DraftOutput =
  | { kind: "draft"; draft: PetitionDraft }
  | { kind: "section"; section: DraftSection };

/**
 * Choose the base set of sections to merge a regenerated section into. Prefer the
 * client's CURRENT sections — so unsaved edits to OTHER sections survive the
 * regenerate (the persisted version must reflect what the user is looking at, not
 * the last stored version). Returns null when the client didn't send a usable set
 * (legacy clients, or a set missing the focused heading), so `persist` falls back
 * to the last stored draft instead. Pure + unit-tested.
 */
export function pickMergeBase(
  clientSections: readonly DraftSection[] | null | undefined,
  focus: string,
): DraftSection[] | null {
  if (!clientSections || clientSections.length === 0) return null;
  // Only trust the client set if it actually contains the section being
  // regenerated — otherwise the merge-by-heading would silently drop the new one.
  if (!clientSections.some((s) => s.heading === focus)) return null;
  return clientSections.map((s) => ({ heading: s.heading, body: s.body }));
}

/** Replace the focused section's body in `base`, preserving every other section. */
export function mergeRegeneratedSection(
  base: readonly DraftSection[],
  focus: string,
  body: string,
): DraftSection[] {
  return base.map((s) => (s.heading === focus ? { heading: focus, body } : s));
}

export const draftSpec: AiOperationSpec<DraftInput, DraftOutput> = {
  // Full letter bills "draft" (xl); a single-section regenerate bills the
  // cheaper "draft_section" (heavy).
  operation: (input) => (input.focus ? "draft_section" : "draft"),
  // Keyed by the signed-in user; the orchestrator falls back to IP on the
  // inline/demo path. Reuses the draft bucket cap.
  rateLimit: { bucket: "draft", scope: "draft", byUser: true },
  unauthenticatedError: "Sign in to draft a petition.",

  parse: async ({ body, resolveUser }) => {
    const record = (body ?? {}) as Record<string, unknown>;
    const focus = parseFocus(record.focus);
    const caseId =
      typeof record.caseId === "string" && record.caseId.trim() !== ""
        ? record.caseId.trim()
        : null;
    // The client's current sections (regenerate path) — sanitized with the same
    // toSection validator the save route uses. Used only to pick the merge base
    // in persist; null when absent so legacy clients keep the stored-draft merge.
    const sanitizedSections = Array.isArray(record.sections)
      ? record.sections.map(toSection).filter((s): s is DraftSection => s !== null)
      : [];
    const clientSections = sanitizedSections.length > 0 ? sanitizedSections : null;

    // DB path: resolve the case OWNER-ONLY (a supplied caseId the caller can't
    // access never degrades to the inline payload) and load its criteria, all
    // before any charge.
    if (caseId) {
      const user = await resolveUser();
      if (!user) {
        return {
          ok: false,
          response: NextResponse.json(
            { error: "Sign in to draft from a saved case." },
            { status: 401 },
          ),
        };
      }
      const access: CaseAccess = { userId: user.id, email: null };
      const gate = await petitions.resolveCase(access, caseId);
      if (!gate.ok) {
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
      const parsed = parseDraftRequest({
        petitioner: gate.value.petitioner,
        classification: gate.value.classification,
        criteria: criteria.value,
      });
      if (!parsed.ok) {
        return { ok: false, response: NextResponse.json({ error: parsed.error }, { status: 400 }) };
      }
      // Fuse the evidence vault into the request so the draft cites real
      // exhibits (moonshot #10). Best-effort: a vault read fault degrades to an
      // exhibit-free draft rather than failing a payable generation.
      const docs = await evidence.getDocuments(access, caseId);
      const req = docs.ok ? attachExhibits(parsed.value, docs.value) : parsed.value;
      return { ok: true, value: { req, focus, caseId, clientSections } };
    }

    // Inline/demo path (caseId-less): validate the supplied payload.
    const parsed = parseDraftRequest(body);
    if (!parsed.ok) {
      return { ok: false, response: NextResponse.json({ error: parsed.error }, { status: 400 }) };
    }
    return { ok: true, value: { req: parsed.value, focus, caseId: null, clientSections } };
  },

  prompt: (input) =>
    input.focus
      ? { text: buildSectionPrompt(input.req, input.focus), options: { json: true, tier: "long" } }
      : { text: buildDraftPrompt(input.req), options: { json: true, tier: "long" } },

  // Unusable JSON → null → orchestrator reclaims + labels source "mock". The
  // regenerated section's heading is pinned to `focus` so the merge-by-heading
  // in persist always matches (the model may rename the section otherwise).
  guard: (raw, input) => {
    if (input.focus) {
      const parsed = tryParseSectionResponse(raw);
      return parsed ? { kind: "section", section: { heading: input.focus, body: parsed.body } } : null;
    }
    const parsed = tryParseDraftResponse(raw);
    return parsed ? { kind: "draft", draft: parsed } : null;
  },

  mock: (input) =>
    input.focus
      ? { kind: "section", section: { ...mockSection(input.req, input.focus), heading: input.focus } }
      : { kind: "draft", draft: mockDraft(input.req) },

  build: (output, source) =>
    output.kind === "section"
      ? (buildSectionResult(
          output.section,
          source as Parameters<typeof buildSectionResult>[1],
        ) as unknown as Record<string, unknown>)
      : (buildDraftResult(
          output.draft,
          source as Parameters<typeof buildDraftResult>[1],
        ) as unknown as Record<string, unknown>),

  // Live adjudication: score the drafted letter against the same invariants the
  // eval asserts (no fabricated specifics, no leaked visa code, case-law flagged).
  adjudicate: (output, input, source, body) => {
    const sections =
      output.kind === "draft" ? output.draft.sections : [output.section];
    const outputText = sections.map((s) => `${s.heading} ${s.body}`).join("\n");
    const inputText =
      input.req.criteria
        .map((c) => `${c.name} ${c.evidence} ${c.rationale}`)
        .join(" ") + ` ${input.req.petitioner}`;
    return runAdjudication({
      operation: input.focus ? "draft_section" : "draft",
      classification: input.req.classification,
      source,
      result: body,
      inputText,
      outputText,
    });
  },

  // Best-effort persistence (owner-only gate). The user already paid, so a save
  // failure is SURFACED (saveFailed), never swallowed. No caseId (inline path) →
  // nothing to persist.
  persist: async (output, input, user, source) => {
    if (!input.caseId || !user) {
      return { caseId: input.caseId, version: null, saveFailed: false };
    }
    const access: CaseAccess = { userId: user.id, email: null };

    if (output.kind === "draft") {
      const saved = await petitions.saveDraft(access, input.caseId, output.draft.sections, source);
      if (!saved.ok) {
        console.error("[/api/draft] failed to persist draft version", saved.error);
        return { caseId: input.caseId, version: null, saveFailed: true };
      }
      return { caseId: input.caseId, version: saved.value, saveFailed: false };
    }

    // Single section: merge it into the user's CURRENT sections (sent by the
    // client) so unsaved edits to OTHER sections survive the regenerate. Fall back
    // to the latest stored draft only when the client didn't send a usable set
    // (legacy clients) — the old behavior, which silently dropped those edits.
    const focusHeading = input.focus as string;
    let mergeBase = pickMergeBase(input.clientSections, focusHeading);
    if (!mergeBase) {
      const latest = await petitions.getLatestDraft(access, input.caseId);
      if (!latest.ok) {
        console.error("[/api/draft] failed to load latest draft for merge", latest.error);
        return { caseId: input.caseId, version: null, saveFailed: true };
      }
      if (!latest.value) {
        // No stored base draft to merge into (e.g. the initial full save failed).
        console.error("[/api/draft] section regenerate has no stored draft to merge into", {
          caseId: input.caseId,
        });
        return { caseId: input.caseId, version: null, saveFailed: true };
      }
      mergeBase = latest.value.sections;
    }
    const merged = mergeRegeneratedSection(mergeBase, focusHeading, output.section.body);
    const saved = await petitions.saveDraft(access, input.caseId, merged, source);
    if (!saved.ok) {
      console.error("[/api/draft] failed to persist regenerated section", saved.error);
      return { caseId: input.caseId, version: null, saveFailed: true };
    }
    return { caseId: input.caseId, version: saved.value, saveFailed: false };
  },

  onPersistError: (input) => ({ caseId: input.caseId, version: null, saveFailed: true }),
};
