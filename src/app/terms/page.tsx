import type { Metadata } from "next";
import { PageFrame, ChapterMark } from "@/components/brand";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { DisclaimerStamp } from "@/components/legal";
import { CONSENT_DISCLAIMER } from "@/lib/result";
import { FREE_SIGNUP_GRANT } from "@/lib/tokens/economy";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms under which Immigration Concierge provides AI-assisted petition drafting tools. A drafting tool, not a law firm; never legal advice.",
};

// The consent form has always required accepting these terms; before this page
// existed they were nowhere to be READ — a public-launch blocker. The content
// below is grounded in what the product actually does (token economy, rescue
// refunds, export/delete) and is explicitly a DRAFT pending counsel review —
// launch condition recorded in SHIP_REPORT.md.

const SECTIONS: Array<{ heading: string; body: string[] }> = [
  {
    heading: "1. What this service is — and is not",
    body: [
      "Immigration Concierge is a software tool that helps you assemble, organize, and draft U.S. immigration petition materials (O-1A, O-1B, EB-1A) from information you provide. All output is informational drafting — work product for a licensed immigration attorney of record to review, edit, and sign.",
      "We are not a law firm, we do not provide legal advice or legal representation, and no attorney–client relationship is created by using the service. An attorney of record — yours or your firm's — is required before anything is filed with USCIS. The service records filing details your attorney enters; it does not transmit anything to USCIS.",
    ],
  },
  {
    heading: "2. Accounts and consent",
    body: [
      "You sign in with a Google account and must accept these Terms and the Privacy Policy before using the workspace. Your consent history (version and date) is recorded and visible on your account page.",
      "You are responsible for the accuracy of the information you provide. AI-generated drafts can contain errors; your attorney of record must verify every statement before filing.",
    ],
  },
  {
    heading: "3. Tokens and payment",
    body: [
      `AI operations are metered in prepaid tokens. New accounts receive a one-time grant of ${FREE_SIGNUP_GRANT} tokens. Additional tokens are sold in bundles (and an optional monthly allowance) at the prices shown on the billing page; payment is processed by Polar. Each operation's token cost is shown before you run it.`,
      "If an AI operation fails — the model errors, produces unusable output, or is withheld by our compliance screening — the charge is automatically reclaimed. If a result is generated but fails to save, free save-retry tools are provided; a re-generation is a new charge.",
      "Purchased tokens are refundable per the payment provider's refund flow; refunds claw back tokens proportionally to the refunded amount. Tokens have no cash value outside the service.",
    ],
  },
  {
    heading: "4. Your content",
    body: [
      "You retain all rights to the information and documents you submit and to the drafts generated from them. You grant us the limited license needed to operate the service: storing your content, processing it through the AI engines that generate your drafts, and displaying it back to you and to the attorney of record on your case.",
      "You can export your data as JSON and delete your account (irreversibly) at any time from the account page.",
    ],
  },
  {
    heading: "5. Acceptable use",
    body: [
      "Do not submit information you have no right to share, attempt to access other users' cases, probe or overload the service, or use it to misrepresent facts to any government agency. Fabricating evidence for an immigration filing is a federal crime; the service's drafting rules refuse invented specifics, and you must not attempt to defeat them.",
    ],
  },
  {
    heading: "6. Disclaimers and liability",
    body: [
      "The service is provided \"as is\" without warranties of any kind. We make no representation about the outcome of any immigration petition — likelihood scores are informational estimates, not predictions. USCIS fees, attorney fees, and filing outcomes are outside our control and responsibility.",
      "To the maximum extent permitted by law, our aggregate liability for any claim arising from the service is limited to the amount you paid for tokens in the twelve months preceding the claim.",
    ],
  },
  {
    heading: "7. Changes and contact",
    body: [
      "We may update these terms; material changes re-prompt for consent at next sign-in (the consent version is shown on your account page). Continued use after re-consent constitutes acceptance.",
    ],
  },
];

export default function TermsPage() {
  return (
    <PageFrame>
      <SiteHeader />
      <section className="mx-auto max-w-3xl px-8 pb-20 pt-16">
        <ChapterMark numeral="§" label="Terms of Service" />
        <h1 className="display mt-5 text-[clamp(2rem,5vw,3.2rem)]">
          Terms of <em>Service</em>
        </h1>
        <p className="microprint mt-3" style={{ color: "var(--seal)" }}>
          Draft · pending review by counsel · not yet executed — provided so the
          terms you are asked to accept are readable in full.
        </p>
        <div className="mt-8">
          <DisclaimerStamp text={CONSENT_DISCLAIMER} />
        </div>
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
