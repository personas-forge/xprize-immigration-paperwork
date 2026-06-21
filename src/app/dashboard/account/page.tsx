import type { Metadata } from "next";
import { PageFrame, ChapterMark } from "@/components/brand";
import { Card, CardBody, CardHeader, Badge } from "@/components/ui";
import { Rise } from "@/components/Motion";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { requireOnboardedUser } from "@/lib/auth/session";
import { getConsentHistory } from "@/lib/auth/db";
import { CONSENT_VERSION } from "@/lib/auth/consent";
import { DeleteAccountForm } from "./DeleteAccountForm";
import { MarketingPreferenceForm } from "./MarketingPreferenceForm";

export const metadata: Metadata = {
  title: "Account & data — Immigration Concierge",
  description: "Manage your account: download a copy of your data or delete your account.",
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { user, profile } = await requireOnboardedUser();
  const consents = await getConsentHistory(user.id);
  // History is newest-first, so the latest row carries the current state.
  const consented = consents[0]?.consentVersion ?? null;
  const marketingOptIn = consents[0]?.marketingOptIn ?? false;

  return (
    <PageFrame>
      <SiteHeader />

      <section className="mx-auto max-w-3xl px-6 pb-16 pt-20">
        <Rise>
          <ChapterMark numeral="VII" label="Account & data" />
          <h1 className="display mt-5 text-[clamp(2.2rem,5.5vw,3.6rem)]">
            Your account &amp; <em>your data</em>.
          </h1>
          <p className="mt-6 max-w-2xl font-sans text-[16px] leading-relaxed text-muted-strong">
            Download a complete copy of everything we hold for you, or permanently
            delete your account. Your case data is accessible only to you and the
            attorney of record you designate.
          </p>
        </Rise>

        {/* Profile summary */}
        <Rise className="mt-10">
          <Card>
            <CardHeader>
              <div className="microprint" style={{ color: "var(--accent-dark)" }}>
                § Profile
              </div>
              <Badge tone={consented === CONSENT_VERSION ? "success" : "warning"}>
                {consented === CONSENT_VERSION ? "Consent current" : "Consent outdated"}
              </Badge>
            </CardHeader>
            <CardBody>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                <Field label="Name">{profile.full_name || "—"}</Field>
                <Field label="Email">{user.email || "—"}</Field>
                <Field label="Accepted terms version">{consented ?? "—"}</Field>
                <Field label="Current terms version">{CONSENT_VERSION}</Field>
              </dl>
            </CardBody>
          </Card>
        </Rise>

        {/* Marketing preference */}
        <Rise className="mt-6">
          <Card>
            <CardHeader>
              <div className="microprint" style={{ color: "var(--accent-dark)" }}>
                § Email preferences
              </div>
            </CardHeader>
            <CardBody>
              <MarketingPreferenceForm current={marketingOptIn} />
            </CardBody>
          </Card>
        </Rise>

        {/* Consent history / receipt */}
        <Rise className="mt-6">
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="microprint" style={{ color: "var(--accent-dark)" }}>
                § Consent history
              </div>
              <Badge tone="neutral">{consents.length}</Badge>
            </CardHeader>
            {consents.length === 0 ? (
              <CardBody>
                <p className="font-sans text-[15.5px] italic text-muted-strong">
                  No consent events recorded.
                </p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-rule">
                {consents.map((c, i) => (
                  <li key={i} className="px-5 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-sans text-[15.5px] text-foreground">
                        Version {c.consentVersion}
                      </span>
                      <span className="microprint" style={{ color: "var(--muted)" }}>
                        {c.createdAt ? c.createdAt.slice(0, 10) : "—"}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge tone={c.termsAccepted ? "success" : "neutral"}>
                        Terms {c.termsAccepted ? "✓" : "—"}
                      </Badge>
                      <Badge tone={c.privacyAccepted ? "success" : "neutral"}>
                        Privacy {c.privacyAccepted ? "✓" : "—"}
                      </Badge>
                      <Badge tone={c.marketingOptIn ? "accent" : "neutral"}>
                        Marketing {c.marketingOptIn ? "on" : "off"}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Rise>

        {/* Export */}
        <Rise className="mt-6">
          <Card>
            <CardHeader>
              <div className="microprint" style={{ color: "var(--accent-dark)" }}>
                § Download my data
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <p className="font-sans text-[15.5px] leading-relaxed text-foreground-soft">
                A single JSON file with your profile, consent history, token balance
                and ledger, and every case — its criteria, draft and RFE versions,
                evidence, and the review thread. This is everything we store about you.
              </p>
              <a
                href="/api/me/export"
                download
                className="inline-flex w-fit items-center justify-center gap-2 rounded-control border border-border-strong bg-surface px-5 py-2.5 font-mono text-[14px] uppercase tracking-document text-foreground transition-[background-color] hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]"
              >
                Download my data (.json)
                <span aria-hidden>↓</span>
              </a>
            </CardBody>
          </Card>
        </Rise>

        {/* Danger zone — permanent account deletion */}
        <Rise className="mt-6">
          <Card>
            <CardHeader>
              <div className="microprint" style={{ color: "var(--danger)" }}>
                § Delete account
              </div>
              <Badge tone="danger">Irreversible</Badge>
            </CardHeader>
            <CardBody>
              <DeleteAccountForm />
            </CardBody>
          </Card>
        </Rise>
      </section>

      <SiteFooter />
    </PageFrame>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="microprint" style={{ color: "var(--muted)" }}>
        {label}
      </dt>
      <dd className="mt-0.5 font-sans text-[16px] text-foreground">{children}</dd>
    </div>
  );
}
