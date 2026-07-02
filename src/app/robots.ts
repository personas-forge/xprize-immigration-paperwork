import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Crawl policy: the marketing funnel + the programmatic visa-guide matrix are
// the SEO surface; the authenticated workspace and the API are not for
// indexing (dashboard pages 404/redirect for crawlers anyway — this just says
// so politely and keeps crawl budget on the pages that convert).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard/", "/welcome", "/auth/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
