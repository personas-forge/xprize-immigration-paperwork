/**
 * The jurisdiction model — the layer above visa programs.
 *
 * A jurisdiction is a destination immigration regime (country). Each owns one or
 * more visa programs (criteria packs in packs.ts) and carries the legal-practice
 * scope for that market: who may lawfully prepare/sign, the firm structure, and
 * the market-specific disclaimer.
 *
 * SCOPE (locked):
 *  - US is LIVE — federal, so one product serves all 50 states; an attorney of
 *    record licensed in any one state (in good standing) covers the nation. The
 *    platform is software licensed to an attorney-owned firm (Arizona ABS).
 *  - UK is PLANNED — Global Talent; representation by a solicitor (SRA) or an
 *    OISC-regulated adviser. Criteria/rep rules are provisional pending counsel.
 *
 * Only LIVE programs are offered to users (`livePrograms` / `isLiveProgram`); a
 * case's jurisdiction is DERIVED from its program (`jurisdictionFor`), so nothing
 * new is persisted. This is informational product scope, not legal advice — the
 * UPL/representation specifics for each market need confirmation by counsel.
 */

import { DISCLAIMER } from "@/features/guidance/guidance";
import { type Classification } from "./packs";

export type JurisdictionCode = "US" | "UK";

export interface Jurisdiction {
  code: JurisdictionCode;
  country: string;
  /** Label shown in the product (selector / case header). */
  label: string;
  /** "live" programs are offered; "planned" are defined but not yet enabled. */
  status: "live" | "planned";
  /** Who may lawfully prepare & sign in this market. */
  representationRole: string;
  /** Licensing / business-structure note for this market. */
  representationNote: string;
  /** Market-specific not-legal-advice disclaimer. */
  disclaimer: string;
  /** The visa programs (packs.ts codes) belonging to this jurisdiction. */
  programs: readonly Classification[];
}

const UK_DISCLAIMER =
  "This is general information only, not legal advice. UK immigration " +
  "applications must be reviewed by a solicitor (SRA-regulated) or an " +
  "OISC-regulated adviser before submission. The criteria and representation " +
  "rules shown here are provisional and not yet in service.";

export const JURISDICTIONS: Record<JurisdictionCode, Jurisdiction> = {
  US: {
    code: "US",
    country: "United States",
    label: "United States · federal (all 50 states)",
    status: "live",
    representationRole: "attorney of record",
    representationNote:
      "U.S. immigration is federal: an attorney licensed and in good standing in " +
      "any one U.S. state may act as attorney of record nationwide (8 CFR §1.2; " +
      "USCIS Form G-28). The platform is software licensed to an attorney-owned " +
      "firm under an Arizona ABS (Alternative Business Structure).",
    disclaimer: DISCLAIMER,
    programs: ["O-1A", "O-1B", "EB-1A"],
  },
  UK: {
    code: "UK",
    country: "United Kingdom",
    label: "United Kingdom · Global Talent (planned)",
    status: "planned",
    representationRole: "solicitor (SRA) or OISC-regulated adviser",
    representationNote:
      "UK immigration advice must be given by a solicitor (SRA-regulated) or an " +
      "OISC-regulated adviser. Representation rules and criteria are provisional " +
      "pending review by UK counsel.",
    disclaimer: UK_DISCLAIMER,
    programs: ["UK-Global-Talent"],
  },
};

const ALL: readonly Jurisdiction[] = Object.values(JURISDICTIONS);

/**
 * The jurisdiction a program belongs to.
 *
 * DEFAULT-US RATIONALE (recorded — the fallback is intentional, not happy-path
 * convenience): every LIVE program is US by construction (only the US
 * jurisdiction is `status: "live"`), so a code that matches NO jurisdiction is
 * corrupt/legacy data or a typo — not a real second live market. We keep the US
 * default so a known code always resolves, but WARN when the fallback fires on an
 * UNRECOGNISED code, so a mis-persisted `classification` surfaces in logs instead
 * of being silently painted with US representation + the US disclaimer (a wrong-
 * jurisdiction legal disclosure). Known codes — incl. PLANNED ones like
 * `UK-Global-Talent` — resolve to their real jurisdiction and never warn.
 */
export function jurisdictionFor(programCode: string): Jurisdiction {
  const match = ALL.find((j) => (j.programs as readonly string[]).includes(programCode));
  if (match) return match;
  console.warn(
    `[jurisdictions] unrecognised program code ${JSON.stringify(programCode)} — ` +
      "defaulting to US jurisdiction (representation + disclaimer). This usually " +
      "means a corrupt or legacy `classification`; verify the stored value.",
  );
  return JURISDICTIONS.US;
}

/** Jurisdictions currently in service. */
export function liveJurisdictions(): Jurisdiction[] {
  return ALL.filter((j) => j.status === "live");
}

/** Program codes that are currently offered to users (live jurisdictions only). */
export function livePrograms(): Classification[] {
  return liveJurisdictions().flatMap((j) => [...j.programs]);
}

/** True when a program code is offered (its jurisdiction is live). */
export function isLiveProgram(code: unknown): code is Classification {
  return typeof code === "string" && livePrograms().includes(code as Classification);
}
