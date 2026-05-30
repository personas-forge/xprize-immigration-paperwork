"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, CardBody, CardHeader, Skeleton } from "@/components/ui";
import { DisclaimerStamp } from "@/features/guidance/components/DisclaimerStamp";
import { DISCLAIMER, type DraftSection } from "@/features/drafting";
import { isModelSource, sourceLabel, type ModelSource } from "@/lib/llm/label";

// — RFE response studio ───────────────────────────────────────────────────────
// Paste the USCIS Request for Evidence, generate a structured response grounded
// in the petition's criteria, then edit it inline. Shown on a filed case. The
// not-legal-advice disclaimer renders on every output (attorney work product,
// never final). Generation costs tokens; a 402 shows the paywall CTA.

interface RfeStudioCriterion {
  name: string;
  status: string;
  evidence: string;
  rationale: string;
}

type Status = "idle" | "loading" | "done" | "error" | "paywall";

interface RfeApiResponse {
  sections: DraftSection[];
  disclaimer: string;
  source: ModelSource;
  caseId: string | null;
  version: number | null;
}

export function RfeStudio({
  caseId,
  petitioner,
  classification = "O-1A",
  criteria,
  initialSections = null,
  initialRfeText = "",
  initialSource = "mock",
}: {
  caseId: string;
  petitioner: string;
  classification?: string;
  criteria: readonly RfeStudioCriterion[];
  initialSections?: DraftSection[] | null;
  initialRfeText?: string;
  initialSource?: ModelSource;
}) {
  const hasInitial = Boolean(initialSections && initialSections.length > 0);
  const [rfeText, setRfeText] = useState(initialRfeText);
  const [status, setStatus] = useState<Status>(hasInitial ? "done" : "idle");
  const [sections, setSections] = useState<DraftSection[]>(initialSections ?? []);
  const [source, setSource] = useState<ModelSource>(initialSource);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (rfeText.trim().length < 20) {
      setError("Paste the text of the RFE you received (a sentence or two is enough).");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/rfe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          rfeText,
          petitioner,
          classification,
          criteria: criteria.map((c) => ({
            name: c.name,
            status: c.status,
            evidence: c.evidence,
            rationale: c.rationale,
          })),
        }),
      });
      if (res.status === 402) {
        setStatus("paywall");
        return;
      }
      const data = (await res.json()) as RfeApiResponse | { error: string };
      if (!res.ok || "error" in data) {
        setError("error" in data ? data.error : "Could not draft the RFE response.");
        setStatus("error");
        return;
      }
      setSections(data.sections);
      setSource(data.source);
      setStatus("done");
    } catch {
      setError("Network error — please try again.");
      setStatus("error");
    }
  }

  function editBody(heading: string, body: string) {
    setSections((prev) => prev.map((s) => (s.heading === heading ? { ...s, body } : s)));
  }

  return (
    <Card tone="seal">
      <CardHeader className="border-seal/30 bg-seal-soft/30">
        <div className="microprint" style={{ color: "var(--seal)" }}>
          § VI — RFE response · attorney work product
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
        <label className="block">
          <span className="microprint">Paste the USCIS Request for Evidence</span>
          <textarea
            value={rfeText}
            onChange={(e) => setRfeText(e.target.value)}
            rows={4}
            placeholder="The evidence does not establish that the beneficiary satisfies…"
            className="mt-1.5 w-full resize-y rounded-control border border-border-strong bg-surface px-3 py-2 font-sans text-[13.5px] leading-relaxed text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="seal" onClick={generate} disabled={status === "loading"}>
            {status === "loading"
              ? "Drafting…"
              : status === "done"
                ? "Regenerate response"
                : "Draft RFE response"}
          </Button>
          <span className="microprint" style={{ color: "var(--muted)" }}>
            Uses 5 tokens · attorney must review &amp; sign
          </span>
        </div>

        {status === "loading" ? (
          <div className="space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-24" />
          </div>
        ) : null}

        {status === "error" && error ? (
          <div
            role="alert"
            className="rounded-control border border-danger/40 bg-danger-soft/50 px-4 py-3 font-sans text-[13px] text-danger"
          >
            {error}
          </div>
        ) : null}

        {status === "paywall" ? (
          <div className="space-y-3">
            <DisclaimerStamp text={DISCLAIMER} />
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-control border-2 border-double border-seal/50 bg-seal-soft/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="font-sans text-[13.5px] leading-snug text-foreground-soft">
                Drafting an RFE response needs tokens. Top up to continue.
              </p>
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
            {sections.map((s, i) => (
              <div key={s.heading + i} className="rounded-control border border-seal/25 bg-surface px-4 py-3">
                <div className="mb-2 display text-[15px] text-foreground">{s.heading}</div>
                <textarea
                  value={s.body}
                  onChange={(e) => editBody(s.heading, e.target.value)}
                  rows={Math.max(3, Math.ceil(s.body.length / 90))}
                  className="w-full resize-y rounded-control border border-border-strong bg-surface px-3 py-2 font-sans text-[13.5px] leading-[1.7] text-foreground-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
                />
              </div>
            ))}
            <p className="microprint" style={{ color: "var(--muted)" }}>
              Edits are local — your attorney of record finalizes and signs.
            </p>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
