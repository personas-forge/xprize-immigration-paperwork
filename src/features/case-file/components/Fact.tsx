/**
 * One labelled fact cell in a case-file masthead grid (`<Fact label value />`).
 * Shared so the case-detail masthead and the dashboard masthead render the
 * petitioner facts identically — a restyle (padding, type scale, the border
 * treatment) lives in one place instead of drifting across two files.
 */
export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-4 py-4">
      <div className="microprint">{label}</div>
      <div className="mt-2 doc-number text-[16px] text-foreground">{value}</div>
    </div>
  );
}
