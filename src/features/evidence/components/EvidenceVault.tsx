"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Badge, Button, Card, CardBody, CardHeader } from "@/components/ui";
import { DisclaimerStamp } from "@/components/legal";
import { DISCLAIMER } from "@/lib/result";
import {
  criteriaNames,
  summarizeVault,
  MAX_NAME,
  MIN_CONTENT,
  MAX_CONTENT,
} from "@/features/evidence";
import { type StoredDocument } from "@/features/evidence/types";
import { type ModelSource } from "@/lib/llm/label";
import { refileDocument, removeDocument } from "../actions";

// — Evidence vault ────────────────────────────────────────────────────────────
// Add a document (paste its text / describe it) → it's AI-categorized into the
// case's criteria pack with an auto-assigned exhibit number and extracted
// facts. The vault shows coverage across the criteria and flags the gaps. The
// disclaimer-bearing categorization runs through /api/evidence/categorize;
// re-file and remove are server actions. (Binary PDF/image OCR via Document AI
// is the env-gated production extension; this works from text either way.)

// The client view of a vault document is exactly the stored shape (the
// server-only boundary is on the accessors, not the type). Alias kept so
// existing `DocumentView` importers (CaseDetailView) are unchanged.
export type DocumentView = StoredDocument;

interface CategorizeApiResponse {
  criterion: string;
  facts: string[];
  disclaimer: string;
  source: ModelSource;
  document: DocumentView | null;
  /** True when a caseId was supplied but the document could not be saved
   *  (forbidden / store fault) — distinct from the no-case keyless null. */
  saveFailed?: boolean;
}

type AddStatus = "idle" | "adding" | "error" | "paywall";

export function EvidenceVault({
  caseId,
  classification = "O-1A",
  initialDocuments,
}: {
  caseId: string;
  classification?: string;
  initialDocuments: readonly DocumentView[];
}) {
  const [documents, setDocuments] = useState<DocumentView[]>([...initialDocuments]);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<AddStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  // Non-fatal: the doc was categorized but couldn't be saved to the case.
  const [warning, setWarning] = useState<string | null>(null);
  // SR announcement of categorize progress/result (the visual bar is aria-hidden).
  const [announce, setAnnounce] = useState("");
  const [, startTransition] = useTransition();
  // Synchronous re-entrancy guard: `disabled={status === "adding"}` only blocks
  // the button AFTER the next render, so a rapid double-click could fire two
  // concurrent add() calls (charged twice + duplicate exhibit). A ref flips
  // immediately, before any await.
  const submitting = useRef(false);

  const BUCKETS: readonly string[] = [...criteriaNames(classification), "Unsorted"];
  const summary = summarizeVault(documents, classification);

  async function add() {
    if (submitting.current) return; // a request is already in flight
    if (name.trim() === "" || content.trim().length < MIN_CONTENT) {
      setError("Name the document and paste or describe its contents.");
      setStatus("error");
      return;
    }
    submitting.current = true;
    setStatus("adding");
    setError(null);
    setWarning(null);
    setAnnounce("Categorizing the document…");
    try {
      const res = await fetch("/api/evidence/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, name, content, classification }),
      });
      if (res.status === 402) {
        setStatus("paywall");
        return;
      }
      const data = (await res.json()) as CategorizeApiResponse | { error: string };
      if (!res.ok || "error" in data) {
        setError("error" in data ? data.error : "Could not categorize the document.");
        setStatus("error");
        return;
      }
      // Optimistic exhibit ordinal when persistence is skipped (no store): keep
      // the index MONOTONIC instead of rendering "—" (UAT 2026-06-20 F9).
      const nextOrdinal =
        documents.reduce((max, d) => {
          const n = parseInt(String(d.exhibit).replace(/\D/g, ""), 10);
          return Number.isFinite(n) ? Math.max(max, n) : max;
        }, 0) + 1;
      // Mirror the persisted "Ex. N" format the stores assign (pglite/firestore
      // `Ex. ${ord}`) so an optimistic exhibit doesn't read as a bare "2" beside
      // saved "Ex. 2" siblings (evidence #2).
      const nextExhibit = `Ex. ${nextOrdinal}`;
      const doc: DocumentView =
        data.document ?? {
          id: crypto.randomUUID(),
          name: name.trim(),
          criterion: data.criterion,
          exhibit: nextExhibit,
          status: "Received",
          facts: data.facts,
          source: data.source,
        };
      setDocuments((prev) => [...prev, doc]);
      setAnnounce(`Document categorized under ${doc.criterion}, exhibit ${doc.exhibit}.`);
      // A case-backed save that failed: the categorization is shown, but warn
      // that it didn't persist (the user was charged) so it isn't mistaken for
      // a saved exhibit that will vanish on reload.
      if (data.saveFailed) {
        setWarning(
          "Categorized, but we couldn't save this to your case — it won't persist after a reload. Please try again.",
        );
      }
      setName("");
      setContent("");
      setStatus("idle");
    } catch {
      setError("Network error — please try again.");
      setStatus("error");
    } finally {
      submitting.current = false;
    }
  }

  function onRemove(id: string) {
    // Removal is irreversible and BURNS the exhibit number (a consumed high-water
    // mark — re-adding gets a new, higher ordinal), so confirm before deleting.
    const doc = documents.find((d) => d.id === id);
    const label = doc ? `"${doc.name}" (exhibit ${doc.exhibit})` : "this document";
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Remove ${label}? Its exhibit number can't be reused.`)
    ) {
      return;
    }
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    startTransition(() => {
      void removeDocument(caseId, id);
    });
  }

  function onRefile(id: string, criterion: string) {
    setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, criterion } : d)));
    startTransition(() => {
      void refileDocument(caseId, id, criterion);
    });
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-surface-muted/60">
        <div className="microprint" style={{ color: "var(--accent-dark)" }}>
          § III — Evidence vault
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex w-36 gap-0.5" aria-hidden>
            {Array.from({ length: summary.total }).map((_, i) => (
              <span
                key={i}
                className={`h-2 flex-1 rounded-full transition-all duration-500 ${
                  i < summary.covered ? "bg-success" : "bg-warning/40"
                }`}
              />
            ))}
          </div>
          <span className="microprint" style={{ color: "var(--muted)" }}>
            {summary.covered}/{summary.total} criteria with evidence on file
          </span>
        </div>
      </CardHeader>

      <CardBody className="space-y-5">
        {/* UPL safeguard on the surface itself — a forwarded vault screenshot
            must carry the not-legal-advice stamp (the categorize payload does too). */}
        <DisclaimerStamp text={DISCLAIMER} />
        {/* SR announcement for the categorize flow — the progress bar is
            aria-hidden, so without this the AI categorization is silent to AT. */}
        <div role="status" aria-live="polite" className="sr-only">
          {announce}
        </div>
        {/* Add a document */}
        <div className="space-y-3 rounded-control border border-border-strong bg-surface px-4 py-3">
          <div className="grid grid-cols-1 gap-3">
            <label className="block">
              <span className="microprint">Document name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={MAX_NAME}
                placeholder="e.g. ICML 2024 Best Paper certificate"
                className="mt-1.5 w-full rounded-control border border-border-strong bg-surface px-3 py-2 font-sans text-[16px] text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]"
              />
            </label>
            <label className="block">
              <span className="microprint flex items-baseline justify-between gap-2">
                <span>Contents — paste the text or describe the document</span>
                {/* Decorative counter; maxLength enforces the cap (AT announces it).
                    Below the minimum it nudges toward the server's MIN_CONTENT rule. */}
                <span aria-hidden style={{ color: "var(--muted)" }}>
                  {content.trim().length < MIN_CONTENT
                    ? `${MIN_CONTENT}+ chars`
                    : `${content.length} / ${MAX_CONTENT}`}
                </span>
              </span>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={3}
                maxLength={MAX_CONTENT}
                placeholder="Paste the document text or describe what it shows…"
                className="mt-1.5 w-full resize-y rounded-control border border-border-strong bg-surface px-3 py-2 font-sans text-[15.5px] leading-relaxed text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="primary" onClick={add} disabled={status === "adding"}>
              {status === "adding" ? "Categorizing…" : "Add & categorize"}
            </Button>
            <span className="microprint" style={{ color: "var(--muted)" }}>
              Uses 1 token · PDF/image OCR via Document AI is coming
            </span>
          </div>
          {status === "error" && error ? (
            <div role="alert" className="rounded-control border border-danger/40 bg-danger-soft/50 px-3 py-2 font-sans text-[15px] text-danger">
              {error}
            </div>
          ) : null}
          {warning ? (
            <div role="status" className="rounded-control border border-warning/40 bg-warning-soft/50 px-3 py-2 font-sans text-[15px] text-warning">
              {warning}
            </div>
          ) : null}
          {status === "paywall" ? (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-control border-2 border-double border-seal/50 bg-seal-soft/40 px-4 py-3">
              <span className="font-sans text-[15.5px] text-foreground-soft">
                Out of tokens — top up to keep adding evidence.
              </span>
              <Link href="/billing" className="font-mono text-[13px] uppercase tracking-document text-seal ink-link">
                Buy more →
              </Link>
            </div>
          ) : null}
        </div>

        {/* Gaps */}
        {summary.gaps.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="microprint" style={{ color: "var(--accent-dark)" }}>
              Gaps:
            </span>
            {summary.gaps.map((g) => (
              <Badge key={g} tone="warning">
                {g}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="microprint" style={{ color: "var(--success)" }}>
            Every criterion has at least one exhibit on file.
          </p>
        )}

        {/* Honest coverage framing (dc-evidence-02): documents present is not the
            same as a criterion proven, and refile is a manual move, not a re-check. */}
        <p className="microprint" style={{ color: "var(--muted)" }}>
          Evidence on file means documents are present — not that a criterion is proven; your
          attorney of record verifies each. Refiling moves a document to another bucket without
          re-checking its fit.
        </p>

        {/* Buckets */}
        <div className="space-y-3">
          {BUCKETS.map((bucket) => {
            const docs = documents.filter((d) => d.criterion === bucket);
            if (bucket === "Unsorted" && docs.length === 0) return null;
            return (
              <div key={bucket} className="rounded-control border border-border px-4 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-sans text-[16px] text-foreground">{bucket}</span>
                  <Badge tone={docs.length > 0 ? "neutral" : "warning"}>
                    {docs.length || "none"}
                  </Badge>
                </div>
                {docs.length === 0 ? (
                  <p className="font-sans text-[15px] italic text-muted-strong">
                    No evidence yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {docs.map((d) => (
                      <li key={d.id} className="border-t border-dotted border-rule pt-2 first:border-t-0 first:pt-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="doc-number text-[13px] text-muted">{d.exhibit}</span>
                              <span className="truncate font-sans text-[15.5px] text-foreground">{d.name}</span>
                            </div>
                            {d.facts.length > 0 ? (
                              <ul className="mt-1 space-y-0.5">
                                {d.facts.map((f, i) => (
                                  <li key={i} className="font-sans text-[14.5px] italic leading-snug text-muted-strong">
                                    — {f}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <label className="sr-only" htmlFor={`refile-${d.id}`}>
                              Re-file {d.name}
                            </label>
                            <select
                              id={`refile-${d.id}`}
                              value={d.criterion}
                              onChange={(e) => onRefile(d.id, e.target.value)}
                              className="rounded-control border border-border-strong bg-surface px-2 py-1 font-mono text-[12px] uppercase tracking-document text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]"
                            >
                              {BUCKETS.map((b) => (
                                <option key={b} value={b}>
                                  {b}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => onRemove(d.id)}
                              aria-label={`Remove ${d.name}`}
                              className="rounded-control border border-border-strong px-2 py-1 font-mono text-[13px] text-muted-strong hover:border-seal hover:text-seal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
