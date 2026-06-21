/**
 * Canonical production origin — single source for OG cards, sitemaps, and any
 * absolute URL. Mirrors the resolution the root layout uses (env → Vercel →
 * default), kept here so the sitemap and metadata builders share one value.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://immigration-paperwork.app");

/**
 * The comparative price anchor used across the marketing funnel (hero, Promises
 * strip, alternate landing). Centralized so the three surfaces can't drift to two
 * different "firm fees", and phrased as a hedged typical-quote estimate rather
 * than a hard charge — a specific, sourceless dollar comparison on a regulated-
 * adjacent legal product is FTC comparative-claim risk. Pair `range` with the
 * verb `verb` ("commonly quote", NOT "would charge"/"bills") in copy.
 *
 * Estimate basis: typical attorney quotes to assemble an O-1/EB-1A petition
 * packet, as of 2026. Re-confirm the range (and the year) before changing it.
 */
export const FIRM_FEE = {
  range: "$8,000–$15,000",
  verb: "commonly quote",
} as const;
