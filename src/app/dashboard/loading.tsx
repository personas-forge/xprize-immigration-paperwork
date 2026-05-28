import { Skeleton } from "@/components/ui";

// Route-level loading UI for the dashboard segment. Mirrors the case-file
// layout (masthead + two-column body + portfolio table) so the transition
// into the live view is calm rather than a jump.
export default function DashboardLoading() {
  return (
    <div className="min-h-screen px-8 py-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="space-y-6 lg:col-span-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    </div>
  );
}
