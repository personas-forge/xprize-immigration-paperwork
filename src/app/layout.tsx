import type { Metadata } from "next";
import { Fraunces, Newsreader, IBM_Plex_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Immigration Concierge — AI-drafted, attorney-signed O-1 petitions",
  description:
    "$2,500 flat for an O-1A petition. AI assembles, attorney signs, USCIS files.",
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
    >
      <body>{children}</body>
    </html>
  );
}
