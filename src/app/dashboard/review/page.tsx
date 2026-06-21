import { requireOnboardedUser } from "@/lib/auth/session";
import { isConfiguredAttorney, isConfiguredOps } from "@/lib/auth/roles";
import { getBalance } from "@/lib/tokens/ledger";
import { petitions } from "@/lib/data/adapters/petition";
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

  // The cross-tenant gate now lives IN the adapter (listReviewQueue fail-closes
  // unless attorney|ops). `canView` is recomputed only for the view's not-
  // authorized state; the data path can't leak the queue even if it drifted.
  const [balance, queue] = await Promise.all([
    getBalance(user.id),
    petitions.listReviewQueue({ userId: user.id, email: user.email ?? null }),
  ]);
  const cases = queue.ok ? queue.value : [];

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
