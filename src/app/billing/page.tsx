import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { PageFrame, ChapterMark, Seal } from "@/components/brand";
import { Rise } from "@/components/Motion";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { getUser } from "@/lib/auth/session";
import { getBalance, getLedgerForUser, type LedgerEntry } from "@/lib/tokens/ledger";
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

// — Billing — prepaid token ledger + bundles ─────────────────────────────────
// Replaces the old subscription pricing. A balance "ledger entry" up top, the
// four prepaid bundles below, then an Enterprise contact band. All colour is
// drawn from CSS theme tokens, so the page re-skins between parchment and ink
// with the header ThemeToggle (no theme-specific markup). When auth/DB isn't
// configured the balance reads "∞" (the guard gives a free, unmetered pass).

/** Human label for a ledger row: a debit names its operation; credits name their
 *  reason. Keeps the raw `reason`/`operation` out of the user-facing list. */
function activityLabel(e: LedgerEntry): string {
  switch (e.reason) {
    case "debit":
      // labelOf is total (returns the raw string for an unknown/renamed op), so a
      // stale ledger operation string can't crash this server render — no unsound
      // `as OperationKey` cast needed.
      return e.operation ? labelOf(e.operation) : "AI operation";
    case "purchase":
      return "Token purchase";
    case "reclaim":
      return "Refund — unusable result";
    case "refund":
      return "Refund / chargeback";
    case "signup_grant":
      return "Signup bonus";
    case "adjustment":
      return "Balance adjustment";
    case "enterprise_grant":
      return "Enterprise grant";
    default:
      return e.reason;
  }
}

// Instant Navigations (Next 16.3): server-bound — reads the signed-in user's
// balance/ledger (cookies), so there is no prefetchable static shell. Block.
export const instant = false;

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await connection();
  const purchaseSuccess = (await searchParams).status === "success";
  const authAvailable = isFirebaseConfigured() || isDevAuth();
  const user = authAvailable ? await getUser() : null;
  // "∞" when the token economy isn't enforced (the guard free-passes). Use the
  // canonical isMeteringEnforced() — NOT a raw DATABASE_URL read, which would
  // wrongly show "∞" on Firestore prod (no DATABASE_URL) while the guard charges.
  const metered = user !== null && isMeteringEnforced();
  const [balance, activity] = metered
    ? await Promise.all([getBalance(user!.id), getLedgerForUser(user!.id, 25)])
    : [null, [] as LedgerEntry[]];
  // A SIGNED-OUT visitor on a real (auth-configured) deployment must not read
  // "∞ tokens" next to the "150 free tokens" pitch (visual sweep #3) — that ∞
  // is only honest in the keyless demo, where no one can sign in at all.
  const signedOutOnRealAuth = authAvailable && user === null;
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
                {signedOutOnRealAuth ? (
                  <div className="mt-1">
                    <Link href="/login" className="ink-link font-sans text-[19px] text-foreground focus-ring">
                      Sign in to see your balance →
                    </Link>
                    <p className="microprint mt-1" style={{ color: "var(--muted)" }}>
                      New accounts start with {FREE_SIGNUP_GRANT} free tokens.
                    </p>
                  </div>
                ) : (
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
                )}
              </div>
              <div className="text-accent-dark">
                <Seal size={44} />
              </div>
            </div>
          </div>
        </Rise>

        {/* Recent activity — read back the token_ledger (already records every
            debit/credit/reclaim/refund/grant) so a prepaid user can self-verify
            where their tokens went, instead of only seeing a bare balance. */}
        {activity.length > 0 ? (
          <Rise className="mt-8">
            <div className="microprint mb-3" style={{ color: "var(--accent-dark)" }}>
              § Recent activity
            </div>
            <div className="overflow-hidden rounded-card border border-border-strong bg-surface">
              <ul className="divide-y divide-rule">
                {activity.map((e, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-4 px-5 py-3"
                  >
                    <div>
                      <div className="font-sans text-[15.5px] text-foreground">
                        {activityLabel(e)}
                      </div>
                      <div className="microprint" style={{ color: "var(--muted)" }}>
                        {e.createdAt ? e.createdAt.slice(0, 10) : "—"}
                      </div>
                    </div>
                    <div className="flex items-baseline gap-4">
                      <span
                        className={`doc-number text-[15px] ${e.delta < 0 ? "text-muted-strong" : "text-success"}`}
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {e.delta > 0 ? "+" : ""}
                        {e.delta.toLocaleString()}
                      </span>
                      <span className="microprint" style={{ color: "var(--muted)" }}>
                        bal {e.balanceAfter.toLocaleString()}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Rise>
        ) : null}

        {/* Bundles */}
        <Rise className="mt-12">
          <div className="microprint mb-5" style={{ color: "var(--accent-dark)" }}>
            § Bundles — one-time top-up
          </div>
          <BundleGrid bundles={BUNDLES} />
        </Rise>

        {/* Enterprise — contact only. Rendered ONLY when a real contact target
            is configured: the band's whole value is the CTA, and shipping it
            with a placeholder mailto was a dead-end on the payment page. */}
        {ENTERPRISE_CONTACT && (
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
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-control bg-seal px-6 py-3 font-mono text-[14px] uppercase tracking-document text-background transition-[background-color,transform] hover:bg-[color:var(--accent-dark)] focus-ring active:translate-y-[1px]"
              >
                Contact sales
                <span aria-hidden>→</span>
              </a>
            </div>
          </Rise>
        )}

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

