"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { encodeSnapshot, snapshotFromResult } from "../letters-patent";
import { type Classification } from "../packs";

// Share affordance (moonshot #18): mint the screening result into a Letters
// Patent URL (the snapshot is encoded in the token — no DB) and offer copy-link
// + share-to-LinkedIn. Only the statuses/likelihood/name travel, never the
// profile text.

export function LettersPatentShare({
  name,
  classification,
  likelihood,
  criteria,
}: {
  name: string;
  classification: Classification;
  likelihood: number;
  criteria: readonly { status: string }[];
}) {
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");

  function shareUrl(): string {
    const token = encodeSnapshot(
      snapshotFromResult({ name: name || "Applicant", classification, likelihood, criteria }),
    );
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/c/${token}`;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl());
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
  }

  const linkedIn = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl())}`;

  return (
    <div className="flex flex-col gap-3 rounded-control border-2 border-double border-accent/30 bg-accent-soft/25 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="microprint" style={{ color: "var(--accent-dark)" }}>
          Share your Letters Patent
        </div>
        <p className="mt-1 font-sans text-[15px] leading-snug text-foreground-soft">
          Mint this result as a sealed, public certificate — it unfurls as an
          engraved card on LinkedIn and X.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="secondary" onClick={copyLink}>
          {copied === "copied" ? "Link copied ✓" : copied === "failed" ? "Copy failed" : "Copy link"}
        </Button>
        <a
          href={linkedIn}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-control bg-accent px-4 py-2.5 font-mono text-[13px] uppercase tracking-document text-background transition-[background-color,transform] hover:bg-[color:var(--accent-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40 active:translate-y-[1px]"
        >
          Share
          <span aria-hidden>→</span>
        </a>
      </div>
    </div>
  );
}
