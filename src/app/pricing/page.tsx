import { redirect } from "next/navigation";

// Subscription/fee-schedule pricing retired in favour of the prepaid token
// economy (Library Procedure 2). The canonical pricing surface is now the
// token ledger at /billing — this route permanently redirects there so the
// old /pricing links (homepage, FAQ) keep working with no dead copy.
export default function PricingPage() {
  redirect("/billing");
}
