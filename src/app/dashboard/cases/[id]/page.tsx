import { notFound } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/session";
import { isConfiguredAttorney } from "@/lib/auth/roles";
import { getBalance } from "@/lib/tokens/ledger";
import {
  getCaseAnyOwner,
  getCaseForUser,
  getCriteriaForCase,
  getLatestDraft,
  getLatestRfeResponse,
} from "@/lib/data/petitions";
import { getReviewEvents } from "@/lib/data/reviews";
import { getCaseDocuments } from "@/lib/data/evidence";
import { asModelSource } from "@/lib/llm/label";
import { CaseDetailView } from "@/features/case-file/components/CaseDetailView";

// Real, user-scoped petition case detail. The owner sees their own case; an
// attorney of record (ATTORNEY_EMAILS) can open any case to review, sign, and
// file it. DB + auth required — these cases don't exist in the keyless build.

// Node runtime — requireOnboardedUser() / getBalance() / the data layer use `pg`.
export const dynamic = "force-dynamic";

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
  // Cross-tenant read + the attorney affordances must fail closed: only a
  // CONFIGURED attorney (ATTORNEY_EMAILS) may open a case they don't own.
  // isAttorney here would let anyone load any applicant's full case by guessing
  // its id, and would show sign/file buttons the server actions now reject.
  const attorney = isConfiguredAttorney(user.email);

  // Owner sees their own case; a configured attorney may open any case.
  const owned = await getCaseForUser(user.id, id);
  const stored = owned ?? (attorney ? await getCaseAnyOwner(id) : null);
  if (!stored) notFound();
  const isOwner = Boolean(owned);

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
