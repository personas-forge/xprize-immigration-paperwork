/**
 * The closed set of USCIS decision outcomes an attorney can record.
 *
 * Single source of truth for BOTH the ReviewPanel `<select>` options and the
 * server-side allowlist in `actions.ts`, so the form and its validator can't
 * drift (add/rename an option in one place and the other silently rejects or
 * renders a dead option). "Approved" is the only terminal outcome — it advances
 * the case to "Approved"; every other decision keeps the case "Filed".
 *
 * Pure data, no server-only deps, so the client `<select>` can import it.
 */
export const USCIS_DECISIONS = ["Approved", "RFE issued", "Denied"] as const;

export type UscisDecision = (typeof USCIS_DECISIONS)[number];
