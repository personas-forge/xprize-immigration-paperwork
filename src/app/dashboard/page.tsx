import { DashboardView } from "@/features/dashboard/DashboardView";
import { requireOnboardedUser } from "@/lib/auth/session";
import { isAttorney } from "@/lib/auth/roles";
import { getBalance } from "@/lib/tokens/ledger";
import { getCasesForUser } from "@/lib/data/petitions";
import { isStoreConfigured } from "@/lib/db/config";
import { type SavedCaseSummary } from "@/features/case-file/types";

// Node runtime — getBalance() / requireOnboardedUser() read the Store.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // The token balance for the header pill. "∞" (null) when the economy isn't
  // enforced — no store or TOKENS_BYPASS=1 — matching the guard's free pass.
  const bypass = process.env.TOKENS_BYPASS === "1" || !isStoreConfigured();
  let balance: number | null = null;
  let cases: SavedCaseSummary[] = [];
  let attorney = false;
  if (!bypass) {
    const { user } = await requireOnboardedUser();
    balance = await getBalance(user.id);
    attorney = isAttorney(user.email);
    // The user's real, persisted cases (from the qualification flow). Empty in
    // the keyless/no-DB demo, where only the mock case file shows.
    cases = [...(await getCasesForUser(user.id))];
  }
  return <DashboardView balance={balance} cases={cases} isAttorney={attorney} />;
}
