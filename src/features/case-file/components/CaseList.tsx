"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardBody, CardHeader, Skeleton } from "@/components/ui";
import { getCases } from "@/lib/data";
import {
  type CaseStatus,
  type PetitionCase,
  type VisaClassification,
} from "../types";
import { type CaseSortKey, queryCases } from "../case-list";
import { casesToCsv } from "../export";
import { usePersistentQuery } from "../usePersistentQuery";

// — Case-list view ───────────────────────────────────────────────────────────
// Search + filter (classification, status) + sort over the case portfolio.
// Filters persist via localStorage. Export to CSV (download) or print-friendly
// view. Loading / empty / error states throughout. All query logic is the pure
// `queryCases`; this component is a thin renderer.

type LoadState = "loading" | "ready" | "error";

const CLASSIFICATIONS: readonly (VisaClassification | "all")[] = [
  "all",
  "O-1A",
  "O-1B",
  "EB-1A",
];
const STATUSES: readonly (CaseStatus | "all")[] = [
  "all",
  "Intake",
  "Drafting",
  "Attorney Review",
  "Filed",
  "Approved",
];
const SORTS: readonly { key: CaseSortKey; label: string }[] = [
  { key: "targetDate", label: "Target file date" },
  { key: "fileNumber", label: "File number" },
  { key: "likelihood", label: "Approval likelihood" },
  { key: "status", label: "Status" },
];

function statusTone(status: CaseStatus) {
  if (status === "Approved") return "success" as const;
  if (status === "Filed") return "accent" as const;
  if (status === "Intake") return "warning" as const;
  return "neutral" as const;
}

export function CaseList() {
  const [cases, setCases] = useState<readonly PetitionCase[] | null>(null);
  const [load, setLoad] = useState<LoadState>("loading");
  const { query, setQuery, reset } = usePersistentQuery();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    getCases()
      .then((list) => {
        if (!active) return;
        setCases(list);
        setLoad("ready");
      })
      .catch(() => {
        if (active) setLoad("error");
      });
    return () => {
      active = false;
    };
  }, []);

  const visible = useMemo(
    () => (cases ? queryCases(cases, query) : []),
    [cases, query],
  );

  function exportCsv() {
    const csv = casesToCsv(visible);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "petition-cases.csv";
    // Attach before click (a detached-anchor click is non-standard and fails in
    // Firefox/Safari) and revoke in finally so the Blob URL is freed even if
    // click() throws.
    document.body.appendChild(a);
    try {
      a.click();
    } finally {
      a.remove();
      URL.revokeObjectURL(url);
    }
  }

  const filtersActive =
    query.search !== "" ||
    query.classification !== "all" ||
    query.status !== "all";

  return (
    <Card className="overflow-hidden" id="case-list">
      <CardHeader className="bg-surface-muted/60">
        <div>
          <div className="microprint" style={{ color: "var(--accent-dark)" }}>
            § VI — Case portfolio
          </div>
          <div className="display mt-1 text-[18px]">
            {load === "ready" ? `${visible.length} of ${cases?.length ?? 0}` : "—"}
            <span className="font-sans text-[15px] italic text-muted-strong">
              {" "}petition files
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button size="sm" variant="secondary" onClick={() => window.print()}>
            Print
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={exportCsv}
            disabled={load !== "ready" || visible.length === 0}
          >
            Export CSV
          </Button>
        </div>
      </CardHeader>

      <CardBody className="space-y-4">
        {/* Controls */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12 print:hidden">
          <input
            type="search"
            value={query.search}
            onChange={(e) => setQuery({ search: e.target.value })}
            placeholder="Search petitioner, file №, attorney…"
            aria-label="Search cases"
            className="md:col-span-5 rounded-control border border-border-strong bg-surface px-3 py-2 font-sans text-[16px] text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]"
          />
          <select
            value={query.classification}
            onChange={(e) =>
              setQuery({ classification: e.target.value as VisaClassification | "all" })
            }
            aria-label="Filter by classification"
            className="md:col-span-2 rounded-control border border-border-strong bg-surface px-3 py-2 font-sans text-[16px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]"
          >
            {CLASSIFICATIONS.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "All visas" : c}
              </option>
            ))}
          </select>
          <select
            value={query.status}
            onChange={(e) => setQuery({ status: e.target.value as CaseStatus | "all" })}
            aria-label="Filter by status"
            className="md:col-span-3 rounded-control border border-border-strong bg-surface px-3 py-2 font-sans text-[16px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All statuses" : s}
              </option>
            ))}
          </select>
          <select
            value={query.sortKey}
            onChange={(e) => setQuery({ sortKey: e.target.value as CaseSortKey })}
            aria-label="Sort by"
            className="md:col-span-2 rounded-control border border-border-strong bg-surface px-3 py-2 font-sans text-[16px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between print:hidden">
          <button
            type="button"
            onClick={() =>
              setQuery({ sortDir: query.sortDir === "asc" ? "desc" : "asc" })
            }
            className="microprint inline-flex items-center gap-1.5 text-muted-strong hover:text-foreground"
            aria-label="Toggle sort direction"
          >
            {query.sortDir === "asc" ? "Ascending ↑" : "Descending ↓"}
          </button>
          {filtersActive ? (
            <button
              type="button"
              onClick={reset}
              className="microprint text-muted-strong hover:text-foreground"
            >
              Clear filters ×
            </button>
          ) : null}
        </div>

        {/* States */}
        {load === "loading" ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : load === "error" ? (
          <div
            role="alert"
            className="rounded-control border border-danger/40 bg-danger-soft/50 px-4 py-6 text-center font-sans text-[16px] text-danger"
          >
            Could not load cases. Please refresh.
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-control border border-dashed border-border-strong px-4 py-10 text-center">
            <p className="font-sans text-[17px] italic text-muted-strong">
              No cases match these filters.
            </p>
            {filtersActive ? (
              <Button size="sm" variant="secondary" className="mt-4" onClick={reset}>
                Clear filters
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead className="bg-background-tint/40 text-left">
                <tr>
                  <th className="px-4 py-2.5 microprint font-medium">File №</th>
                  <th className="px-4 py-2.5 microprint font-medium">Petitioner</th>
                  <th className="px-4 py-2.5 microprint font-medium">Visa</th>
                  <th className="px-4 py-2.5 microprint font-medium">Status</th>
                  <th className="px-4 py-2.5 microprint text-right font-medium">
                    Likelihood
                  </th>
                  <th className="px-4 py-2.5 microprint text-right font-medium">
                    Target file
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/dashboard/cases/${c.id}`)}
                    className="cursor-pointer border-t border-dotted border-rule transition-[background-color] duration-200 hover:bg-accent-soft/35"
                  >
                    <td className="px-4 py-3 doc-number text-[14px] text-foreground">
                      <Link
                        href={`/dashboard/cases/${c.id}`}
                        className="hover:underline focus-visible:underline focus-visible:outline-none"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.fileNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-sans text-[16px] text-foreground">
                      {c.petitioner}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="neutral">{c.classification}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right doc-number text-[14px] text-foreground">
                      {c.approvalLikelihood}%
                    </td>
                    <td className="px-4 py-3 text-right font-sans text-[15px] text-muted-strong">
                      {c.targetFileDate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
