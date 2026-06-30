import { redirect } from "next/navigation";

// Subscription/fee-schedule pricing retired in favour of the prepaid token
// economy (Library Procedure 2). The canonical pricing surface is now the token
// ledger at /billing — this route permanently redirects there. No internal links
// to /pricing remain (the homepage and FAQ link /billing directly; the sitemap
// lists /billing). Retained only as a permanent redirect for old external /
// bookmark / SEO traffic.
export default function PricingPage() {
  redirect("/billing");
}
