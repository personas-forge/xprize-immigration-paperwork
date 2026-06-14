import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { livePrograms } from "@/features/qualification";
import { PROFESSIONS } from "@/features/qualification/professions";

// Generated sitemap (moonshot #17) — the static marketing pages plus the full
// (classification × profession) SEO matrix, so Google and AI answer engines can
// index every long-tail landing page.

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => `${SITE_URL}${path}`;

  const staticPages: MetadataRoute.Sitemap = [
    { url: url("/"), changeFrequency: "weekly", priority: 1 },
    { url: url("/qualify"), changeFrequency: "weekly", priority: 0.9 },
    { url: url("/pricing"), changeFrequency: "monthly", priority: 0.6 },
    { url: url("/faq"), changeFrequency: "monthly", priority: 0.5 },
    { url: url("/validation"), changeFrequency: "monthly", priority: 0.4 },
  ];

  const visaPages: MetadataRoute.Sitemap = livePrograms().flatMap((c) =>
    PROFESSIONS.map((p) => ({
      url: url(`/visa/${c.toLowerCase()}/${p.slug}`),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  );

  return [...staticPages, ...visaPages];
}
