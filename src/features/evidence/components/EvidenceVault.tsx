"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Badge, Button, Card, CardBody, CardHeader } from "@/components/ui";
import { criteriaNames, summarizeVault } from "@/features/evidence";
import { type ModelSource } from "@/lib/llm/label";
import { refileDocument, removeDocument } from "../actions";

// — Evidence vault ────────────────────────────────────────────────────────────
// Add a document (paste its text / describe it) → it's AI-categorized into one
// of the eight O-1A criteria with an auto-assigned exhibit number and extracted
// facts. The vault shows coverage across the criteria and flags the gaps. The
// disclaimer-bearing categorization runs through /api/evidence/categorize;
// re-file and remove are server actions. (Binary PDF/image OCR via Document AI
// is the env-gated production extension; this works from text either way.)

export interface DocumentView {
  id: string;
  name: string;
  criterion: string;
  exhibit: string;
  status: string;
  facts: string[];
  source: string;
}

interface CategorizeApiResponse {
  criterion: string;
  facts: string[];
  disclaimer: string;
  source: ModelSource;
  document: DocumentView | null;
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
    if (name.trim() === "" || content.trim().length < 20) {
      setError("Name the document and paste or describe its contents.");
      setStatus("error");
      return;
    }
    submitting.current = true;
    setStatus("adding");
    setError(null);
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
      const doc: DocumentView =
        data.document ?? {
          id: crypto.randomUUID(),
          name: name.trim(),
          criterion: data.criterion,
          exhibit: "—",
          status: "Received",
          facts: data.facts,
          source: data.source,
        };
      setDocuments((prev) => [...prev, doc]);
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
            {summary.covered}/{summary.total} criteria covered
          </span>
        </div>
      </CardHeader>

      <CardBody className="space-y-5">
        {/* Add a document */}
        <div className="space-y-3 rounded-control border border-border-strong bg-surface px-4 py-3">
          <div className="grid grid-cols-1 gap-3">
            <label className="block">
              <span className="microprint">Document name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. ICML 2024 Best Paper certificate"
                className="mt-1.5 w-full rounded-control border border-border-strong bg-surface px-3 py-2 font-sans text-[14px] text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
              />
            </label>
            <label className="block">
              <span className="microprint">Contents — paste the text or describe the document</span>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={3}
                placeholder="Paste the document text or describe what it shows…"
                className="mt-1.5 w-full resize-y rounded-control border border-border-strong bg-surface px-3 py-2 font-sans text-[13.5px] leading-relaxed text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
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
            <div role="alert" className="rounded-control border border-danger/40 bg-danger-soft/50 px-3 py-2 font-sans text-[13px] text-danger">
              {error}
            </div>
          ) : null}
          {status === "paywall" ? (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-control border-2 border-double border-seal/50 bg-seal-soft/40 px-4 py-3">
              <span className="font-sans text-[13.5px] text-foreground-soft">
                Out of tokens — top up to keep adding evidence.
              </span>
              <Link href="/billing" className="font-mono text-[11px] uppercase tracking-document text-seal ink-link">
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
            Every criterion has at least one exhibit.
          </p>
        )}

        {/* Buckets */}
        <div className="space-y-3">
          {BUCKETS.map((bucket) => {
            const docs = documents.filter((d) => d.criterion === bucket);
            if (bucket === "Unsorted" && docs.length === 0) return null;
            return (
              <div key={bucket} className="rounded-control border border-border px-4 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-sans text-[14px] text-foreground">{bucket}</span>
                  <Badge tone={docs.length > 0 ? "neutral" : "warning"}>
                    {docs.length || "none"}
                  </Badge>
                </div>
                {docs.length === 0 ? (
                  <p className="font-sans text-[13px] italic text-muted-strong">
                    No evidence yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {docs.map((d) => (
                      <li key={d.id} className="border-t border-dotted border-rule pt-2 first:border-t-0 first:pt-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="doc-number text-[11px] text-muted">{d.exhibit}</span>
                              <span className="truncate font-sans text-[13.5px] text-foreground">{d.name}</span>
                            </div>
                            {d.facts.length > 0 ? (
                              <ul className="mt-1 space-y-0.5">
                                {d.facts.map((f, i) => (
                                  <li key={i} className="font-sans text-[12.5px] italic leading-snug text-muted-strong">
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
                              className="rounded-control border border-border-strong bg-surface px-2 py-1 font-mono text-[10px] uppercase tracking-document text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
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
                              className="rounded-control border border-border-strong px-2 py-1 font-mono text-[11px] text-muted-strong hover:border-seal hover:text-seal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
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
