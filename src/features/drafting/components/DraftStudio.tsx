"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, CardBody, CardHeader, Skeleton } from "@/components/ui";
import { DisclaimerStamp } from "@/features/guidance/components/DisclaimerStamp";
import { CitationNote } from "@/features/guidance/components/CitationNote";
import { DISCLAIMER, type DraftSection } from "@/features/drafting";
import { isModelSource, sourceLabel, type ModelSource } from "@/lib/llm/label";
import {
  copyDraftToClipboard,
  retrySaveDraft,
} from "@/features/drafting/saveRecovery";
import {
  SaveFailedAlert,
  type CopyState,
  type RetryState,
} from "./SaveFailedAlert";

/** Minimal criterion shape the studio needs — decoupled from the qualification
 *  module so both the qualify result and a stored case can supply it. */
interface DraftStudioCriterion {
  name: string;
  status: string;
  evidence: string;
  rationale: string;
}

// — Drafting Studio ───────────────────────────────────────────────────────────
// Generates a full O-1A petition letter from the scored criteria, then lets the
// user edit each section inline and regenerate any single section. The
// not-legal-advice disclaimer renders on every output — a draft is work product
// for the attorney of record, never final. Generation costs tokens (full draft
// = 12, single section = 5); a 402 shows the paywall CTA.

type Status = "idle" | "loading" | "done" | "error" | "paywall";

interface DraftApiResponse {
  sections: DraftSection[];
  disclaimer: string;
  source: ModelSource;
  caseId: string | null;
  version: number | null;
  /** True when the draft was charged + generated but the version failed to save. */
  saveFailed?: boolean;
}

interface SectionApiResponse {
  section: DraftSection;
  disclaimer: string;
  source: ModelSource;
  saveFailed?: boolean;
}

export function DraftStudio({
  petitioner,
  classification = "O-1A",
  criteria,
  caseId = null,
  initialSections = null,
  initialSource = "mock",
}: {
  petitioner: string;
  classification?: string;
  criteria: readonly DraftStudioCriterion[];
  caseId?: string | null;
  /** Hydrate with an already-saved draft (case detail view). */
  initialSections?: DraftSection[] | null;
  initialSource?: ModelSource;
}) {
  const hasInitial = Boolean(initialSections && initialSections.length > 0);
  const [status, setStatus] = useState<Status>(hasInitial ? "done" : "idle");
  const [sections, setSections] = useState<DraftSection[]>(initialSections ?? []);
  const [source, setSource] = useState<ModelSource>(initialSource);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [regenerationError, setRegenerationError] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  // saveFailed recovery UI state (SaveFailedAlert). resolvedCaseId tracks the
  // case the SERVER persisted against (response caseId) — the retry must target
  // it, not just the incoming prop.
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [retryState, setRetryState] = useState<RetryState>("idle");
  const [resolvedCaseId, setResolvedCaseId] = useState<string | null>(caseId);
  // Synchronous in-flight guard: a stale-closure `status` check can't stop two
  // clicks in the same render from both firing a paid POST. A ref can.
  const busyRef = useRef(false);

  const payload = {
    petitioner: petitioner || "the beneficiary",
    classification,
    criteria: criteria.map((c) => ({
      name: c.name,
      status: c.status,
      evidence: c.evidence,
      rationale: c.rationale,
    })),
    caseId,
  };

  async function generate() {
    if (busyRef.current) return; // double-submit guard (charges tokens)
    busyRef.current = true;
    setStatus("loading");
    setError(null);
    setRegenerationError(null);
    setSaveFailed(false);
    setCopyState("idle");
    setRetryState("idle");
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 402) {
        setStatus("paywall");
        return;
      }
      const data = (await res.json()) as DraftApiResponse | { error: string };
      if (!res.ok || "error" in data) {
        setError("error" in data ? data.error : "Could not draft the petition.");
        setStatus("error");
        return;
      }
      setSections(data.sections);
      setSource(data.source);
      setSaveFailed(Boolean(data.saveFailed));
      setResolvedCaseId(data.caseId ?? caseId);
      setStatus("done");
    } catch {
      setError("Network error — please try again.");
      setStatus("error");
    } finally {
      busyRef.current = false;
    }
  }

  async function regenerate(heading: string) {
    if (busyRef.current) return; // double-submit guard (charges tokens)
    busyRef.current = true;
    setRegenerating(heading);
    setRegenerationError(null);
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, focus: heading }),
      });
      if (res.status === 402) {
        setStatus("paywall");
        return;
      }
      const data = (await res.json()) as SectionApiResponse | { error: string };
      if (!res.ok || "error" in data) {
        setRegenerationError(heading);
        return;
      }
      setSections((prev) =>
        prev.map((s) => (s.heading === heading ? data.section : s)),
      );
      setSource(data.source);
      setSaveFailed(Boolean(data.saveFailed));
      setCopyState("idle");
      setRetryState("idle");
    } catch {
      setRegenerationError(heading);
    } finally {
      setRegenerating(null);
      busyRef.current = false;
    }
  }

  async function copyDraft() {
    const ok = await copyDraftToClipboard(sections);
    setCopyState(ok ? "copied" : "failed");
  }

  async function retrySave() {
    // Persistence-only retry (/api/draft/save) — never re-generates, so it can
    // never re-charge. Guarded by busyRef like the paid calls so a retry can't
    // race a regenerate that would change `sections` mid-save.
    if (busyRef.current || !resolvedCaseId) return;
    busyRef.current = true;
    setRetryState("saving");
    try {
      const result = await retrySaveDraft({
        caseId: resolvedCaseId,
        sections,
        source,
      });
      if (result.ok) {
        setSaveFailed(false);
        setRetryState("idle");
      } else {
        setRetryState("failed");
      }
    } finally {
      busyRef.current = false;
    }
  }

  function editBody(heading: string, body: string) {
    setRegenerationError(null);
    setSections((prev) => prev.map((s) => (s.heading === heading ? { ...s, body } : s)));
  }

  return (
    <Card>
      <CardHeader>
        <div className="microprint" style={{ color: "var(--accent-dark)" }}>
          § III — Petition draft · attorney work product
        </div>
        {status === "done" ? (
          <Badge tone={isModelSource(source) ? "accent" : "neutral"}>
            {sourceLabel(source)}
          </Badge>
        ) : (
          <Badge tone="accent">AI-assisted</Badge>
        )}
      </CardHeader>
      <CardBody className="space-y-4">
        {status === "idle" || status === "error" ? (
          <div className="space-y-3">
            <p className="font-sans text-[14px] leading-relaxed text-muted-strong">
              Draft a full O-1A petition letter from your scored criteria — an
              introduction, an argument for each qualifying criterion, and a
              conclusion. You can edit any section and regenerate it.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="primary" onClick={generate}>
                Draft the petition
              </Button>
              <span className="microprint" style={{ color: "var(--muted)" }}>
                Uses 12 tokens · attorney must review &amp; sign
              </span>
            </div>
            {status === "error" && error ? (
              <div
                role="alert"
                className="rounded-control border border-danger/40 bg-danger-soft/50 px-4 py-3 font-sans text-[13px] text-danger"
              >
                {error}
              </div>
            ) : null}
          </div>
        ) : null}

        {status === "loading" ? (
          <div className="space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-28" />
            <Skeleton className="h-20" />
          </div>
        ) : null}

        {status === "paywall" ? (
          <div className="space-y-3">
            <DisclaimerStamp text={DISCLAIMER} />
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-control border-2 border-double border-seal/50 bg-seal-soft/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="microprint" style={{ color: "var(--seal)" }}>
                  Out of tokens
                </div>
                <p className="mt-1 font-sans text-[13.5px] leading-snug text-foreground-soft">
                  Drafting a petition needs tokens. Top up to generate and revise
                  your letter.
                </p>
              </div>
              <Link
                href="/billing"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-control bg-seal px-5 py-2.5 font-mono text-[12px] uppercase tracking-document text-background transition-[background-color,transform] hover:bg-[color:var(--accent-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40 active:translate-y-[1px]"
              >
                Buy more
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        ) : null}

        {status === "done" ? (
          <div className="space-y-4">
            <DisclaimerStamp text={DISCLAIMER} />
            <CitationNote />
            {saveFailed ? (
              <SaveFailedAlert
                copyState={copyState}
                retryState={retryState}
                onCopy={copyDraft}
                onRetry={retrySave}
                canRetry={resolvedCaseId !== null}
              />
            ) : null}
            {sections.map((s, i) => (
              <div
                key={s.heading + i}
                style={{ animationDelay: `${i * 70}ms` }}
                className="card-enter rounded-control border border-accent/25 bg-surface px-4 py-3"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="display text-[15px] text-foreground">
                    {s.heading}
                  </span>
                  <button
                    type="button"
                    onClick={() => regenerate(s.heading)}
                    disabled={regenerating !== null}
                    className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-document text-accent-dark transition-colors hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                      className={regenerating === s.heading ? "animate-spin" : ""}
                    >
                      <path d="M21 12a9 9 0 1 1-3-6.7" />
                      <path d="M21 4v4h-4" />
                    </svg>
                    {regenerating === s.heading ? "Regenerating…" : "Regenerate"}
                    {regenerating !== s.heading ? (
                      <span className="rounded-full bg-accent/15 px-1.5 py-0.5 font-mono text-[9px] tracking-normal text-accent-dark">
                        5
                      </span>
                    ) : null}
                  </button>
                </div>
                {regenerationError === s.heading ? (
                  <div
                    role="alert"
                    className="mb-2 rounded-control border border-danger/40 bg-danger-soft/50 px-3 py-2 font-sans text-[12px] text-danger"
                  >
                    Regeneration failed — your previous text was kept
                  </div>
                ) : null}
                <textarea
                  value={s.body}
                  onChange={(e) => editBody(s.heading, e.target.value)}
                  rows={Math.max(3, Math.ceil(s.body.length / 90))}
                  className="w-full resize-y rounded-control border border-border-strong bg-surface px-3 py-2 font-sans text-[13.5px] leading-[1.7] text-foreground-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
                />
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={generate}
                disabled={regenerating !== null}
              >
                Regenerate full draft
              </Button>
              <span className="microprint" style={{ color: "var(--muted)" }}>
                Edits are local — your attorney of record finalizes and signs.
              </span>
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
