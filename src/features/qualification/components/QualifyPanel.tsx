"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, CardBody, CardHeader, Skeleton } from "@/components/ui";
import { DISCLAIMER, type QualifyResult } from "../qualification";
import { VISA_PACKS, type Classification } from "../packs";
import { jurisdictionFor, livePrograms } from "../jurisdictions";
import { validationFor } from "../validation";

// Only programs whose jurisdiction is live are offered (US today).
const PROGRAMS = livePrograms();
import { DisclaimerStamp } from "@/features/guidance/components/DisclaimerStamp";
import { DraftStudio } from "@/features/drafting/components/DraftStudio";
import { CriteriaReport } from "./CriteriaReport";

// — Qualification panel ───────────────────────────────────────────────────────
// Paste a CV / bio / list of achievements, get an INFORMATIONAL screening from
// /api/qualify mapped onto the eight O-1A criteria. The not-legal-advice
// disclaimer is rendered on every result (and on the paywall path) — it is the
// product's UPL safeguard. Handles loading, error, paywall, and done states.

type Status = "idle" | "loading" | "done" | "error" | "paywall";

type QualifyApiResponse = QualifyResult & { caseId: string | null };

const SAMPLE =
  "Senior research engineer. 6 peer-reviewed papers (412 citations), best-paper " +
  "award at a top ML conference, one granted US patent. Featured in TechCrunch. " +
  "Founding engineer at a Series B startup; $320K salary plus equity.";

export function QualifyPanel() {
  const [name, setName] = useState("");
  const [classification, setClassification] = useState<Classification>("O-1A");
  const [profile, setProfile] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<QualifyApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nameId = useId();
  const classId = useId();
  const profileId = useId();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (profile.trim().length < 40) {
      setError("Tell us a bit more about your background (at least a sentence or two).");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/qualify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, profile, classification }),
      });
      // 402 → out of tokens. Show the paywall CTA (→ /billing) instead of a
      // generic error. The not-legal-advice disclaimer still renders here.
      if (res.status === 402) {
        setStatus("paywall");
        return;
      }
      const data = (await res.json()) as QualifyApiResponse | { error: string };
      if (!res.ok || "error" in data) {
        setError("error" in data ? data.error : "Could not run the screening.");
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="microprint" style={{ color: "var(--accent-dark)" }}>
            § Self-screening · informational
          </div>
          <Badge tone="accent">AI-assisted</Badge>
        </CardHeader>
        <CardBody>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="microprint">Your name (optional)</span>
                <input
                  id={nameId}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dr. Anya Krishnan"
                  className="mt-1.5 w-full rounded-control border border-border-strong bg-surface px-3 py-2 font-sans text-[14px] text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
                />
              </label>

              <label className="block">
                <span className="microprint">Visa type</span>
                <select
                  id={classId}
                  value={classification}
                  onChange={(e) => setClassification(e.target.value as Classification)}
                  className="mt-1.5 w-full rounded-control border border-border-strong bg-surface px-3 py-2 font-sans text-[14px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
                >
                  {PROGRAMS.map((c) => (
                    <option key={c} value={c}>
                      {c} — {VISA_PACKS[c].label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="microprint" style={{ color: "var(--muted)" }}>
              Jurisdiction: {jurisdictionFor(classification).label}
            </p>
            {(() => {
              const v = validationFor(classification);
              return v ? (
                <p className="microprint" style={{ color: "var(--muted)" }}>
                  Criteria per {v.legalBasis}
                  {v.threshold ? ` · ${v.threshold}` : ""} · last reviewed {v.lastVerified} ·{" "}
                  <Link href="/validation" className="ink-link">
                    validation &amp; sources
                  </Link>
                </p>
              ) : null;
            })()}

            <label className="block">
              <span className="microprint">
                Your background — awards, publications, press, patents, roles, salary
              </span>
              <textarea
                id={profileId}
                value={profile}
                onChange={(e) => setProfile(e.target.value)}
                rows={7}
                placeholder="Paste your CV highlights or describe your achievements in plain language…"
                className="mt-1.5 w-full resize-y rounded-control border border-border-strong bg-surface px-3 py-2 font-sans text-[14px] leading-relaxed text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
              />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" variant="primary" disabled={status === "loading"}>
                {status === "loading" ? "Screening…" : "Check my eligibility"}
              </Button>
              <button
                type="button"
                onClick={() => setProfile(SAMPLE)}
                className="font-mono text-[11px] uppercase tracking-document text-muted-strong underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
              >
                Use a sample
              </button>
              <span className="microprint" style={{ color: "var(--muted)" }}>
                Informational only
              </span>
            </div>
          </form>
        </CardBody>
      </Card>

      {status === "loading" ? <ReportSkeleton /> : null}

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
            <div>
              <div className="microprint" style={{ color: "var(--seal)" }}>
                Out of tokens
              </div>
              <p className="mt-1 font-sans text-[13.5px] leading-snug text-foreground-soft">
                You&apos;ve used your token balance. Buy more to run another
                qualification screening.
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

      {status === "done" && result ? (
        <div className="space-y-4">
          <CriteriaReport result={result} />
          {/* Second wow moment: draft the petition straight from the score. */}
          <DraftStudio
            petitioner={name.trim() || "Applicant"}
            classification={classification}
            criteria={result.criteria}
            caseId={result.caseId}
          />
          {result.caseId ? (
            <p className="microprint" style={{ color: "var(--muted-strong)" }}>
              Saved to your case file.{" "}
              <Link href={`/dashboard/cases/${result.caseId}`} className="ink-link">
                Open case file →
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-14" />
      <Skeleton className="h-28" />
      <Skeleton className="h-40" />
    </div>
  );
}
