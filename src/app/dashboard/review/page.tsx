import { requireOnboardedUser } from "@/lib/auth/session";
import { isConfiguredAttorney, isConfiguredOps } from "@/lib/auth/roles";
import { getBalance } from "@/lib/tokens/ledger";
import { getCasesInReview } from "@/lib/data/petitions";
import { ReviewQueueView } from "@/features/review/components/ReviewQueueView";

// Attorney-of-record review queue. Lists every case awaiting review — a
// cross-tenant read, so the VIEW is gated by canReviewQueue (fail-closed): an
// attorney (ATTORNEY_EMAILS) OR a read-only ops/case-manager (OPS_EMAILS). Using
// the permissive isAttorney here would let any signed-in user enumerate every
// applicant's case. Sign/file stay isConfiguredAttorney — ops is read-only and
// the rows don't deep-link. DB + auth required.

export const dynamic = "force-dynamic";

export default async function ReviewQueuePage() {
  const { user } = await requireOnboardedUser();
  const attorney = isConfiguredAttorney(user.email);
  const canView = attorney || isConfiguredOps(user.email);

  const [balance, cases] = await Promise.all([
    getBalance(user.id),
    canView ? getCasesInReview() : Promise.resolve([] as const),
  ]);

  return (
    <ReviewQueueView
      isAttorney={attorney}
      canView={canView}
      balance={balance}
      cases={cases.map((c) => ({
        id: c.id,
        fileNumber: c.fileNumber,
        petitioner: c.petitioner,
        classification: c.classification,
        status: c.status,
        approvalLikelihood: c.approvalLikelihood,
        submittedAt: c.updatedAt,
      }))}
    />
  );
}
