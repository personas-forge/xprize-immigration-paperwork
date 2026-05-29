import { DashboardView } from "@/features/dashboard/DashboardView";
import { requireOnboardedUser } from "@/lib/auth/session";
import { getBalance } from "@/lib/tokens/ledger";

// Node runtime — getBalance() / requireOnboardedUser() use `pg`.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // The token balance for the header pill. "∞" (null) when the economy isn't
  // enforced — no auth/DB or TOKENS_BYPASS=1 — matching the guard's free pass.
  const bypass = process.env.TOKENS_BYPASS === "1" || !process.env.DATABASE_URL;
  let balance: number | null = null;
  if (!bypass) {
    const { user } = await requireOnboardedUser();
    balance = await getBalance(user.id);
  }
  return <DashboardView balance={balance} />;
}
