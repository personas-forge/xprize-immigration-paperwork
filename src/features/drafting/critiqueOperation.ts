/**
 * The /api/draft/critique operation spec (moonshot #19) — the adjudicator
 * redline pass.
 *
 * A SECOND model call that grades the sections the client is holding (which may
 * include local edits) against the O-1A standard and the draft's own citation
 * discipline, returning a per-section score + weakness + ready rewrite. It never
 * persists by itself — the studio's "Apply" swaps in a rewrite and saves through
 * the existing no-charge /api/draft/save path, so an accepted fix becomes a new
 * draft version with no new persistence code here.
 *
 * Billed as the heavy `draft_section` op (a draft sub-operation — no new metered
 * op, so the economy registry is unchanged) and owner-gated exactly like
 * draftSpec when a caseId is supplied.
 */

import { NextResponse } from "next/server";
import {
  buildCritiquePrompt,
  buildCritiqueResult,
  mockCritique,
  toSection,
  tryParseCritique,
  type DraftRequest,
  type DraftSection,
  type SectionCritique,
} from "./index";
import { str, MAX_PETITIONER } from "./criteria-text";
import { petitions } from "@/lib/data/adapters/petition";
import { type CaseAccess } from "@/lib/data/adapters/access";
import { type AiOperationSpec } from "@/lib/ai/operation";

const MAX_SECTIONS = 24;

export interface CritiqueInput {
  /** Minimal request context for the prompt (classification drives the standard). */
  req: DraftRequest;
  /** The sections to grade — sourced from the client (may include edits). */
  sections: DraftSection[];
  /** The case it belongs to (null = inline; gates the charge to the owner). */
  caseId: string | null;
}

/** Validate the `sections` array from an untrusted body into usable sections. */
function parseSections(value: unknown): DraftSection[] {
  const raw = Array.isArray(value) ? value : [];
  return raw.map(toSection).filter((s): s is DraftSection => s !== null).slice(0, MAX_SECTIONS);
}

export const critiqueSpec: AiOperationSpec<CritiqueInput, SectionCritique[]> = {
  // Reuse the heavy draft-section op + bucket — a critique is a draft
  // sub-operation, so no new metered op is introduced.
  operation: "draft_section",
  rateLimit: { bucket: "draft", scope: "draft", byUser: true },
  unauthenticatedError: "Sign in to critique a draft.",

  parse: async ({ body, resolveUser }) => {
    const record = (body ?? {}) as Record<string, unknown>;
    const sections = parseSections(record.sections);
    if (sections.length === 0) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "At least one draft section is required to critique." },
          { status: 400 },
        ),
      };
    }
    const caseId =
      typeof record.caseId === "string" && record.caseId.trim() !== ""
        ? record.caseId.trim()
        : null;
    const petitioner = str(record.petitioner, MAX_PETITIONER) || "the beneficiary";
    let classification = str(record.classification, 40) || "O-1A";

    // DB path: an owner-only gate before any charge (same as draftSpec). The
    // stored classification is authoritative; the sections graded are the
    // client's (the work product in front of the user).
    if (caseId) {
      const user = await resolveUser();
      if (!user) {
        return {
          ok: false,
          response: NextResponse.json(
            { error: "Sign in to critique a saved draft." },
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
        return {
          ok: false,
          response: NextResponse.json({ error: "Critique unavailable." }, { status: 503 }),
        };
      }
      classification = gate.value.classification;
      return {
        ok: true,
        value: { req: { petitioner, classification, criteria: [] }, sections, caseId },
      };
    }

    return {
      ok: true,
      value: { req: { petitioner, classification, criteria: [] }, sections, caseId: null },
    };
  },

  prompt: (input) => ({
    text: buildCritiquePrompt(input.req, input.sections),
    options: { json: true, tier: "long" },
  }),

  // Unusable JSON → null → orchestrator reclaims + labels source "mock".
  guard: (raw, input) => tryParseCritique(raw, input.sections),
  mock: (input) => mockCritique(input.sections),
  build: (critiques, source) =>
    buildCritiqueResult(
      critiques,
      source as Parameters<typeof buildCritiqueResult>[1],
    ) as unknown as Record<string, unknown>,
};
