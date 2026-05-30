import { requireOnboardedUser } from "@/lib/auth/session";
import { isAttorney } from "@/lib/auth/roles";
import { getBalance } from "@/lib/tokens/ledger";
import { getCasesInReview } from "@/lib/data/petitions";
import { ReviewQueueView } from "@/features/review/components/ReviewQueueView";

// Attorney-of-record review queue. Lists every case awaiting review; gated by
// ATTORNEY_EMAILS (empty = demo-unlocked). DB + auth required.

export const dynamic = "force-dynamic";

export default async function ReviewQueuePage() {
  const { user } = await requireOnboardedUser();
  const attorney = isAttorney(user.email);

  const [balance, cases] = await Promise.all([
    getBalance(user.id),
    attorney ? getCasesInReview() : Promise.resolve([] as const),
  ]);

  return (
    <ReviewQueueView
      isAttorney={attorney}
      balance={balance}
      cases={cases.map((c) => ({
        id: c.id,
        fileNumber: c.fileNumber,
        petitioner: c.petitioner,
        classification: c.classification,
        status: c.status,
        approvalLikelihood: c.approvalLikelihood,
      }))}
    />
  );
}
