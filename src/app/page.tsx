import { PassportLanding } from "@/components/landing/PassportLanding";

// Marketing homepage — the "Passport / Arrival" design: a side-panel stamp-tab
// nav, full-screen sections that snap one-per-movement (viewport lock), animated
// arrival visuals, and a "record measured" section built on themed Recharts that
// re-skins with the parchment/ink toggle. Indexable (inherits the layout's
// canonical title/description). The interactive screener lives at /qualify.
export default function Page() {
  return <PassportLanding />;
}
