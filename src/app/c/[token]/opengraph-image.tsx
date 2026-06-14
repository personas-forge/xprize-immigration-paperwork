import { ImageResponse } from "next/og";
import { packFor } from "@/features/qualification";
import {
  decodeSnapshot,
  snapshotQualifying,
} from "@/features/qualification/letters-patent";

// Per-result Open Graph card (moonshot #18) — drawn server-side so each Letters
// Patent unfurls as a unique, engraved certificate on LinkedIn/X. Decoded from
// the URL token; falls back to a generic card if the token is malformed.

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand palette (globals.css tokens aren't available to Satori — mirror them).
const PARCHMENT = "#f4efe3";
const INK = "#2b2622";
const MUTED = "#6b6258";
const SEAL = "#7c2d3a";
const ACCENT = "#b8893a";

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const snap = decodeSnapshot(token);

  const name = snap?.name ?? "Extraordinary Ability";
  const classification = snap?.classification ?? "O-1";
  const likelihood = snap?.likelihood ?? 0;
  const total = snap ? packFor(snap.classification).criteria.length : 8;
  const qualifying = snap ? snapshotQualifying(snap) : 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: PARCHMENT,
          color: INK,
          fontFamily: "Georgia, serif",
          border: `16px double ${ACCENT}`,
          padding: "48px 64px",
        }}
      >
        {/* Seal ring */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 96,
            height: 96,
            borderRadius: 96,
            border: `3px solid ${SEAL}`,
            color: SEAL,
            fontSize: 34,
            fontStyle: "italic",
          }}
        >
          IC
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 20,
            fontSize: 22,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: ACCENT,
          }}
        >
          Certificate of Extraordinary Ability
        </div>

        <div style={{ display: "flex", marginTop: 12, fontSize: 68, fontWeight: 600 }}>
          {name}
        </div>

        <div style={{ display: "flex", marginTop: 8, fontSize: 28, fontStyle: "italic", color: MUTED }}>
          {classification} · United States
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", marginTop: 40, gap: 64 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", fontSize: 88, fontWeight: 700, color: SEAL }}>
              {likelihood}%
            </div>
            <div style={{ display: "flex", fontSize: 22, color: MUTED }}>likely to qualify</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", fontSize: 88, fontWeight: 700 }}>
              {qualifying}/{total}
            </div>
            <div style={{ display: "flex", fontSize: 22, color: MUTED }}>criteria supported</div>
          </div>
        </div>

        <div style={{ display: "flex", marginTop: 44, fontSize: 22, color: MUTED }}>
          Screen yourself free — immigration-paperwork.app
        </div>
      </div>
    ),
    size,
  );
}
