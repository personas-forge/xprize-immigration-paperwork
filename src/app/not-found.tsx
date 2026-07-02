import Link from "next/link";
import { PageFrame } from "@/components/brand/PageFrame";
import { buttonClasses } from "@/components/ui";

// Root 404 — reached by bad URLs AND by every notFound() in the app: an
// expired/garbled /c/[token] share link (a PUBLIC surface people paste into
// chats), an unknown /visa page, a case the viewer doesn't own (the
// existence-hiding 404). Copy stays neutral about WHY so the access-denied
// case leaks nothing.
export default function NotFound() {
  return (
    <PageFrame>
      <main className="grid min-h-screen place-items-center px-8 py-20">
        <div className="max-w-md text-center">
          <div className="microprint" style={{ color: "var(--accent-dark)" }}>
            § 404 — No such record
          </div>
          <h1 className="display mt-4 text-[clamp(1.8rem,4vw,2.6rem)]">
            This page is not <em>on file</em>.
          </h1>
          <p className="mt-4 font-sans text-[17px] leading-relaxed text-muted-strong">
            The address may be mistyped, the link may have expired, or the
            record it pointed to is not available. Nothing has been changed.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/" className={buttonClasses("primary")}>
              Back to home
            </Link>
            <Link href="/qualify" className={buttonClasses("secondary")}>
              Check your eligibility
            </Link>
          </div>
        </div>
      </main>
    </PageFrame>
  );
}
