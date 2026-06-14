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
