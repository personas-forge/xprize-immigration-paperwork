/**
 * The validation layer — makes "is this state correct?" a tracked, cited,
 * dated property of each program and compliance claim, not an assumption.
 *
 * Every program a user can file (a LIVE program) MUST have a ValidationRecord
 * with status "verified", a legal basis, at least one primary/agency source,
 * and a verification date. `validation.test.ts` enforces this in CI, so a new
 * market can't go live without being validated against its sources.
 *
 * Two layers of correctness:
 *   - status "verified"   → confirmed against PRIMARY sources (what the team can
 *     do via research). This is what CI gates on.
 *   - counselApproved     → counsel has signed off on THIS PROGRAM'S validated
 *     rule-set (a per-program operational-readiness STATUS surfaced on
 *     /validation). It is NOT a per-case filing gate: the bar for an actual
 *     filing is the per-case attorney-of-record review & e-sign workflow
 *     (`src/features/review`), which gates each individual petition — not this
 *     framework-level flag. All records sit at `false` until counsel reviews the
 *     framework itself; the product is still filable because each case is gated
 *     case-by-case by the attorney of record.
 *
 * This is product/source validation, not legal advice — see docs/validation-framework.md.
 */

import { type Classification } from "./packs";
import {
  livePrograms,
  US_ARIZONA_ABS_FACT,
  US_FEDERAL_PRACTICE_FACT,
} from "./jurisdictions";

export type ValidationStatus = "verified" | "needs-review";

export interface SourceRef {
  title: string;
  url: string;
  // `secondary` is a reserved taxonomy slot — the lowest source tier in the
  // hierarchy (see docs/validation-framework.md "Source hierarchy"). No current
  // record uses it; kept deliberately so a future secondary source has a home.
  kind: "primary-law" | "agency-guidance" | "court-order" | "secondary";
}

export interface ValidationRecord {
  status: ValidationStatus;
  /** Human display name for this record. Program records derive their title from
   *  `VISA_PACKS[...].label`; compliance records (which have no pack) set it here
   *  so the label lives WITH the data instead of in a parallel page-side table. */
  title?: string;
  /** Statute / regulation the program rests on. */
  legalBasis: string;
  /** Number of criteria required, when applicable (e.g. 3 of 8). */
  threshold?: string;
  /** ISO date (yyyy-mm-dd) the facts were last checked against the sources. */
  lastVerified: string;
  /** True once counsel has signed off on THIS PROGRAM'S validated rule-set — a
   *  per-program operational-readiness status shown on /validation. NOT the
   *  per-case filing gate (that is the attorney-of-record review & e-sign
   *  workflow in `src/features/review`, applied to each individual petition). */
  counselApproved: boolean;
  sources: SourceRef[];
  notes?: string;
}

/** Re-verify a record at least this often (or on any regulatory change). */
export const REVALIDATE_AFTER_DAYS = 180;

const TODAY = "2026-05-30"; // date of the last validation pass

// — Program validations ──────────────────────────────────────────────────────

export const PROGRAM_VALIDATIONS: Record<Classification, ValidationRecord> = {
  "O-1A": {
    status: "verified",
    legalBasis: "8 CFR 214.2(o)(3)(iii)",
    threshold: "3 of 8 criteria (or a qualifying one-time major award)",
    lastVerified: TODAY,
    counselApproved: false,
    sources: [
      {
        title: "8 CFR 214.2 — O classification (eCFR)",
        url: "https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-214/subpart-A/section-214.2",
        kind: "primary-law",
      },
      {
        title: "USCIS Policy Manual, Vol. 2 Part M Ch. 4 — O-1 Beneficiaries",
        url: "https://www.uscis.gov/policy-manual/volume-2-part-m-chapter-4",
        kind: "agency-guidance",
      },
    ],
    notes:
      "Threshold (3 of 8) and the criteria set confirmed against the regulation. " +
      "Criterion labels are paraphrased; verbatim wording + counsel sign-off pending.",
  },
  "O-1B": {
    status: "verified",
    legalBasis: "8 CFR 214.2(o)(3)(iv)",
    threshold: "3 of 6 criteria (or a qualifying major award/nomination)",
    lastVerified: TODAY,
    counselApproved: false,
    sources: [
      {
        title: "8 CFR 214.2 — O classification (eCFR)",
        url: "https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-214/subpart-A/section-214.2",
        kind: "primary-law",
      },
      {
        title: "USCIS Policy Manual, Vol. 2 Part M — Nonimmigrants of Extraordinary Ability (O)",
        url: "https://www.uscis.gov/policy-manual/volume-2-part-m",
        kind: "agency-guidance",
      },
    ],
    notes:
      "Arts criteria model (3 of 6) confirmed. Criterion labels are paraphrased " +
      "from the regulation; verbatim wording + counsel sign-off pending.",
  },
  "EB-1A": {
    status: "verified",
    legalBasis: "8 CFR 204.5(h)(3)",
    threshold: "3 of 10 criteria (or a qualifying one-time major award)",
    lastVerified: TODAY,
    counselApproved: false,
    sources: [
      {
        title: "8 CFR 204.5(h)(3) — Extraordinary ability (Cornell LII)",
        url: "https://www.law.cornell.edu/cfr/text/8/204.5",
        kind: "primary-law",
      },
      {
        title: "USCIS Policy Manual, Vol. 6 Part F Ch. 2 — Extraordinary Ability",
        url: "https://www.uscis.gov/policy-manual/volume-6-part-f-chapter-2",
        kind: "agency-guidance",
      },
    ],
    notes:
      "The ten criteria in the pack match 8 CFR 204.5(h)(3)(i)-(x) verbatim in set " +
      "and order; threshold 3 of 10 confirmed. Counsel sign-off pending.",
  },
  "UK-Global-Talent": {
    status: "needs-review",
    legalBasis: "UK Immigration Rules Appendix Global Talent (endorsement-based)",
    lastVerified: TODAY,
    counselApproved: false,
    sources: [
      {
        title: "Global Talent visa — GOV.UK",
        url: "https://www.gov.uk/global-talent",
        kind: "agency-guidance",
      },
    ],
    notes:
      "MODEL MISMATCH: UK Global Talent is ENDORSEMENT-based (a designated endorsing " +
      "body assesses leader/potential-leader status, plus a prize route) — NOT a fixed " +
      "'meet N of X criteria' checklist like the US programs. The current pack is a " +
      "placeholder and the model is wrong for the UK; a real UK build needs an " +
      "endorsement workflow, not a criteria pack. Correctly gated 'planned' (not offered).",
  },
};

// — Compliance validations (underpin the US market) ─────────────────────────

export const COMPLIANCE_VALIDATIONS: Record<string, ValidationRecord> = {
  "us-federal-practice": {
    status: "verified",
    title: "Federal practice of immigration law",
    legalBasis: "8 CFR 1001.1(f); 8 CFR 1.2; 8 CFR 1292.1",
    lastVerified: TODAY,
    counselApproved: false,
    sources: [
      {
        title: "8 CFR 1001.1(f) — definition of 'attorney' (Cornell LII)",
        url: "https://www.law.cornell.edu/cfr/text/8/1001.1",
        kind: "primary-law",
      },
      {
        title: "8 CFR 1.2 — definitions (Cornell LII)",
        url: "https://www.law.cornell.edu/cfr/text/8/1.2",
        kind: "primary-law",
      },
    ],
    notes:
      `${US_FEDERAL_PRACTICE_FACT} 'Attorney' = eligible to practice and a member ` +
      "in good standing of the bar of the highest court of ANY one U.S. " +
      "state/territory/DC, not under restriction. Federal immigration practice is " +
      "not limited to the client's state → one attorney of record covers the nation.",
  },
  "us-arizona-abs": {
    status: "verified",
    title: "Law-firm structure (Arizona ABS)",
    legalBasis: "Arizona Supreme Court Order R-20-0034 (eff. 2021-01-01); ER 5.4 eliminated",
    lastVerified: TODAY,
    counselApproved: false,
    sources: [
      {
        title: "Arizona Supreme Court Order R-20-0034 (Final Order)",
        url: "https://www.azcourts.gov/Portals/0/215/ABS%20Documents/Final%20Order_R-20-0034.pdf",
        kind: "court-order",
      },
      {
        title: "Arizona Judicial Branch — Alternative Business Structure (ABS) Q&A",
        url: "https://www.azcourts.gov/accesstolegalservices/Questions-and-Answers/abs",
        kind: "agency-guidance",
      },
    ],
    notes:
      "Arizona is the first state to eliminate ER 5.4; an ABS may have non-lawyer " +
      "ownership/economic interest and must employ ≥1 active bar member in good standing. " +
      `${US_ARIZONA_ABS_FACT} Validates this software-licensed-to-attorney-owned-firm structure.`,
  },
};

// — Helpers ──────────────────────────────────────────────────────────────────

export function validationFor(program: string): ValidationRecord | undefined {
  return PROGRAM_VALIDATIONS[program as Classification];
}

/** Every validation record paired with its map key — the key IS the record's
 *  identity/label (it used to be hand-copied into a `subject` field that could
 *  drift from the key; the freshness report now prints the key directly). */
export function allValidations(): Array<{ key: string; record: ValidationRecord }> {
  return [
    ...Object.entries(PROGRAM_VALIDATIONS),
    ...Object.entries(COMPLIANCE_VALIDATIONS),
  ].map(([key, record]) => ({ key, record }));
}

/** Whole days between two yyyy-mm-dd dates (b - a). */
export function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(`${aIso}T00:00:00Z`).getTime();
  const b = new Date(`${bIso}T00:00:00Z`).getTime();
  return Math.floor((b - a) / 86_400_000);
}

/** Today as a yyyy-mm-dd string (UTC) — the reference date for freshness checks.
 *  Single home so the page, the CI freshness script, and the freshness math don't
 *  each re-inline `new Date().toISOString().slice(0, 10)`. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Shift a yyyy-mm-dd date by N whole days, returning yyyy-mm-dd (UTC). */
export function addDays(iso: string, days: number): string {
  const t = new Date(`${iso}T00:00:00Z`).getTime() + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Warn this many days before a record is due, so re-verification can be planned. */
export const REVERIFY_WARN_DAYS = 30;

export type FreshnessLevel = "fresh" | "due-soon" | "stale";

export interface Freshness {
  /** Days until re-verification is due (negative = overdue; NaN = unverifiable). */
  daysLeft: number;
  level: FreshnessLevel;
  /** yyyy-mm-dd the record is due for re-verification (the raw date when unverifiable). */
  dueBy: string;
  /** True when `lastVerified` could not be parsed — fail-safe forces level "stale". */
  unverifiable: boolean;
}

/** Classify a record's freshness as of `today` (a yyyy-mm-dd UTC string).
 *
 *  Fail-SAFE on a bad date: an unparseable `lastVerified` (or `today`) makes
 *  `daysBetween` return NaN, and every comparison against NaN is `false` — so the
 *  naive `daysLeft < 0 ? "stale" : … : "fresh"` classifier would fall through to
 *  "fresh" and present a corrupt-dated legal rule as current. We treat an
 *  unparseable date as STALE (the whole point of this framework is that a record
 *  whose freshness we can't establish is NOT shown as current). */
export function freshnessOf(record: ValidationRecord, today: string): Freshness {
  const elapsed = daysBetween(record.lastVerified, today);
  if (Number.isNaN(elapsed)) {
    // Don't call addDays here — new Date(NaN).toISOString() throws.
    return { daysLeft: NaN, level: "stale", dueBy: record.lastVerified, unverifiable: true };
  }
  const daysLeft = REVALIDATE_AFTER_DAYS - elapsed;
  const level: FreshnessLevel =
    daysLeft < 0 ? "stale" : daysLeft <= REVERIFY_WARN_DAYS ? "due-soon" : "fresh";
  return {
    daysLeft,
    level,
    dueBy: addDays(record.lastVerified, REVALIDATE_AFTER_DAYS),
    unverifiable: false,
  };
}

/** Is this record overdue for re-verification (or unverifiable) as of `today`?
 *  Thin wrapper over `freshnessOf` so the staleness rule lives in exactly one
 *  place — used by the CI freshness guard. */
export function isStale(record: ValidationRecord, today: string): boolean {
  return freshnessOf(record, today).level === "stale";
}

/**
 * RUNTIME STALENESS CONTRACT (recorded so the red /validation badge is not
 * mistaken for an enforced runtime block):
 *
 *  - `validation.test.ts` is the HARD gate. CI fails if any LIVE program is stale
 *    as of the commit date, so a stale rule-set cannot SHIP.
 *  - At runtime we deliberately do NOT withdraw an already-verified program once
 *    it crosses {@link REVALIDATE_AFTER_DAYS}. Hiding a program whose rules are
 *    still correct (merely overdue for re-confirmation) would deny service on a
 *    good rule-set — a worse failure than serving a slightly-overdue-but-verified
 *    rule, and `livePrograms()`/`isLiveProgram()` therefore ignore freshness.
 *  - The assumption this rests on — a deployed build is re-shipped within the
 *    window — is made CHECKABLE by {@link stalePrograms}: wire it into a monitor
 *    or an ops banner (the /validation page already shows per-record freshness).
 *
 * Returns the live program codes whose validation record is stale (or missing /
 * unverifiable) as of `today` — empty in the normal, fresh case.
 */
export function stalePrograms(today: string = todayIso()): Classification[] {
  return livePrograms().filter((code) => {
    const record = validationFor(code);
    return record ? isStale(record, today) : true;
  });
}
