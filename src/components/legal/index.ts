/**
 * Shared legal / UPL compliance primitives.
 *
 * Cross-cutting presentational components used by every feature that renders AI
 * output (drafting, RFE, qualification, guidance) and by the sign-up consent
 * flow. They live here, not under any one feature, because the UPL safeguard
 * belongs to the whole app — not to `guidance`.
 */
export { DisclaimerStamp } from "./DisclaimerStamp";
export { CitationNote } from "./CitationNote";
