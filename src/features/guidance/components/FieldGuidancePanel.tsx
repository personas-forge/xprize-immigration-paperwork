"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, CardBody, CardHeader, Skeleton } from "@/components/ui";
import { costOf } from "@/lib/tokens/registry";
import { getForms } from "@/lib/data";
import { type UscisForm } from "@/features/case-file/types";
import { DISCLAIMER, MAX_FIELD, type GuidanceResponse } from "../guidance";
import { isModelSource, sourceLabel } from "@/lib/llm/label";
import { DisclaimerStamp, AdjudicationBadge } from "@/components/legal";
import { type AdjudicationReport } from "@/lib/llm/adjudication-gates";

// The orchestrator attaches a best-effort `{ adjudication }` report to the
// response body (live UPL screen); the typed envelope doesn't carry it, so
// augment it locally for the panel.
type GuidanceResult = GuidanceResponse & { adjudication?: AdjudicationReport };

// — Field-guidance panel ─────────────────────────────────────────────────────
// Pick a USCIS form + field, describe the situation, and request INFORMATIONAL
// guidance from /api/guidance. The not-legal-advice disclaimer is rendered as a
// prominent bordeaux stamp on every result — it cannot be dismissed and is the
// product's UPL safeguard. Handles loading, error, and empty states.

type Status = "idle" | "loading" | "done" | "error" | "paywall";

export function FieldGuidancePanel() {
  const [forms, setForms] = useState<readonly UscisForm[] | null>(null);
  const [formId, setFormId] = useState("");
  const [fieldLabel, setFieldLabel] = useState("");
  const [situation, setSituation] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<GuidanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formsError, setFormsError] = useState(false);
  // Bumping this re-runs the catalog effect; the Retry handler owns the
  // formsError reset so no setState ever runs synchronously in the effect body
  // (react-hooks/set-state-in-effect).
  const [formsAttempt, setFormsAttempt] = useState(0);

  const fieldSelectId = useId();
  const formSelectId = useId();
  const situationId = useId();

  // Load the form catalog through the data layer (mock today, API later).
  // A rejected fetch flips formsError so the panel shows a retryable alert
  // instead of an endless skeleton.
  useEffect(() => {
    let active = true;
    getForms()
      .then((list) => {
        if (!active) return;
        setForms(list);
        const first = list[0];
        if (first) {
          setFormId(first.number);
          setFieldLabel(first.commonFields[0] ?? "");
        }
      })
      .catch(() => {
        if (!active) return;
        setFormsError(true);
      });
    return () => {
      active = false;
    };
  }, [formsAttempt]);

  function onRetryForms() {
    setFormsError(false);
    setFormsAttempt((n) => n + 1);
  }

  const activeForm = forms?.find((f) => f.number === formId) ?? null;

  function onFormChange(nextNumber: string) {
    setFormId(nextNumber);
    const next = forms?.find((f) => f.number === nextNumber) ?? null;
    setFieldLabel(next?.commonFields[0] ?? "");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formId || !fieldLabel || situation.trim() === "") {
      setError("Pick a form and field, then describe your situation.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/guidance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formId, fieldLabel, situation }),
      });
      // 402 → out of tokens. Show the paywall CTA (→ /billing) instead of a
      // generic error. The not-legal-advice disclaimer still renders here.
      if (res.status === 402) {
        setStatus("paywall");
        return;
      }
      const data = (await res.json()) as GuidanceResult | { error: string };
      if (!res.ok || "error" in data) {
        setError("error" in data ? data.error : "Could not generate guidance.");
        setStatus("error");
        return;
      }
      setResult(data);
      setStatus("done");
    } catch {
      setError("Network error — please try again.");
      setStatus("error");
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="microprint" style={{ color: "var(--accent-dark)" }}>
          § V — Field guidance · informational
        </div>
        <Badge tone="accent">AI-assisted</Badge>
      </CardHeader>
      <CardBody className="space-y-5">
        {formsError ? (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-control border border-danger/40 bg-danger-soft/50 px-4 py-3 font-sans text-[15px] text-danger sm:flex-row sm:items-center sm:justify-between"
          >
            <span>Could not load the USCIS form list — please try again.</span>
            <Button type="button" variant="secondary" onClick={onRetryForms}>
              Retry
            </Button>
          </div>
        ) : forms === null ? (
          <GuidanceFormSkeleton />
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="microprint">USCIS form</span>
                <select
                  id={formSelectId}
                  value={formId}
                  onChange={(e) => onFormChange(e.target.value)}
                  className="mt-1.5 w-full rounded-control border border-border-strong bg-surface px-3 py-2 font-sans text-[16px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]"
                >
                  {forms.map((f) => (
                    <option key={f.id} value={f.number}>
                      {f.number} — {f.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="microprint">Field</span>
                <select
                  id={fieldSelectId}
                  value={fieldLabel}
                  onChange={(e) => setFieldLabel(e.target.value)}
                  className="mt-1.5 w-full rounded-control border border-border-strong bg-surface px-3 py-2 font-sans text-[16px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]"
                >
                  {(activeForm?.commonFields ?? []).map((field) => (
                    <option key={field} value={field}>
                      {field}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="microprint flex items-baseline justify-between gap-2">
                <span>Describe your situation</span>
                {/* Visible counter; the cap itself is enforced by maxLength (which
                    AT already announces), so the counter is decorative. */}
                <span aria-hidden style={{ color: "var(--muted)" }}>
                  {situation.length} / {MAX_FIELD}
                </span>
              </span>
              <textarea
                id={situationId}
                value={situation}
                onChange={(e) => setSituation(e.target.value)}
                rows={3}
                maxLength={MAX_FIELD}
                placeholder="e.g. I'm an O-1A researcher with 6 papers and a granted patent…"
                className="mt-1.5 w-full resize-y rounded-control border border-border-strong bg-surface px-3 py-2 font-sans text-[16px] leading-relaxed text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]"
              />
            </label>

            <div className="flex items-center gap-3">
              <Button type="submit" variant="primary" disabled={status === "loading"}>
                {status === "loading" ? (
                  "Generating…"
                ) : (
                  <>
                    Get field guidance
                    <span className="ml-2 rounded-full bg-background/15 px-1.5 py-0.5 font-mono text-[12px] tracking-document">
                      {costOf("guidance")} token
                    </span>
                  </>
                )}
              </Button>
              <span className="microprint" style={{ color: "var(--muted)" }}>
                Informational only
              </span>
            </div>
          </form>
        )}

        {/* Persistent live region (always in the DOM) so screen readers reliably
            hear the generating→ready transition — on a UPL surface, the
            not-legal-advice note must be spoken, not just shown. WCAG 4.1.3. */}
        <div role="status" aria-live="polite" className="sr-only">
          {status === "loading"
            ? "Generating guidance…"
            : status === "done"
              ? "Guidance ready — informational only, not legal advice."
              : ""}
        </div>

        {status === "loading" ? <GuidanceResultSkeleton /> : null}

        {status === "error" && error ? (
          <div className="space-y-3">
            {/* UPL safeguard is never optional on this surface — keep it visible
                even when the request failed (guidance #3). */}
            <DisclaimerStamp text={DISCLAIMER} />
            <div
              role="alert"
              className="rounded-control border border-danger/40 bg-danger-soft/50 px-4 py-3 font-sans text-[15px] text-danger"
            >
              {error}
            </div>
          </div>
        ) : null}

        {status === "paywall" ? (
          <div className="space-y-3">
            {/* The UPL disclaimer stays visible even on the out-of-tokens path. */}
            <DisclaimerStamp text={DISCLAIMER} />
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-control border-2 border-double border-seal/50 bg-seal-soft/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="microprint" style={{ color: "var(--seal)" }}>
                  Out of tokens
                </div>
                <p className="mt-1 font-sans text-[15.5px] leading-snug text-foreground-soft">
                  You&apos;ve used your token balance. Buy more to keep
                  generating informational field guidance.
                </p>
              </div>
              <Link
                href="/billing"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-control bg-seal px-5 py-2.5 font-mono text-[14px] uppercase tracking-document text-background transition-[background-color,transform] hover:bg-[color:var(--accent-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)] active:translate-y-[1px]"
              >
                Buy more
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        ) : null}

        {status === "done" && result ? (
          <div className="space-y-3">
            {/* Disclaimer renders FIRST and prominently — never optional. Sourced
                from the LOCAL const, not the server echo, so a response that omits
                `disclaimer` can't drop the UPL safeguard (guidance #3). */}
            <DisclaimerStamp text={DISCLAIMER} />
            {/* Live UPL screen: flags outcome/advice language in the answer. */}
            {result.adjudication ? (
              <AdjudicationBadge report={result.adjudication} />
            ) : null}
            <div className="relative rounded-control border border-accent/30 bg-surface px-5 py-4">
              <div className="absolute inset-x-0 top-0 perforation h-px" aria-hidden />
              <div className="mb-2 flex items-center justify-between">
                <span className="microprint" style={{ color: "var(--accent-dark)" }}>
                  {formId} · {fieldLabel}
                </span>
                <Badge tone={isModelSource(result.source) ? "accent" : "neutral"}>
                  {sourceLabel(result.source)}
                </Badge>
              </div>
              <p className="font-sans text-[16px] leading-[1.7] text-foreground-soft">
                {result.guidance}
              </p>
              <div className="absolute inset-x-0 bottom-0 perforation h-px" aria-hidden />
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

function GuidanceFormSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
      <Skeleton className="h-20" />
      <Skeleton className="h-9 w-44" />
    </div>
  );
}

function GuidanceResultSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-14" />
      <Skeleton className="h-24" />
    </div>
  );
}
