import type { Metadata } from "next";
import { PageFrame, ChapterMark, Seal } from "@/components/brand";
import { Rise } from "@/components/Motion";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { getUser } from "@/lib/auth/session";
import { getBalance } from "@/lib/tokens/ledger";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { isDevAuth } from "@/lib/auth/devAuth";
import { isMeteringEnforced } from "@/lib/db/config";
import { BUNDLES, ENTERPRISE_CONTACT, FREE_SIGNUP_GRANT } from "@/lib/tokens/economy";
import { costOf, labelOf, type OperationKey } from "@/lib/tokens/registry";
import { BundleGrid } from "./BundleGrid";
import { PurchaseToast } from "./PurchaseToast";

export const metadata: Metadata = {
  title: "Token ledger — Immigration Concierge",
  description:
    "Prepaid tokens fund the AI drafting tools — qualification, petition drafting, evidence categorization, RFE responses. Top up with a bundle — bigger bundles cost less per token. Enterprise is contact-only.",
};

// "What a token buys" — driven from the OperationRegistry so the per-op prices on
// this page can never drift from what the metering actually charges (registry.ts
// is the single source of truth). Order: cheapest job to the premium full draft.
const PER_OP_COSTS: OperationKey[] = [
  "categorize",
  "qualify",
  "draft_section",
  "rfe",
  "draft",
];

// Node runtime — getBalance() uses `pg`.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// — Billing — prepaid token ledger + bundles ─────────────────────────────────
// Replaces the old subscription pricing. A balance "ledger entry" up top, the
// four prepaid bundles below, then an Enterprise contact band. All colour is
// drawn from CSS theme tokens, so the page re-skins between parchment and ink
// with the header ThemeToggle (no theme-specific markup). When auth/DB isn't
// configured the balance reads "∞" (the guard gives a free, unmetered pass).

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const purchaseSuccess = (await searchParams).status === "success";
  const user = isFirebaseConfigured() || isDevAuth() ? await getUser() : null;
  // "∞" when the token economy isn't enforced (the guard free-passes). Use the
  // canonical isMeteringEnforced() — NOT a raw DATABASE_URL read, which would
  // wrongly show "∞" on Firestore prod (no DATABASE_URL) while the guard charges.
  const balance =
    user && isMeteringEnforced() ? await getBalance(user.id) : null;
  const balanceLabel = balance === null ? "∞" : balance.toLocaleString();

  return (
    <PageFrame>
      <SiteHeader />

      <section className="mx-auto max-w-6xl px-8 pb-10 pt-20">
        {purchaseSuccess ? <PurchaseToast /> : null}
        <Rise>
          <ChapterMark numeral="IV" label="Token ledger" />
          <h1 className="display mt-5 max-w-3xl text-[clamp(2.4rem,6vw,4.4rem)]">
            Pay for <em>exactly what you use</em>.
          </h1>
          <p className="mt-6 max-w-2xl font-sans text-[16px] leading-relaxed text-muted-strong">
            No subscriptions. Different AI operations cost different amounts — a
            quick screening is a few tokens, a full petition draft more — and you
            keep what you don&apos;t spend. New accounts start with{" "}
            <span className="doc-number text-foreground">{FREE_SIGNUP_GRANT}</span>{" "}
            free tokens. Top up with a bundle below — larger bundles cost less
            per token.
          </p>
        </Rise>

        {/* Balance ledger entry */}
        <Rise className="mt-10">
          <div className="relative overflow-hidden rounded-card border border-border-strong bg-surface px-6 py-5 shadow-leaf guilloche">
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="microprint" style={{ color: "var(--accent-dark)" }}>
                  Current balance
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span
                    className="display text-[2.6rem] text-foreground"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {balanceLabel}
                  </span>
                  <span className="microprint" style={{ color: "var(--muted)" }}>
                    tokens
                  </span>
                </div>
              </div>
              <div className="text-accent-dark">
                <Seal size={44} />
              </div>
            </div>
          </div>
        </Rise>

        {/* Bundles */}
        <Rise className="mt-12">
          <div className="microprint mb-5" style={{ color: "var(--accent-dark)" }}>
            § Bundles — one-time top-up
          </div>
          <BundleGrid bundles={BUNDLES} />
        </Rise>

        {/* Enterprise — contact only */}
        <Rise className="mt-12">
          <div className="relative flex flex-col gap-5 rounded-card border-2 border-double border-seal/40 bg-seal-soft/30 px-7 py-7 shadow-seal sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <div className="microprint" style={{ color: "var(--seal)" }}>
                Enterprise · by arrangement
              </div>
              <h2 className="display mt-2 text-2xl text-foreground">
                High-volume firms &amp; partners
              </h2>
              <p className="mt-2 font-sans text-[16px] leading-relaxed text-muted-strong">
                Premium model tier, custom token limits, SSO, and invoiced
                billing for law firms and institutional partners. We tailor the
                ledger and terms to your caseload.
              </p>
            </div>
            <a
              href={ENTERPRISE_CONTACT}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-control bg-seal px-6 py-3 font-mono text-[14px] uppercase tracking-document text-background transition-[background-color,transform] hover:bg-[color:var(--accent-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)] active:translate-y-[1px]"
            >
              Contact sales
              <span aria-hidden>→</span>
            </a>
          </div>
        </Rise>

        {/* Footnotes */}
        <Rise className="mt-14">
          <div className="perforation h-px" aria-hidden />
          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            <div>
              <div className="microprint" style={{ color: "var(--accent-dark)" }}>
                What a token buys — cost per AI operation
              </div>
              <ul className="mt-2 space-y-1 font-sans text-[15.5px] leading-relaxed text-muted-strong">
                {PER_OP_COSTS.map((op) => (
                  <li key={op} className="flex items-baseline justify-between gap-3 border-b border-dotted border-rule pb-1">
                    <span>{labelOf(op)}</span>
                    <span
                      className="doc-number text-foreground"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {costOf(op)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="microprint mt-2" style={{ color: "var(--muted)" }}>
                Prepaid credits — non-transferable, no cash-out.
              </p>
            </div>
            <Footnote
              eyebrow="Not legal advice"
              body="AI drafting is general information only, never legal advice — we're a drafting tool, not a law firm. Your own attorney of record must review and sign your petition before anything is filed with USCIS."
            />
            <Footnote
              eyebrow="Refunds"
              body="Purchased tokens may be reversed on a refund or chargeback. The free signup grant is one per account."
            />
          </div>
        </Rise>
      </section>

      <SiteFooter />
    </PageFrame>
  );
}

/* ── Components ────────────────────────────────────────────────────────── */

function Footnote({ eyebrow, body }: { eyebrow: string; body: string }) {
  return (
    <div>
      <div className="microprint" style={{ color: "var(--accent-dark)" }}>
        {eyebrow}
      </div>
      <p className="mt-2 font-sans text-[15.5px] leading-relaxed text-muted-strong">
        {body}
      </p>
    </div>
  );
}

