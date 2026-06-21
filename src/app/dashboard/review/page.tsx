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
        // QUEUE-AGE CONTRACT (recorded — prior decision UAT 2026-06-20 F3): the SLA
        // clock is "time since this case last ENTERED review", which is exactly
        // updated_at here. A case in Attorney Review reached it via the submit
        // transition (which set updated_at) and no transition fires again until the
        // attorney acts (which MOVES it out of the queue); plain notes
        // (addReviewEvent) do NOT bump updated_at. A changes-requested→resubmit
        // therefore intentionally RESTARTS the clock — a re-submitted case is a
        // fresh review request. So updated_at is correct for an in-queue case; it
        // is deliberately NOT a frozen original-submission timestamp.
        submittedAt: c.updatedAt,
      }))}
    />
  );
}
