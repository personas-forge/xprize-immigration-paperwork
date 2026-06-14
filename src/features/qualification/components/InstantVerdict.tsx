"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, CardBody, CardHeader, Skeleton } from "@/components/ui";
import { Seal, Guilloche } from "@/components/brand";
import { Rise } from "@/components/Motion";
import { VISA_PACKS, packFor, type Classification } from "../packs";
import { livePrograms } from "../jurisdictions";
import { type QualifyResult } from "../qualification";
import { CriteriaReport } from "./CriteriaReport";
import { writeQualifyPrefill } from "../prefill";

// — Instant Verdict (moonshot #16) ────────────────────────────────────────────
// The landing hero IS the product: paste a CV / bio and an engraved "Certificate
// of Extraordinary Ability" assembles live, with zero signup. It calls the
// anonymous, keyless /api/qualify/preview (deterministic mock — no charge, no
// model, no DB), then renders the SAME CriteriaReport the authenticated funnel
// uses, skinned as a certificate with the brand Seal + Guilloche. The deep value
// (the real model screening, saving, drafting) sits behind a single soft
// sign-in CTA that carries the just-entered profile into /qualify untouched.

const PROGRAMS = livePrograms();

const SAMPLE =
  "Senior research engineer. 6 peer-reviewed papers (412 citations), best-paper " +
  "award at a top ML conference, one granted US patent. Featured in TechCrunch. " +
  "Founding engineer at a Series B startup; $320K salary plus equity.";

type Status = "idle" | "loading" | "done" | "error";

export function InstantVerdict() {
  const [name, setName] = useState("");
  const [classification, setClassification] = useState<Classification>("O-1A");
  const [profile, setProfile] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<QualifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nameId = useId();
  const classId = useId();
  const profileId = useId();
  const busy = useRef(false);

  async function reveal(e: React.FormEvent) {
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
      const res = await fetch("/api/qualify/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, profile, classification }),
      });
      if (res.status === 429) {
        setError("You're going quickly — give it a few seconds and try again.");
        setStatus("error");
        return;
      }
      const data = (await res.json()) as QualifyResult | { error: string };
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
    } finally {
      busy.current = false;
    }
  }

  // Carry everything into the authenticated /qualify so nothing is re-typed.
  function goDeeper() {
    writeQualifyPrefill({ name, profile, classification });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="microprint" style={{ color: "var(--accent-dark)" }}>
            § Instant verdict · no signup
          </div>
          <Badge tone="accent">Free · informational</Badge>
        </CardHeader>
        <CardBody>
          <form onSubmit={reveal} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="microprint">Your name (optional)</span>
                <input
                  id={nameId}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dr. Anya Krishnan"
                  className="mt-1.5 w-full rounded-control border border-border-strong bg-surface px-3 py-2 font-sans text-[16px] text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
                />
              </label>
              <label className="block">
                <span className="microprint">Visa type</span>
                <select
                  id={classId}
                  value={classification}
                  onChange={(e) => setClassification(e.target.value as Classification)}
                  className="mt-1.5 w-full rounded-control border border-border-strong bg-surface px-3 py-2 font-sans text-[16px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
                >
                  {PROGRAMS.map((c) => (
                    <option key={c} value={c}>
                      {c} — {VISA_PACKS[c].label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

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
                className="mt-1.5 w-full resize-y rounded-control border border-border-strong bg-surface px-3 py-2 font-sans text-[16px] leading-relaxed text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
              />
              <div className="mt-1 flex justify-end">
                <span
                  className="microprint"
                  style={{
                    color: profile.trim().length >= 40 ? "var(--success)" : "var(--muted)",
                  }}
                >
                  {profile.trim().length >= 40
                    ? "Ready ✓"
                    : `${40 - profile.trim().length} more characters`}
                </span>
              </div>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" variant="primary" disabled={status === "loading"}>
                {status === "loading" ? "Sealing…" : "Reveal my verdict"}
              </Button>
              <button
                type="button"
                onClick={() => setProfile(SAMPLE)}
                className="font-mono text-[13px] uppercase tracking-document text-muted-strong underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40"
              >
                Use a sample
              </button>
              <span className="microprint" style={{ color: "var(--muted)" }}>
                No account needed · not legal advice
              </span>
            </div>
          </form>
        </CardBody>
      </Card>

      {status === "loading" ? <VerdictSkeleton /> : null}

      {status === "error" && error ? (
        <div
          role="alert"
          className="rounded-control border border-danger/40 bg-danger-soft/50 px-4 py-3 font-sans text-[15px] text-danger"
        >
          {error}
        </div>
      ) : null}

      {status === "done" && result ? (
        <Rise>
          <Certificate
            petitioner={name.trim() || "Applicant"}
            classification={classification}
          >
            <CriteriaReport
              result={result}
              threshold={packFor(classification).threshold}
            />
          </Certificate>
          <SoftGate
            classification={classification}
            likelihood={result.likelihood}
            onGoDeeper={goDeeper}
          />
        </Rise>
      ) : null}
    </div>
  );
}

/** The engraved certificate frame: a guilloché watermark + the brand seal wrap
 *  the live screening so the brand primitives BECOME the product. */
function Certificate({
  petitioner,
  classification,
  children,
}: {
  petitioner: string;
  classification: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-card border-2 border-double border-accent/30 bg-surface px-5 py-6 sm:px-7">
      <div
        className="pointer-events-none absolute -right-16 -top-16 text-accent-dark/70"
        aria-hidden
      >
        <Guilloche size={300} />
      </div>
      <div className="relative">
        <div className="flex items-center gap-3 text-accent-dark">
          <Seal size={40} />
          <div>
            <div className="microprint" style={{ color: "var(--accent-dark)" }}>
              Certificate of Extraordinary Ability · {classification}
            </div>
            <div className="display text-[clamp(1.4rem,3vw,2rem)] leading-tight">
              {petitioner}
            </div>
          </div>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

/** The single soft sign-in CTA — pre-fills the just-entered profile into the
 *  authenticated /qualify (real model screening, saving, drafting). */
function SoftGate({
  classification,
  likelihood,
  onGoDeeper,
}: {
  classification: string;
  likelihood: number;
  onGoDeeper: () => void;
}) {
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-control border-2 border-double border-seal/40 bg-seal-soft/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="microprint" style={{ color: "var(--seal)" }}>
          Go deeper — free to start
        </div>
        <p className="mt-1 font-sans text-[15.5px] leading-snug text-foreground-soft">
          This was the instant read. Run the full {classification} screening with
          evidence, a gap plan, and a draftable petition — your answers carry over.
        </p>
      </div>
      <Link
        href="/qualify"
        onClick={onGoDeeper}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-control bg-seal px-5 py-2.5 font-mono text-[14px] uppercase tracking-document text-background transition-[background-color,transform] hover:bg-[color:var(--accent-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40 active:translate-y-[1px]"
      >
        Continue ({likelihood}%)
        <span aria-hidden>→</span>
      </Link>
    </div>
  );
}

function VerdictSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-16" />
      <Skeleton className="h-28" />
      <Skeleton className="h-40" />
    </div>
  );
}
