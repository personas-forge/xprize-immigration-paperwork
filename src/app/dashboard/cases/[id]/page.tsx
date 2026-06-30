import { notFound } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/session";
import { isConfiguredAttorney } from "@/lib/auth/roles";
import { getBalance } from "@/lib/tokens/ledger";
import {
  getCriteriaForCase,
  getLatestDraft,
  getLatestRfeResponse,
} from "@/lib/data/petitions";
import { petitions } from "@/lib/data/adapters/petition";
import { getReviewEvents } from "@/lib/data/reviews";
import { getCaseDocuments } from "@/lib/data/evidence";
import { asModelSource } from "@/lib/llm/label";
import { CaseDetailView } from "@/features/case-file/components/CaseDetailView";

// Real, user-scoped petition case detail. The owner sees their own case; an
// attorney of record (ATTORNEY_EMAILS) can open any case to review, sign, and
// file it. DB + auth required — these cases don't exist in the keyless build.

// Node runtime — requireOnboardedUser() / getBalance() / the data layer use `pg`.

function formatWhen(value: unknown): string {
  const d = new Date(value as string | number | Date);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await requireOnboardedUser();

  // Cross-tenant read + the attorney affordances fail closed through the single
  // resolveCase gate (ADR-0010): the owner, or a CONFIGURED attorney
  // (ATTORNEY_EMAILS) for a case they don't own. Routing through the adapter —
  // instead of re-inlining the owner-or-attorney expression here — means this
  // last inline copy of the gate can't drift from the one the API routes and
  // server actions use (the drift that would reopen the closed cross-tenant
  // IDOR class). isAttorney here would let anyone load any applicant's case by
  // guessing its id; resolveCase uses the strict isConfiguredAttorney leg.
  const gate = await petitions.resolveCase({ userId: user.id, email: user.email ?? null }, id);
  if (!gate.ok) {
    // not-found / forbidden → 404 (never reveal a case exists to a non-owner);
    // a store fault surfaces to the dashboard error boundary, not a masked 404.
    if (gate.error.kind === "forbidden" || gate.error.kind === "not_found") notFound();
    throw new Error(`case-detail unavailable: ${gate.error.kind}`);
  }
  const stored = gate.value;

  // isOwner drives owner-only UI; StoredCase carries no owner field, so re-resolve
  // owner-only via the adapter's `isCaseOwner` (the same gate review/actions.ts
  // uses). `attorney` drives the sign/file affordances and must stay
  // isConfiguredAttorney.
  const isOwner = await petitions.isCaseOwner(user.id, id);
  const attorney = isConfiguredAttorney(user.email);

  const [criteria, draft, balance, events, rfe, documents] = await Promise.all([
    getCriteriaForCase(id),
    getLatestDraft(id),
    getBalance(user.id),
    getReviewEvents(id),
    getLatestRfeResponse(id),
    getCaseDocuments(id),
  ]);

  return (
    <CaseDetailView
      caseId={stored.id}
      fileNumber={stored.fileNumber}
      petitioner={stored.petitioner}
      classification={stored.classification}
      status={stored.status}
      likelihood={stored.approvalLikelihood}
      receiptNumber={stored.receiptNumber}
      isAttorney={attorney}
      isOwner={isOwner}
      criteria={criteria.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        evidence: c.evidence,
        rationale: c.rationale,
      }))}
      initialSections={draft?.sections ?? null}
      initialSource={asModelSource(draft?.source)}
      events={events.map((ev) => ({
        id: ev.id,
        authorRole: ev.authorRole,
        kind: ev.kind,
        body: ev.body,
        when: formatWhen(ev.createdAt),
        demo: ev.metadata?.demo === true,
      }))}
      rfeInitialSections={rfe?.sections ?? null}
      rfeInitialText={rfe?.rfeText ?? ""}
      rfeInitialSource={asModelSource(rfe?.source)}
      documents={documents.map((d) => ({
        id: d.id,
        name: d.name,
        criterion: d.criterion,
        exhibit: d.exhibit,
        status: d.status,
        facts: d.facts,
        source: d.source,
      }))}
      balance={balance}
    />
  );
}
