import { Card, CardBody, Skeleton } from "@/components/ui";

// Route-level loading UI for the attorney review queue. The page is
// `force-dynamic` (a per-request cross-tenant DB read), so without this the
// segment renders BLANK until the data resolves. Mirror the queue's frame — a
// top-bar strip, the heading row, and a few placeholder rows — so the wait reads
// as "this screen is loading" rather than a flash of nothing.
export default function ReviewQueueLoading() {
  return (
    <div aria-busy="true">
      {/* Announce the load to assistive tech (the skeletons are aria-hidden). */}
      <span role="status" aria-live="polite" className="sr-only">
        Loading the review queue…
      </span>

      {/* Top-bar strip */}
      <div className="flex items-center justify-between border-b border-border px-8 py-4">
        <Skeleton className="h-6 w-56" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>

      <div className="px-8 py-10">
        <div className="mx-auto max-w-5xl space-y-8">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-24" />
          </div>

          <Card>
            <CardBody className="space-y-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <div className="min-w-0 space-y-2">
                    <Skeleton className="h-4 w-52" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
