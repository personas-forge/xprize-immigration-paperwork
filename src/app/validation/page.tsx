import type { Metadata } from "next";
import { PageFrame, ChapterMark } from "@/components/brand";
import { Badge, Card, CardBody, CardHeader, type BadgeTone } from "@/components/ui";
import { Rise } from "@/components/Motion";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import {
  COMPLIANCE_VALIDATIONS,
  JURISDICTIONS,
  PROGRAM_VALIDATIONS,
  REVALIDATE_AFTER_DAYS,
  VISA_PACKS,
  freshnessOf,
  stalePrograms,
  todayIso,
  type Classification,
  type JurisdictionCode,
  type SourceRef,
  type ValidationRecord,
  type ValidationStatus,
} from "@/features/qualification";

export const metadata: Metadata = {
  title: "Validation & sources — Immigration Concierge",
  description:
    "How each visa program and compliance claim is validated against primary legal sources — status, citations, and review dates. Not legal advice.",
};

// Request-time so the freshness read-out reflects today, not the build date.
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<ValidationStatus, BadgeTone> = {
  verified: "success",
  "needs-review": "warning",
};

const SOURCE_KIND_LABEL: Record<SourceRef["kind"], string> = {
  "primary-law": "Primary law",
  "agency-guidance": "Agency guidance",
  "court-order": "Court order",
  secondary: "Secondary",
};

export default function ValidationPage() {
  const now = todayIso();
  // Live programs whose validation record is overdue. By contract (see
  // `stalePrograms`) runtime does NOT withdraw them — CI is the hard pre-deploy
  // gate — but we surface an honest banner so an overdue-in-production state is
  // visible to anyone reading the page, not silently served as current.
  const stale = stalePrograms(now);

  return (
    <PageFrame>
      <SiteHeader />

      <section className="mx-auto max-w-4xl px-8 pb-16 pt-16">
        {stale.length > 0 ? (
          <div
            role="status"
            className="mb-8 rounded-control border border-danger/40 bg-danger-soft/50 px-4 py-3 font-sans text-[15px] text-danger"
          >
            <strong>Re-verification overdue:</strong> {stale.join(", ")} —{" "}
            {stale.length === 1 ? "this program's" : "these programs'"} validated
            rule-set passed its {REVALIDATE_AFTER_DAYS}-day review window. The rules
            are still as last verified; we are re-confirming them against primary
            sources.
          </div>
        ) : null}
        <Rise>
          <ChapterMark numeral="VI" label="Validation & sources" />
          <h1 className="display mt-5 text-[clamp(2.2rem,5.5vw,3.8rem)]">
            How we keep each state <em>correct</em>
          </h1>
          <p className="mt-6 max-w-2xl font-sans text-[16px] leading-relaxed text-muted-strong">
            Every visa program and compliance claim is checked against primary
            legal sources, with a citation and a review date. Correctness has{" "}
            <strong>two layers</strong>: <em>verified</em> means it matches the
            primary sources; <em>counsel-approved</em> means a licensed attorney
            or adviser of record has signed off on this program&apos;s rule-set.
            Every individual petition is separately reviewed and signed by{" "}
            <em>your</em> attorney of record before filing.{" "}
            <strong>Verified is not legal advice.</strong>
          </p>
        </Rise>

        <Rise className="mt-8">
          <Legend />
        </Rise>

        {/* Jurisdictions and their programs */}
        {(Object.keys(JURISDICTIONS) as JurisdictionCode[]).map((code) => (
          <Rise key={code} className="mt-10">
            <JurisdictionBlock code={code} now={now} />
          </Rise>
        ))}

        {/* Compliance claims that underpin the US market */}
        <Rise className="mt-10">
          <h2 className="display text-2xl">Compliance basis</h2>
          <p className="mt-1 font-sans text-[16px] italic text-muted-strong">
            The legal claims the US market rests on.
          </p>
          <div className="mt-4 space-y-4">
            {Object.keys(COMPLIANCE_VALIDATIONS).map((key) => (
              <ValidationCard
                key={key}
                title={COMPLIANCE_VALIDATIONS[key].title ?? key}
                record={COMPLIANCE_VALIDATIONS[key]}
                now={now}
              />
            ))}
          </div>
        </Rise>

        <Rise className="mt-12">
          <p className="microprint" style={{ color: "var(--muted)" }}>
            Records are re-verified at least every {REVALIDATE_AFTER_DAYS} days, or
            on any regulatory change. This page is informational and is not legal
            advice.
          </p>
        </Rise>
      </section>

      <SiteFooter />
    </PageFrame>
  );
}

function JurisdictionBlock({ code, now }: { code: JurisdictionCode; now: string }) {
  const j = JURISDICTIONS[code];
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="display text-2xl">{j.label}</h2>
        <Badge tone={j.status === "live" ? "success" : "neutral"}>
          {j.status === "live" ? "Live" : "Planned"}
        </Badge>
      </div>
      <p className="mt-1 font-sans text-[15.5px] leading-relaxed text-muted-strong">
        Representation: {j.representationRole}. {j.representationNote}
      </p>
      <div className="mt-4 space-y-4">
        {j.programs.map((program) => (
          <ValidationCard
            key={program}
            title={`${program} — ${VISA_PACKS[program as Classification].label}`}
            record={PROGRAM_VALIDATIONS[program as Classification]}
            now={now}
          />
        ))}
      </div>
    </div>
  );
}

// Progress bar encoding elapsed-vs-180-day window, colored by freshness level,
// with a days-remaining countdown. Uses freshnessOf()'s daysLeft + level.
function FreshnessBar({
  daysLeft,
  level,
  dueBy,
  unverifiable,
}: {
  daysLeft: number;
  level: "fresh" | "due-soon" | "stale";
  dueBy: string;
  unverifiable: boolean;
}) {
  // An unverifiable date has a NaN countdown; show the bar full (overdue) rather
  // than a NaN width, and label it plainly instead of "NaN days".
  const pct = unverifiable
    ? 100
    : Math.max(
        0,
        Math.min(100, ((REVALIDATE_AFTER_DAYS - daysLeft) / REVALIDATE_AFTER_DAYS) * 100),
      );
  const bar =
    level === "stale" ? "bg-danger" : level === "due-soon" ? "bg-warning" : "bg-success";
  const label = unverifiable
    ? "Last-verified date is unreadable — treated as overdue"
    : level === "stale"
      ? `Re-verify due · ${Math.abs(daysLeft)}d overdue`
      : `${daysLeft} days until re-verify`;
  return (
    <div className="space-y-1">
      <span className="microprint" style={{ color: "var(--muted-strong)" }}>
        {label}
      </span>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
        role="meter"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={label}
        aria-label="Freshness — elapsed since last verification"
      >
        <div
          className={`h-full rounded-full ${bar} transition-[width] duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="microprint block" style={{ color: "var(--muted)" }}>
        {unverifiable ? "re-verify immediately" : `re-verify by ${dueBy}`}
      </span>
    </div>
  );
}

function ValidationCard({
  title,
  record,
  now,
}: {
  title: string;
  record: ValidationRecord;
  now: string;
}) {
  const freshness = freshnessOf(record, now);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-wrap gap-y-2 bg-surface-muted/60">
        <div className="font-sans text-[17px] text-foreground">{title}</div>
        <div className="flex flex-wrap items-center gap-2">
          {/* When a record is overdue (or its date is unreadable), the freshness
              state overrides the green "verified" tone so the most prominent
              badge can't read as authoritatively current while the rule is stale. */}
          <Badge
            tone={freshness.level === "stale" ? "danger" : STATUS_TONE[record.status]}
          >
            {record.status}
          </Badge>
          {freshness.level === "stale" ? (
            <Badge tone="danger">
              {freshness.unverifiable ? "Date unreadable" : "Re-verify overdue"}
            </Badge>
          ) : null}
          <Badge tone={record.counselApproved ? "success" : "neutral"}>
            {record.counselApproved ? "Counsel signed" : "Counsel pending"}
          </Badge>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <Field label="Legal basis">
            <span className="doc-number text-[14.5px] text-foreground">
              {record.legalBasis}
            </span>
          </Field>
          {record.threshold ? (
            <Field label="Threshold">{record.threshold}</Field>
          ) : null}
          <Field label="Last reviewed">{record.lastVerified}</Field>
          <Field label="Freshness">
            <FreshnessBar
              daysLeft={freshness.daysLeft}
              level={freshness.level}
              dueBy={freshness.dueBy}
              unverifiable={freshness.unverifiable}
            />
          </Field>
        </dl>

        <div>
          <div className="microprint mb-1.5" style={{ color: "var(--accent-dark)" }}>
            Sources
          </div>
          <ul className="space-y-1.5">
            {record.sources.map((s) => (
              <li key={s.url} className="flex items-start gap-2">
                <Badge tone="neutral">{SOURCE_KIND_LABEL[s.kind]}</Badge>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ink-link font-sans text-[15.5px] text-foreground-soft focus-ring"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {record.notes ? (
          <p className="rounded-control border border-border bg-background-tint/40 px-3 py-2 font-sans text-[14.5px] leading-relaxed text-muted-strong">
            {record.notes}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="microprint shrink-0">{label}:</span>
      <span className="font-sans text-[15.5px] text-foreground-soft">{children}</span>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-control border border-border bg-surface px-4 py-3">
      <span className="microprint" style={{ color: "var(--accent-dark)" }}>
        Status
      </span>
      <LegendItem tone="success" label="verified — matches primary sources" />
      <LegendItem tone="warning" label="needs-review" />
      <LegendItem tone="success" label="counsel signed — cleared to file" />
      <LegendItem tone="neutral" label="counsel pending" />
    </div>
  );
}

function LegendItem({ tone, label }: { tone: BadgeTone; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Badge tone={tone}>•</Badge>
      <span className="font-sans text-[14.5px] text-muted-strong">{label}</span>
    </span>
  );
}

