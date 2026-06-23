"use client";

import { useId, useRef, useState } from "react";
import { Badge, Button, Card, CardBody, CardHeader, Skeleton } from "@/components/ui";
import { Seal } from "@/components/brand";
import { Rise } from "@/components/Motion";
import { DisclaimerStamp } from "@/components/legal";
import { type BestPathResult, type ProgramScore } from "../best-path";
import { isModelSource } from "@/lib/llm/label";
import { SAMPLE_PROFILE, type QualifyPrefill } from "../prefill";

// — Best-path finder (moonshot #7) ────────────────────────────────────────────
// "Which visa should I even pursue?" One profile, scored against EVERY live
// program in a single keyless pass (/api/qualify/preview/best-path), ranked
// best-first with the strongest/fastest route recommended. Choosing a program
// hands the profile to the full screening with nothing re-typed.


type Status = "idle" | "loading" | "done" | "error";

export function BestPathFinder({
  onContinue,
}: {
  /** Called with the chosen program + profile so the caller can hand off to the
   *  full screening (prefilled). */
  onContinue?: (prefill: QualifyPrefill) => void;
}) {
  const [name, setName] = useState("");
  const [profile, setProfile] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<BestPathResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nameId = useId();
  const profileId = useId();
  const busy = useRef(false);

  async function find(e: React.FormEvent) {
    e.preventDefault();
    if (busy.current) return;
    if (profile.trim().length < 40) {
      setError("Tell us a bit more — a sentence or two about your background.");
      setStatus("error");
      return;
    }
    busy.current = true;
    setStatus("loading");
    setError(null);
    setResult(null);
    try {
      // Prefer the model-backed comparison (authenticated — reads the whole
      // record); fall back to the keyless KEYWORD preview when signed out (401)
      // or out of tokens (402) so the funnel still works (UAT LLM-1).
      let res = await fetch("/api/qualify/best-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, profile, classification: "O-1A" }),
      });
      if (res.status === 401 || res.status === 402) {
        res = await fetch("/api/qualify/preview/best-path", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, profile, classification: "O-1A" }),
        });
      }
      if (res.status === 429) {
        setError("You're going quickly — give it a few seconds and try again.");
        setStatus("error");
        return;
      }
      const data = (await res.json()) as BestPathResult | { error: string };
      if (!res.ok || "error" in data) {
        setError("error" in data ? data.error : "Could not compare your paths.");
        setStatus("error");
        return;
      }
      setResult(data);
      setStatus("done");
    } catch {
      setError("Network error — please try again.");
      setStatus("error");
    } finally {
      busy.current = false;
    }
  }

  function choose(classification: string) {
    onContinue?.({ name, profile, classification });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="microprint" style={{ color: "var(--accent-dark)" }}>
            § Find my best path · all programs
          </div>
          <Badge tone="accent">Free · informational</Badge>
        </CardHeader>
        <CardBody>
          <form onSubmit={find} className="space-y-4">
            <label className="block">
              <span className="microprint">Your name (optional)</span>
              <input
                id={nameId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dr. Anya Krishnan"
                className="mt-1.5 w-full rounded-control border border-border-strong bg-surface px-3 py-2 font-sans text-[16px] text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]"
              />
            </label>
            <label className="block">
              <span className="microprint">
                Your background — awards, publications, press, patents, roles, salary
              </span>
              <textarea
                id={profileId}
                value={profile}
                onChange={(e) => setProfile(e.target.value)}
                rows={6}
                placeholder="Paste your CV highlights or describe your achievements in plain language…"
                className="mt-1.5 w-full resize-y rounded-control border border-border-strong bg-surface px-3 py-2 font-sans text-[16px] leading-relaxed text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]"
              />
              <div className="mt-1 flex justify-end">
                <span
                  className="microprint"
                  style={{ color: profile.trim().length >= 40 ? "var(--success)" : "var(--muted)" }}
                >
                  {profile.trim().length >= 40 ? "Ready ✓" : `${40 - profile.trim().length} more characters`}
                </span>
              </div>
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" variant="primary" disabled={status === "loading"}>
                {status === "loading" ? "Comparing…" : "Find my best path"}
              </Button>
              <button
                type="button"
                onClick={() => setProfile(SAMPLE_PROFILE)}
                className="font-mono text-[13px] uppercase tracking-document text-muted-strong underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]"
              >
                Use a sample
              </button>
              <span className="microprint" style={{ color: "var(--muted)" }}>
                Compares O-1A · O-1B · EB-1A · not legal advice
              </span>
            </div>
          </form>
        </CardBody>
      </Card>

      {status === "loading" ? <Skeleton className="h-48" /> : null}

      {status === "error" && error ? (
        <div
          role="alert"
          className="rounded-control border border-danger/40 bg-danger-soft/50 px-4 py-3 font-sans text-[15px] text-danger"
        >
          {error}
        </div>
      ) : null}

      {status === "done" && result ? (
        <Rise className="space-y-4">
          <DisclaimerStamp text={result.disclaimer} />
          <RecommendationBanner result={result} onChoose={choose} />
          {/* The keyless KEYWORD ranking can under-read a record whose evidence
              doesn't match the obvious words — show this caveat ONLY for the mock;
              a model-read result (source claude/gemini) read the whole record and
              needs none (UAT 2026-06-20 LLM-1 / T1). */}
          {!isModelSource(result.source) ? (
            <p className="rounded-control border border-dashed border-seal/50 bg-seal-soft/20 px-4 py-3 font-sans text-[14.5px] leading-snug text-foreground-soft">
              <span className="font-mono text-[11px] uppercase tracking-document text-seal">
                Keyword pre-read ·{" "}
              </span>
              This comparison scores your text by keyword, so it can under-read a
              strong record whose evidence doesn&apos;t match the obvious words — a
              director, composer, chef, or athlete. It&apos;s a starting point, not
              a verdict: the full screening reads your whole record in depth and
              can change which path fits best. Your answers carry over.
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {result.programs.map((p) => (
              <ProgramCard
                key={p.classification}
                program={p}
                recommended={p.classification === result.recommendation.classification}
                onChoose={() => choose(p.classification)}
              />
            ))}
          </div>
        </Rise>
      ) : null}
    </div>
  );
}

function RecommendationBanner({
  result,
  onChoose,
}: {
  result: BestPathResult;
  onChoose: (classification: string) => void;
}) {
  const rec = result.recommendation;
  return (
    <div className="relative overflow-hidden rounded-card border-2 border-double border-accent/40 bg-accent-soft/30 px-5 py-4">
      <div className="flex items-start gap-4">
        <div className="shrink-0 text-accent-dark">
          <Seal size={40} monogram={rec.classification.replace(/[^A-Z0-9]/g, "").slice(0, 2)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="microprint" style={{ color: "var(--accent-dark)" }}>
            Recommended path
          </div>
          <div className="display text-[20px]">{rec.classification}</div>
          <p className="mt-1 font-sans text-[15.5px] leading-snug text-foreground-soft">
            {rec.rationale}
          </p>
        </div>
        <Button type="button" variant="primary" onClick={() => onChoose(rec.classification)}>
          Continue with {rec.classification}
        </Button>
      </div>
    </div>
  );
}

function ProgramCard({
  program,
  recommended,
  onChoose,
}: {
  program: ProgramScore;
  recommended: boolean;
  onChoose: () => void;
}) {
  return (
    <div
      className={`flex flex-col rounded-control border bg-surface px-4 py-3 ${
        recommended ? "border-accent/50 ring-1 ring-accent/30" : "border-border-strong"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="display text-[17px]">{program.classification}</span>
        <Badge tone={program.summary.meetsThreshold ? "success" : "warning"}>
          {program.summary.meetsThreshold ? "Clears" : `${program.gapsToThreshold} short`}
        </Badge>
      </div>
      <p className="mt-1 font-sans text-[13.5px] italic leading-snug text-muted-strong">
        {program.label}
      </p>
      <div className="mt-3 flex items-baseline gap-2">
        <span
          className="display text-[1.8rem] text-foreground"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {program.assessment.likelihood}
          <span className="text-[1rem] text-muted">%</span>
        </span>
        <span className="microprint">
          {program.summary.qualifying}/{program.criteriaCount} · needs {program.threshold}
          {program.greenCard ? " · green card" : ""}
        </span>
      </div>
      <button
        type="button"
        onClick={onChoose}
        className="mt-3 inline-flex items-center gap-1.5 self-start font-mono text-[12px] uppercase tracking-document text-accent-dark transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]"
      >
        Screen for {program.classification}
        <span aria-hidden>→</span>
      </button>
    </div>
  );
}
