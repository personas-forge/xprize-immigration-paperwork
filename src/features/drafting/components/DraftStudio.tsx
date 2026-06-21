"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, CardBody, CardHeader, Skeleton } from "@/components/ui";
import { DisclaimerStamp, CitationNote, AdjudicationBadge } from "@/components/legal";
import { type AdjudicationReport } from "@/lib/llm/adjudication-gates";
import { RfeRiskRadar } from "@/features/rfe/components/RfeRiskRadar";
import { ExhibitIndex } from "./ExhibitIndex";
import {
  DISCLAIMER,
  attachExhibits,
  auditCitations,
  buildExhibitIndex,
  undraftedSupportedCriteria,
  type DraftSection,
  type SectionCritique,
  type VaultDocLike,
} from "@/features/drafting";
import { isModelSource, sourceLabel, type ModelSource } from "@/lib/llm/label";
import {
  copyDraftToClipboard,
  draftClipboardText,
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
// Generates a full petition letter (for the case's classification) from the
// scored criteria, then lets the
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
  /** Live adjudication-risk verdict (moonshot #1). */
  adjudication?: AdjudicationReport;
}

interface SectionApiResponse {
  section: DraftSection;
  disclaimer: string;
  source: ModelSource;
  /** The version the merged sections were persisted as (the orchestrator spreads
   *  the persist result, same as the full-draft response). null when nothing was
   *  saved (inline path / save failure). */
  version?: number | null;
  saveFailed?: boolean;
  adjudication?: AdjudicationReport;
}

interface CritiqueApiResponse {
  critiques: SectionCritique[];
  overallScore: number;
  disclaimer: string;
  source: ModelSource;
}

/** Below this section score, the adjudicator redline card is offered. */
const WEAK_SECTION_SCORE = 80;

export function DraftStudio({
  petitioner,
  classification = "O-1A",
  criteria,
  caseId = null,
  initialSections = null,
  initialSource = "mock",
  documents = [],
}: {
  petitioner: string;
  classification?: string;
  criteria: readonly DraftStudioCriterion[];
  caseId?: string | null;
  /** Hydrate with an already-saved draft (case detail view). */
  initialSections?: DraftSection[] | null;
  initialSource?: ModelSource;
  /** The case's vault documents — drives the exhibit index + citation audit. */
  documents?: readonly VaultDocLike[];
}) {
  const hasInitial = Boolean(initialSections && initialSections.length > 0);
  const [status, setStatus] = useState<Status>(hasInitial ? "done" : "idle");
  const [sections, setSections] = useState<DraftSection[]>(initialSections ?? []);
  const [source, setSource] = useState<ModelSource>(initialSource);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [regenerationError, setRegenerationError] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [adjudication, setAdjudication] = useState<AdjudicationReport | null>(null);
  // Adjudicator redline (moonshot #19): per-heading critique + overall score.
  const [critiques, setCritiques] = useState<Record<string, SectionCritique>>({});
  const [critiqueScore, setCritiqueScore] = useState<number | null>(null);
  const [critiqueStatus, setCritiqueStatus] = useState<"idle" | "loading" | "error">("idle");
  const [applying, setApplying] = useState<string | null>(null);
  // saveFailed recovery UI state (SaveFailedAlert). resolvedCaseId tracks the
  // case the SERVER persisted against (response caseId) — the retry must target
  // it, not just the incoming prop.
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [retryState, setRetryState] = useState<RetryState>("idle");
  const [resolvedCaseId, setResolvedCaseId] = useState<string | null>(caseId);
  // Explicit no-charge "Save edits" of the current sections (so plain textarea
  // edits aren't local-only). "saved" reverts to "idle" on the next edit.
  const [editSaveState, setEditSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // The last persisted version number, surfaced as a "Saved · vN" pill. A
  // generate / section-regenerate / explicit save / applied redline all write a
  // new version server-side; null until the first successful persist.
  const [version, setVersion] = useState<number | null>(null);
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

  // The exhibit index for THIS case (vault docs grouped per criterion, the same
  // binding the route uses to prompt) and a live audit of the current draft's
  // (Exhibit N) citations against it — recomputed as the user edits/regenerates.
  const exhibitIndex = useMemo(
    () =>
      buildExhibitIndex(
        attachExhibits(
          { petitioner: payload.petitioner, classification, criteria: payload.criteria },
          documents,
        ),
      ),
    // payload is rebuilt each render; depend on its stable inputs instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documents, classification, petitioner, criteria],
  );
  const audit = useMemo(
    () => auditCitations(sections, exhibitIndex.map((e) => e.number)),
    [sections, exhibitIndex],
  );
  const citedNumbers = useMemo(() => new Set(audit.resolved), [audit]);
  // Criteria that have a draft section the radar's Reinforce can regenerate.
  const reinforceable = useMemo(
    () => new Set(sections.map((s) => s.heading)),
    [sections],
  );
  // Criteria that carry support but did NOT become a section (only Met/Strong are
  // drafted) — surfaced so a mis-scored strong argument isn't silently dropped
  // from the letter (UAT 2026-06-20 LLM-4 / ng-draft-01).
  const undrafted = useMemo(() => undraftedSupportedCriteria(criteria), [criteria]);

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
      setAdjudication(data.adjudication ?? null);
      setResolvedCaseId(data.caseId ?? caseId);
      // A fresh draft is persisted server-side with a version; reflect it (and
      // clear any stale "Saved ✓" from a prior draft). null version → unsaved.
      const v = typeof data.version === "number" ? data.version : null;
      setVersion(v);
      setEditSaveState(v !== null ? "saved" : "idle");
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
        // Send the sections the user is CURRENTLY holding so the server merges the
        // regenerated section into THESE (preserving unsaved edits to other
        // sections), not into the last stored version.
        body: JSON.stringify({ ...payload, focus: heading, sections }),
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
      // Replace ONLY the first heading match — headings can collide, and
      // overwriting every match would clobber a distinct section (mirrors the
      // server-side mergeRegeneratedSection fix).
      setSections((prev) => {
        let replaced = false;
        return prev.map((s) => {
          if (!replaced && s.heading === heading) {
            replaced = true;
            return data.section;
          }
          return s;
        });
      });
      setSource(data.source);
      setSaveFailed(Boolean(data.saveFailed));
      setAdjudication(data.adjudication ?? null);
      setCopyState("idle");
      setRetryState("idle");
      // The server merged this section into the client's current sections and
      // saved a NEW version (v1 even when no draft was stored yet) — surface it
      // so the pill isn't a stale "Saved ✓" from before the regenerate and the
      // un-stored-draft case no longer silently stays version=null (#4/#5).
      const v = typeof data.version === "number" ? data.version : null;
      setVersion(v);
      setEditSaveState(v !== null ? "saved" : "idle");
    } catch {
      setRegenerationError(heading);
    } finally {
      setRegenerating(null);
      busyRef.current = false;
    }
  }

  async function runCritique() {
    if (busyRef.current) return; // charges tokens
    busyRef.current = true;
    setCritiqueStatus("loading");
    try {
      const res = await fetch("/api/draft/critique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sections,
          classification,
          petitioner: payload.petitioner,
          caseId: resolvedCaseId,
        }),
      });
      if (res.status === 402) {
        setStatus("paywall");
        return;
      }
      const data = (await res.json()) as CritiqueApiResponse | { error: string };
      if (!res.ok || "error" in data) {
        setCritiqueStatus("error");
        return;
      }
      const map: Record<string, SectionCritique> = {};
      for (const c of data.critiques) map[c.heading] = c;
      setCritiques(map);
      setCritiqueScore(data.overallScore);
      setCritiqueStatus("idle");
    } catch {
      setCritiqueStatus("error");
    } finally {
      busyRef.current = false;
    }
  }

  async function applyRedline(heading: string) {
    const c = critiques[heading];
    if (!c || busyRef.current) return;
    // Swap the improved body in locally and drop the now-resolved critique.
    const next = sections.map((s) =>
      s.heading === heading ? { ...s, body: c.improvedBody } : s,
    );
    setSections(next);
    setCritiques((prev) => {
      const n = { ...prev };
      delete n[heading];
      return n;
    });
    // Persist the accepted fix as a new version via the no-charge save path.
    if (!resolvedCaseId) return;
    busyRef.current = true;
    setApplying(heading);
    try {
      const result = await retrySaveDraft({ caseId: resolvedCaseId, sections: next, source });
      if (result.ok) {
        // Persisted — refresh the version pill instead of leaving a stale "Saved ✓".
        setVersion(result.version);
        setEditSaveState("saved");
      } else {
        setSaveFailed(true);
      }
    } finally {
      setApplying(null);
      busyRef.current = false;
    }
  }

  async function copyDraft() {
    const ok = await copyDraftToClipboard(sections, exhibitIndex);
    setCopyState(ok ? "copied" : "failed");
  }

  // Take the finished letter OUT of the app — the product's core deliverable. The
  // serializer (draftClipboardText, exhibit-indexed) already exists; this just
  // streams it as a .txt download so the attorney can pull the work product into
  // their filing workflow without screenshotting or re-typing.
  function downloadDraft() {
    const text = draftClipboardText(sections, exhibitIndex);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${classification}-petition-letter.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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

  async function saveEdits() {
    // No-charge persistence of the current sections via /api/draft/save (never
    // re-generates). Only meaningful for a persisted case; inline/demo has no caseId.
    if (busyRef.current || !resolvedCaseId) return;
    busyRef.current = true;
    setEditSaveState("saving");
    try {
      const result = await retrySaveDraft({ caseId: resolvedCaseId, sections, source });
      if (result.ok) {
        setVersion(result.version);
        setEditSaveState("saved");
      } else {
        setEditSaveState("error");
        setSaveFailed(true);
      }
    } finally {
      busyRef.current = false;
    }
  }

  function editBody(heading: string, body: string) {
    setRegenerationError(null);
    setEditSaveState("idle"); // a new edit means there are unsaved changes again
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
            <p className="font-sans text-[16px] leading-relaxed text-muted-strong">
              Draft a full {classification} petition letter from your scored
              criteria — an introduction, an argument for each qualifying
              criterion, and a conclusion. You can edit any section and
              regenerate it.
            </p>
            {caseId && documents.length === 0 ? (
              <p
                className="rounded-control border border-dashed border-border-strong bg-surface-muted/40 px-4 py-2.5 font-sans text-[14.5px] leading-snug"
                style={{ color: "var(--muted-strong)" }}
              >
                Tip: add your CV and evidence to the Evidence Vault first — the
                draft then cites your real exhibits and argues from your actual
                record, not just the screening summary.
              </p>
            ) : null}
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
                className="rounded-control border border-danger/40 bg-danger-soft/50 px-4 py-3 font-sans text-[15px] text-danger"
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
                <p className="mt-1 font-sans text-[15.5px] leading-snug text-foreground-soft">
                  Drafting a petition needs tokens. Top up to generate and revise
                  your letter.
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

        {status === "done" ? (
          <div className="space-y-4">
            <DisclaimerStamp text={DISCLAIMER} />
            <CitationNote />
            {adjudication ? <AdjudicationBadge report={adjudication} /> : null}
            {/* Export the finished letter on the HAPPY path (was only reachable via
                the save-failed alert) — the product's core deliverable. */}
            <div className="flex flex-wrap items-center gap-2.5">
              <Button type="button" variant="secondary" size="sm" onClick={copyDraft}>
                {copyState === "copied" ? "Copied ✓" : copyState === "failed" ? "Copy failed — retry" : "Copy letter"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={downloadDraft}>
                Download .txt
              </Button>
              <span className="microprint" style={{ color: "var(--muted)" }}>
                Plain text with an exhibit index — for your attorney&apos;s filing workflow.
              </span>
            </div>
            {exhibitIndex.length > 0 ? (
              <ExhibitIndex
                entries={exhibitIndex}
                citedNumbers={citedNumbers}
                unresolved={audit.unresolved}
                coverage={audit.coverage}
              />
            ) : null}
            {undrafted.length > 0 ? (
              <div
                role="note"
                className="rounded-control border border-dashed border-border-strong bg-surface-muted/40 px-4 py-3"
              >
                <div className="microprint" style={{ color: "var(--accent-dark)" }}>
                  Not drafted — review for a missed argument
                </div>
                <p
                  className="mt-1 font-sans text-[14.5px] leading-snug"
                  style={{ color: "var(--muted-strong)" }}
                >
                  The letter argues only the criteria scored <strong>Met</strong> or{" "}
                  <strong>Strong</strong>. These carry evidence but weren&apos;t drafted — if any is
                  actually a strong argument that was under-scored, re-screen or add it so the case
                  doesn&apos;t silently drop it:
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {undrafted.map((c) => (
                    <Badge key={c.name} tone="warning">
                      {c.name}
                      {c.status === "Partial" ? " · Partial" : ""}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
            {!isModelSource(source) ? (
              <div
                className="rounded-control border border-dashed border-border-strong bg-surface-muted/40 px-4 py-2.5"
                style={{ color: "var(--muted-strong)" }}
              >
                <span className="microprint">
                  Placeholder output — no AI engine configured; this is
                  deterministic template text for the attorney to replace.
                </span>
              </div>
            ) : null}
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
                className={`card-enter rounded-control border bg-surface px-4 py-3 ${
                  isModelSource(source) ? "border-accent/25" : "border-dashed border-border-strong"
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2.5">
                    <span className="display text-[17px] text-foreground">
                      {s.heading}
                    </span>
                    {critiques[s.heading] ? (
                      <Badge tone={scoreTone(critiques[s.heading].score)}>
                        {critiques[s.heading].score}/100
                      </Badge>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => regenerate(s.heading)}
                    disabled={regenerating !== null}
                    className="inline-flex items-center gap-1.5 font-mono text-[12px] uppercase tracking-document text-accent-dark transition-colors hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]"
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
                      <span className="rounded-full bg-accent/15 px-1.5 py-0.5 font-mono text-[11px] tracking-normal text-accent-dark">
                        5
                      </span>
                    ) : null}
                  </button>
                </div>
                {regenerationError === s.heading ? (
                  <div
                    role="alert"
                    className="mb-2 rounded-control border border-danger/40 bg-danger-soft/50 px-3 py-2 font-sans text-[14px] text-danger"
                  >
                    Regeneration failed — your previous text was kept
                  </div>
                ) : null}
                <textarea
                  value={s.body}
                  onChange={(e) => editBody(s.heading, e.target.value)}
                  rows={Math.max(3, Math.ceil(s.body.length / 90))}
                  className="w-full resize-y rounded-control border border-border-strong bg-surface px-3 py-2 font-sans text-[15.5px] leading-[1.7] text-foreground-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]"
                />
                {critiques[s.heading] && critiques[s.heading].score < WEAK_SECTION_SCORE ? (
                  <RedlineCard
                    critique={critiques[s.heading]}
                    applying={applying === s.heading}
                    onApply={() => applyRedline(s.heading)}
                  />
                ) : null}
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
              <Button
                type="button"
                variant="secondary"
                onClick={runCritique}
                disabled={critiqueStatus === "loading" || regenerating !== null}
              >
                {critiqueStatus === "loading" ? "Reviewing…" : "Adjudicator review"}
                <span className="ml-2 rounded-full bg-accent/15 px-1.5 py-0.5 font-mono text-[11px] tracking-normal text-accent-dark">
                  5
                </span>
              </Button>
              {resolvedCaseId ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={saveEdits}
                  disabled={regenerating !== null || editSaveState === "saving"}
                >
                  {editSaveState === "saving"
                    ? "Saving…"
                    : editSaveState === "saved"
                      ? version !== null
                        ? `Saved · v${version}`
                        : "Saved ✓"
                      : "Save edits"}
                </Button>
              ) : null}
              {critiqueScore !== null ? (
                <Badge tone={scoreTone(critiqueScore)}>
                  Draft quality {critiqueScore}/100
                </Badge>
              ) : null}
              <span className="microprint" style={{ color: "var(--muted)" }}>
                {resolvedCaseId
                  ? "Edits stay local until you Save (or regenerate a section); your attorney of record finalizes and signs."
                  : "Edits are local in this preview — your attorney of record finalizes and signs."}
              </span>
            </div>
            {critiqueStatus === "error" ? (
              <div
                role="alert"
                className="rounded-control border border-danger/40 bg-danger-soft/50 px-3 py-2 font-sans text-[14px] text-danger"
              >
                Could not run the adjudicator review — please try again.
              </div>
            ) : null}

            {/* RFE Risk Radar — predict the challenge before USCIS; Reinforce
                wires straight to the existing per-section regenerate. */}
            <RfeRiskRadar
              criteria={criteria}
              classification={classification}
              petitioner={payload.petitioner}
              caseId={resolvedCaseId}
              reinforceable={reinforceable}
              reinforcing={regenerating}
              onReinforce={regenerate}
              onPaywall={() => setStatus("paywall")}
            />
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

/** Map a 0-100 section/draft score to a badge tone. */
function scoreTone(score: number): "success" | "warning" | "danger" {
  if (score >= WEAK_SECTION_SCORE) return "success";
  if (score >= 60) return "warning";
  return "danger";
}

/**
 * Adjudicator redline card (moonshot #19) — the named weakness plus a one-click
 * Apply that swaps the improved rewrite into the section and saves it as a new
 * non-destructive version.
 */
function RedlineCard({
  critique,
  applying,
  onApply,
}: {
  critique: SectionCritique;
  applying: boolean;
  onApply: () => void;
}) {
  return (
    <div className="mt-2 rounded-control border-2 border-double border-seal/40 bg-seal-soft/30 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="microprint" style={{ color: "var(--seal)" }}>
          Adjudicator redline — weakness
        </span>
        <Button type="button" variant="primary" onClick={onApply} disabled={applying}>
          {applying ? "Applying…" : "Apply fix"}
        </Button>
      </div>
      <p className="mt-1.5 font-sans text-[14.5px] leading-snug text-foreground-soft">
        {critique.weakness}
      </p>
      {critique.improvedBody ? (
        <div className="mt-2 rounded-control border border-border-strong bg-surface px-3 py-2">
          <div className="microprint mb-1" style={{ color: "var(--accent-dark)" }}>
            Suggested rewrite
          </div>
          <p className="font-sans text-[14.5px] leading-[1.6] text-muted-strong">
            {critique.improvedBody}
          </p>
        </div>
      ) : null}
    </div>
  );
}
