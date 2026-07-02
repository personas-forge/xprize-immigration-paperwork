"use client";

import { useRef, useState } from "react";
import { Badge, Button, Card, CardBody, CardHeader, Skeleton } from "@/components/ui";
import { DisclaimerStamp } from "@/components/legal";
import { costOf } from "@/lib/tokens/registry";
import { useIdempotencyKeys } from "@/lib/idempotency";
import { type RfeChallenge, type RfeForecastResult } from "@/features/rfe";

// — RFE Risk Radar (moonshot #20) ─────────────────────────────────────────────
// Predicts which criteria USCIS is most likely to challenge BEFORE filing and
// lets the user harden each in one click (Reinforce → the existing section
// regenerate). Ranked cards colored by likelihood. Charged (heavy `rfe` op).

interface RadarCriterion {
  name: string;
  status: string;
  evidence: string;
  rationale: string;
}

type Status = "idle" | "loading" | "done" | "error";

function riskTone(likelihood: number): "danger" | "warning" | "success" {
  if (likelihood >= 70) return "danger";
  if (likelihood >= 45) return "warning";
  return "success";
}

export function RfeRiskRadar({
  criteria,
  classification,
  petitioner,
  caseId,
  reinforceable,
  reinforcing,
  onReinforce,
  onPaywall,
}: {
  criteria: readonly RadarCriterion[];
  classification: string;
  petitioner: string;
  caseId: string | null;
  /** Criterion names that have a draft section to reinforce. */
  reinforceable: ReadonlySet<string>;
  /** The criterion currently being reinforced (regenerated), if any. */
  reinforcing: string | null;
  onReinforce: (criterion: string) => void;
  onPaywall: () => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [challenges, setChallenges] = useState<RfeChallenge[]>([]);
  const [disclaimer, setDisclaimer] = useState("");
  const busy = useRef(false);
  // Charge idempotency: the error-path "Try again" reuses the key (the debit
  // de-dupes); a completed forecast rotates it. See @/lib/idempotency.
  const idem = useIdempotencyKeys();

  async function forecast() {
    if (busy.current) return; // charges tokens
    busy.current = true;
    setStatus("loading");
    try {
      // The body doubles as the intent fingerprint — the inputs are all props,
      // so this only rotates if the parent re-screens the criteria under us.
      const payload = JSON.stringify({ criteria, classification, petitioner, caseId });
      const res = await fetch("/api/rfe/forecast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idem.current(payload),
        },
        body: payload,
      });
      if (res.status === 402) {
        onPaywall();
        setStatus("idle");
        return;
      }
      const data = (await res.json()) as RfeForecastResult | { error: string };
      if (!res.ok || "error" in data) {
        setStatus("error");
        return;
      }
      setChallenges(data.challenges);
      setDisclaimer(data.disclaimer);
      setStatus("done");
      // Fulfilled — a repeat forecast is a new charge.
      idem.rotate();
    } catch {
      setStatus("error");
    } finally {
      busy.current = false;
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="microprint" style={{ color: "var(--accent-dark)" }}>
          § RFE Risk Radar · predict the challenge before USCIS
        </div>
        <Badge tone="accent">AI-assisted</Badge>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="font-sans text-[15.5px] leading-relaxed text-muted-strong">
          See which criteria a USCIS officer is most likely to challenge — and
          reinforce the weakest before you file.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="primary" onClick={forecast} disabled={status === "loading"}>
            {status === "loading" ? "Forecasting…" : "Forecast RFE risk"}
            <span className="ml-2 rounded-full bg-background/15 px-1.5 py-0.5 font-mono text-[12px] tracking-document">
              {costOf("rfe")} tokens
            </span>
          </Button>
          <span className="microprint" style={{ color: "var(--muted)" }}>
            Informational · not legal advice
          </span>
        </div>

        {status === "loading" ? <Skeleton className="h-32" /> : null}

        {status === "error" ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-danger/40 bg-danger-soft/50 px-3 py-2 font-sans text-[14px] text-danger"
          >
            <span>Could not forecast RFE risk — please try again.</span>
            {/* Inline retry — re-runs the same forecast without re-charging until
                it succeeds (the failed attempt was reclaimed by the orchestrator). */}
            <Button type="button" variant="secondary" onClick={forecast}>
              Try again
            </Button>
          </div>
        ) : null}

        {status === "done" ? (
          <div className="space-y-3">
            {disclaimer ? <DisclaimerStamp text={disclaimer} /> : null}
            {challenges.length === 0 ? (
              <p className="font-sans text-[15px] italic text-muted-strong">
                No relied-on criteria to forecast yet.
              </p>
            ) : (
              challenges.map((c) => (
                <div
                  key={c.criterion}
                  className="rounded-control border border-border-strong bg-surface px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="display text-[16px]">{c.criterion}</span>
                    <Badge tone={riskTone(c.likelihood)}>{c.likelihood}% RFE risk</Badge>
                  </div>
                  {c.why ? (
                    <p className="mt-1.5 font-sans text-[14.5px] leading-snug text-foreground-soft">
                      {c.why}
                    </p>
                  ) : null}
                  {c.suggestedEvidence ? (
                    <p className="mt-1 font-sans text-[14px] italic leading-snug text-muted-strong">
                      Pre-empt it: {c.suggestedEvidence}
                    </p>
                  ) : null}
                  {reinforceable.has(c.criterion) ? (
                    <div className="mt-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => onReinforce(c.criterion)}
                        disabled={reinforcing !== null}
                      >
                        {reinforcing === c.criterion ? "Reinforcing…" : "Reinforce this section"}
                        <span className="ml-2 rounded-full bg-accent/15 px-1.5 py-0.5 font-mono text-[11px] tracking-normal text-accent-dark">
                          {costOf("draft_section")} tokens
                        </span>
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
