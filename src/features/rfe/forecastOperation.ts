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
  hasReliedCriteria,
  mockRfeForecast,
  tryParseRfeForecast,
  type RfeChallenge,
  type RfeCriterion,
  type RfeRequest,
} from "./index";
import { str, MAX_PETITIONER, parseCriteriaArray } from "@/features/drafting/criteria-text";
import { petitions } from "@/lib/data/adapters/petition";
import { resolveCaseForParse } from "@/lib/data/adapters/parse-gate";
import { type AiOperationSpec } from "@/lib/ai/operation";

export interface ForecastInput {
  req: RfeRequest;
  caseId: string | null;
}

/** 400 (no charge) when there is nothing to forecast. */
function noReliedToForecast() {
  return {
    ok: false as const,
    response: NextResponse.json(
      {
        error:
          "No relied-on criteria to forecast — score at least one criterion Met, Strong, or Partial first.",
      },
      { status: 400 },
    ),
  };
}

/** Validate an untrusted `criteria` array into RfeCriterion[] (shared normalizer). */
function parseCriteria(value: unknown): RfeCriterion[] {
  return parseCriteriaArray(value);
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
      // Pass the caller's email (NOT owner-only) so a configured attorney of
      // record can forecast a case they can already draft — matching the responder.
      const r = await resolveCaseForParse(resolveUser, caseId, {
        unauthenticatedError: "Sign in to forecast a saved case.",
      });
      if (!r.ok) return r;
      const { access } = r;
      const criteria = await petitions.getCriteria(access, caseId);
      if (!criteria.ok) {
        return {
          ok: false,
          response: NextResponse.json({ error: "Forecast unavailable." }, { status: 503 }),
        };
      }
      const req: RfeRequest = {
        petitioner,
        classification: r.case.classification,
        criteria: criteria.value.map((c) => ({
          name: c.name,
          status: c.status,
          evidence: c.evidence,
          rationale: c.rationale,
        })),
        rfeText: "", // forecast is pre-RFE — the prompt never reads it
      };
      if (!hasReliedCriteria(req)) return noReliedToForecast();
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
    const req: RfeRequest = { petitioner, classification, criteria, rfeText: "" };
    // Reject BEFORE charging when nothing is relied-on (every criterion None/
    // blank) — the forecast filters to relied-on criteria downstream of the
    // charge, so without this gate the user is debited for an empty radar.
    if (!hasReliedCriteria(req)) return noReliedToForecast();
    return { ok: true, value: { req, caseId: null } };
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
