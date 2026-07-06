import { PassportLanding } from "@/components/landing/PassportLanding";
import { SITE_URL } from "@/lib/site";

// Marketing homepage — the "Passport / Arrival" design: a side-panel stamp-tab
// nav, full-screen sections that snap one-per-movement (viewport lock), animated
// arrival visuals, and a "record measured" section built on themed Recharts that
// re-skins with the parchment/ink toggle. Indexable (inherits the layout's
// canonical title/description). The interactive screener lives at /qualify.

// Site-wide Organization/WebSite/SoftwareApplication structured data — placed
// once on the homepage (the canonical entity page) rather than every route,
// matching standard SEO/AI-answer-engine guidance. Mirrors the FAQ+Service
// JSON-LD already shipped per-page under /visa/[classification]/[profession].
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Immigration Concierge",
      url: SITE_URL,
      logo: `${SITE_URL}/brand/logo.png`,
    },
    {
      "@type": "WebSite",
      name: "Immigration Concierge",
      url: SITE_URL,
      description:
        "AI drafts your O-1 / EB-1 petition from your evidence — start free, pay per token. Work product for your attorney of record to review and sign; never legal advice.",
    },
    {
      "@type": "SoftwareApplication",
      name: "Immigration Concierge",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Free to start; pay-per-token for AI drafting operations.",
      },
    },
  ],
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        // Static, server-rendered, no user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PassportLanding />
    </>
  );
}
