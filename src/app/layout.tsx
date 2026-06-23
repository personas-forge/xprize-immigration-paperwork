import type { Metadata, Viewport } from "next";
import { Fraunces, Newsreader, IBM_Plex_Mono } from "next/font/google";
import { themeInitScript } from "@/components/ThemeToggle";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// — Typography ────────────────────────────────────────────────────────────
// Fraunces: an opsz-variable serif with high contrast and characterful
// italics — chosen for display so headlines feel engraved rather than typed.
// Newsreader: a literary text serif at body size; warm, low-contrast,
// designed for long-form reading (the perfect tone for an immigration
// concierge who has to explain things calmly).
// IBM Plex Mono: case numbers, exhibit IDs, microprint — official feel.
const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

const siteTitle =
  "Immigration Concierge — AI-drafted O-1 & EB-1A petitions, ready for your attorney";
const siteDescription =
  "AI drafts your O-1 / EB-1 petition from your evidence — start free, pay per token. Work product for your attorney of record to review and sign; never legal advice.";

// Canonical production URL — shared via @/lib/site so OG cards, sitemaps, and
// any relative metadata URL resolve to the right origin even in build sandboxes
// where NEXT_PUBLIC_SITE_URL isn't injected.
const siteUrl = SITE_URL;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  manifest: "/manifest.webmanifest",
  applicationName: "Immigration Concierge",
  icons: {
    icon: [
      { url: "/icons/icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: ["/icons/icon-32.png"],
  },
  appleWebApp: {
    capable: true,
    title: "Immigration",
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    siteName: "Immigration Concierge",
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Immigration Concierge — Atelier of Arrival",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3ead6" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1f2d" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${newsreader.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Theme pre-paint — set data-theme="ink" before first paint when
            the user previously chose it, so the page never flashes light. */}
        <script
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body>
        {/* Skip-to-content link — only visible while focused, lets keyboard
            users bypass the masthead and jump straight to <main id="main"> */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-foreground focus:px-4 focus:py-2 focus:font-mono focus:text-[14px] focus:uppercase focus:tracking-document focus:text-background focus-ring"
        >
          Skip to content
        </a>
        {/* Skip-link target — a real <main> landmark so screen-reader
            rotors and the skip link land on the document's main region. */}
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
