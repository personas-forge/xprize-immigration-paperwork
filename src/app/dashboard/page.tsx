import { DashboardView } from "@/features/dashboard/DashboardView";
import { requireOnboardedUser } from "@/lib/auth/session";
import { canReviewQueue } from "@/lib/auth/roles";
import { getBalance } from "@/lib/tokens/ledger";
import { getCasesForUser } from "@/lib/data/petitions";
import { isStoreConfigured } from "@/lib/db/config";
import { type SavedCaseSummary } from "@/features/case-file/types";

// Node runtime — getBalance() / requireOnboardedUser() read the Store.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Decouple the case-list load from the metering bypass (a user's real cases
  // must show even under TOKENS_BYPASS=1): resolve the user + their cases whenever
  // PERSISTENCE exists (dev-auth or Firebase). Only the balance pill depends on the
  // economy actually being enforced — it reads "∞" (null) under bypass / no store.
  const storeConfigured = isStoreConfigured();
  const economyEnforced = storeConfigured && process.env.TOKENS_BYPASS !== "1";
  let balance: number | null = null;
  let cases: SavedCaseSummary[] = [];
  let showReviewQueue = false;
  if (storeConfigured) {
    const { user } = await requireOnboardedUser();
    // Surface the review-queue nav to anyone who can actually view it — the
    // attorney of record OR a read-only ops/case-manager (both fail-closed).
    showReviewQueue = canReviewQueue(user.email);
    // The user's real, persisted cases (from the qualification flow). Empty in
    // the keyless/no-DB demo, where only the mock case file shows.
    cases = (await getCasesForUser(user.id)).map((c) => ({
      id: c.id,
      fileNumber: c.fileNumber,
      petitioner: c.petitioner,
      classification: c.classification,
      status: c.status,
      approvalLikelihood: c.approvalLikelihood,
      submittedAt: c.updatedAt,
    }));
    // Balance only when the economy is enforced; otherwise the pill shows "∞".
    if (economyEnforced) balance = await getBalance(user.id);
  }
  return <DashboardView balance={balance} cases={cases} canReviewQueue={showReviewQueue} />;
}
