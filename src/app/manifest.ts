import type { MetadataRoute } from "next";

// PWA manifest, ported verbatim from the former public/manifest.webmanifest —
// the App Router convention (this file, served at /manifest.webmanifest)
// replaces the static JSON file so the manifest is generated like every other
// metadata surface. See manifest.test.ts for the content guard (no retired
// flat-fee / attorney-signed claims in the description).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Immigration Concierge — Atelier of Arrival",
    short_name: "Immigration",
    description:
      "AI drafts your O-1 / EB-1 petition from your evidence — start free, pay per token. Work product for your attorney of record to review and sign; never legal advice.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#0d1f2d",
    background_color: "#f3ead6",
    icons: [
      { src: "/icons/icon-16.png", sizes: "16x16", type: "image/png" },
      { src: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { src: "/icons/icon-48.png", sizes: "48x48", type: "image/png" },
      { src: "/icons/icon-96.png", sizes: "96x96", type: "image/png" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
