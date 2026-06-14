/**
 * The /api/rfe/forecast operation spec (moonshot #20) — the RFE Risk Radar.
 *
 * Predicts, at draft time, which criteria USCIS is most likely to challenge and
 * the evidence that pre-empts each — ranked. Reuses the heavy `rfe` op + bucket
 * (an RFE sub-operation, so no new metered op) and is owner-gated when a caseId
 * is supplied, exactly like the responder. It never persists by itself.
 */

import { NextResponse } from "next/server";
import {
  buildRfeForecastPrompt,
  buildRfeForecastResult,
  mockRfeForecast,
  tryParseRfeForecast,
  type RfeChallenge,
  type RfeCriterion,
  type RfeRequest,
} from "./index";
import { str, MAX_PETITIONER, MAX_TEXT, MAX_CRITERIA } from "@/features/drafting/criteria-text";
import { petitions } from "@/lib/data/adapters/petition";
import { type CaseAccess } from "@/lib/data/adapters/access";
import { type AiOperationSpec } from "@/lib/ai/operation";

export interface ForecastInput {
  req: RfeRequest;
  caseId: string | null;
}

/** Validate an untrusted `criteria` array into RfeCriterion[]. */
function parseCriteria(value: unknown): RfeCriterion[] {
  const raw = Array.isArray(value) ? value : [];
  return raw
    .slice(0, MAX_CRITERIA)
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({
      name: str(c.name, 120),
      status: str(c.status, 20),
      evidence: str(c.evidence, MAX_TEXT),
      rationale: str(c.rationale, MAX_TEXT),
    }))
    .filter((c) => c.name !== "");
}

export const forecastSpec: AiOperationSpec<ForecastInput, RfeChallenge[]> = {
  operation: "rfe",
  rateLimit: { bucket: "rfe", scope: "rfe", byUser: true },
  unauthenticatedError: "Sign in to forecast RFE risk.",

  parse: async ({ body, resolveUser }) => {
    const record = (body ?? {}) as Record<string, unknown>;
    const caseId =
      typeof record.caseId === "string" && record.caseId.trim() !== ""
        ? record.caseId.trim()
        : null;
    const petitioner = str(record.petitioner, MAX_PETITIONER) || "the beneficiary";

    // DB path: owner-only gate + authoritative criteria from the case.
    if (caseId) {
      const user = await resolveUser();
      if (!user) {
        return {
          ok: false,
          response: NextResponse.json(
            { error: "Sign in to forecast a saved case." },
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
          response: NextResponse.json({ error: "Forecast unavailable." }, { status: 503 }),
        };
      }
      const criteria = await petitions.getCriteria(access, caseId);
      if (!criteria.ok) {
        return {
          ok: false,
          response: NextResponse.json({ error: "Forecast unavailable." }, { status: 503 }),
        };
      }
      const req: RfeRequest = {
        petitioner,
        classification: gate.value.classification,
        criteria: criteria.value.map((c) => ({
          name: c.name,
          status: c.status,
          evidence: c.evidence,
          rationale: c.rationale,
        })),
        rfeText: "", // forecast is pre-RFE — the prompt never reads it
      };
      return { ok: true, value: { req, caseId } };
    }

    // Inline path.
    const criteria = parseCriteria(record.criteria);
    if (criteria.length === 0) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "At least one scored criterion is required to forecast." },
          { status: 400 },
        ),
      };
    }
    const classification = str(record.classification, 40) || "O-1A";
    return {
      ok: true,
      value: { req: { petitioner, classification, criteria, rfeText: "" }, caseId: null },
    };
  },

  prompt: (input) => ({
    text: buildRfeForecastPrompt(input.req),
    options: { json: true, tier: "long" },
  }),

  guard: (raw, input) => tryParseRfeForecast(raw, input.req),
  mock: (input) => mockRfeForecast(input.req),
  build: (challenges, source) =>
    buildRfeForecastResult(
      challenges,
      source as Parameters<typeof buildRfeForecastResult>[1],
    ) as unknown as Record<string, unknown>,
};
