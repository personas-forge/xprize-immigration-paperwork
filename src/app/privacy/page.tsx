import type { Metadata } from "next";
import { PageFrame, ChapterMark } from "@/components/brand";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What Immigration Concierge collects, how case data is processed, and the export/delete rights built into the product.",
};

// Companion to /terms (see that page's module note). Every claim below maps to
// real product behavior: server-only data access, the processors actually in
// the stack, the export endpoint, and irreversible account deletion.

const SECTIONS: Array<{ heading: string; body: string[] }> = [
  {
    heading: "1. What we collect",
    body: [
      "Account identity: your Google account's name, email, and avatar, via Firebase Authentication. We never see your Google password.",
      "Case content you provide: background summaries, evidence documents you paste or describe, and the drafts generated from them.",
      "Billing records: a token ledger (grants, debits, reclaims, purchases, refunds) and the payment provider's order identifiers. Card details are handled entirely by Polar, our payment processor — they never touch our servers.",
      "Consent history: which terms version you accepted and when.",
    ],
  },
  {
    heading: "2. How your case data is processed",
    body: [
      "Your data lives in our database (Google Cloud Firestore) and is only ever read or written server-side; there is no direct client access, and security rules deny all client reads and writes.",
      "When you run an AI operation, the relevant case text is sent to the configured model provider (Google Gemini, or Anthropic models in some deployments) to generate your draft. Prompts instruct the model to use only the facts you provided.",
      "Your case is visible to you and — once you submit it for review — to the configured attorney of record. Nobody else's cases are visible to you, and yours are not visible to other users.",
    ],
  },
  {
    heading: "3. What we don't do",
    body: [
      "We do not sell your data. We do not use your case content to advertise to you. Marketing emails are opt-in and controlled by a toggle on your account page.",
    ],
  },
  {
    heading: "4. Your rights",
    body: [
      "Export: download everything we hold about you as JSON from your account page, any time.",
      "Deletion: delete your account from the account page — it requires a typed confirmation and is irreversible; your profile, cases, documents, and drafts are removed.",
      "Correction: your case content is yours to edit at any time in the workspace.",
    ],
  },
  {
    heading: "5. Retention and security",
    body: [
      "Data is retained while your account exists and deleted when you delete it. Payment/ledger records may be retained as required for accounting.",
      "Access to production data is limited to server-side service credentials; all traffic is encrypted in transit.",
    ],
  },
  {
    heading: "6. Contact and changes",
    body: [
      "Material changes to this policy re-prompt for consent at your next sign-in, with the version recorded on your account page.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <PageFrame>
      <SiteHeader />
      <section className="mx-auto max-w-3xl px-8 pb-20 pt-16">
        <ChapterMark numeral="§" label="Privacy Policy" />
        <h1 className="display mt-5 text-[clamp(2rem,5vw,3.2rem)]">
          Privacy <em>Policy</em>
        </h1>
        <p className="microprint mt-3" style={{ color: "var(--seal)" }}>
          Draft · pending review by counsel — provided so the policy you are
          asked to accept is readable in full.
        </p>
        {SECTIONS.map((s) => (
          <div key={s.heading} className="mt-10">
            <h2 className="display text-xl text-foreground">{s.heading}</h2>
            {s.body.map((p, i) => (
              <p
                key={i}
                className="mt-3 font-sans text-[16px] leading-relaxed text-muted-strong"
              >
                {p}
              </p>
            ))}
          </div>
        ))}
      </section>
      <SiteFooter />
    </PageFrame>
  );
}
