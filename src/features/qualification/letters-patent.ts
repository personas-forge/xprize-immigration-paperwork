/**
 * Shareable "Letters Patent of Extraordinary Ability" (moonshot #18).
 *
 * A screening result is minted into a public, immutable snapshot encoded
 * ENTIRELY in an unguessable URL token — no database row required. The token
 * carries only the postable facts (name, classification, likelihood, per-
 * criterion status in pack order); never the profile text. The public /c/[token]
 * page and its per-result Open Graph image decode the token and render the
 * certificate from the SAME criteria pack, so the card can't drift from the
 * product's real criteria.
 *
 * Pure + runtime-agnostic (browser btoa/atob + TextEncoder, also present in
 * Node 18+ and edge) so the share button encodes client-side and the page / OG
 * route decode server-side from one shared codec.
 */

import { type Classification, packFor } from "./packs";
import { isLiveProgram } from "./jurisdictions";
import { type ScoreStatus } from "./qualification";

/** The minimal, non-sensitive snapshot a Letters Patent shows. */
export interface PatentSnapshot {
  name: string;
  classification: Classification;
  /** 0-100. */
  likelihood: number;
  /** Per-criterion status, in the pack's criterion order. */
  statuses: ScoreStatus[];
}

const STATUS_CHAR: Record<ScoreStatus, string> = {
  Met: "M",
  Strong: "S",
  Partial: "P",
  None: "N",
};
const CHAR_STATUS: Record<string, ScoreStatus> = {
  M: "Met",
  S: "Strong",
  P: "Partial",
  N: "None",
};

const MAX_NAME = 80;

function clampLikelihood(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

// — runtime-agnostic base64url (no Buffer; works in browser/node/edge) ─────────

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(token: string): string {
  const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Encode a snapshot into a compact, URL-safe token. */
export function encodeSnapshot(snapshot: PatentSnapshot): string {
  const compact = {
    n: snapshot.name.slice(0, MAX_NAME),
    c: snapshot.classification,
    l: clampLikelihood(snapshot.likelihood),
    s: snapshot.statuses.map((st) => STATUS_CHAR[st] ?? "N").join(""),
  };
  return toBase64Url(JSON.stringify(compact));
}

/**
 * Decode a token back into a snapshot, or null when it is malformed, names a
 * non-live program, or its status count doesn't match the pack (so a tampered
 * token can't render a bogus criteria coat-of-arms).
 */
export function decodeSnapshot(token: string): PatentSnapshot | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(token));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  if (!isLiveProgram(o.c)) return null;
  const classification = o.c as Classification;
  const pack = packFor(classification);
  const chars = typeof o.s === "string" ? [...o.s] : [];
  if (chars.length !== pack.criteria.length) return null;
  const statuses = chars.map((ch) => CHAR_STATUS[ch] ?? "None");
  const name =
    typeof o.n === "string" && o.n.trim() !== "" ? o.n.trim().slice(0, MAX_NAME) : "Applicant";
  return { name, classification, likelihood: clampLikelihood(o.l), statuses };
}

/** Build a snapshot from a screening result's criteria + likelihood. */
export function snapshotFromResult(input: {
  name: string;
  classification: Classification;
  likelihood: number;
  criteria: readonly { status: string }[];
}): PatentSnapshot {
  return {
    name: input.name,
    classification: input.classification,
    likelihood: input.likelihood,
    statuses: input.criteria.map((c) =>
      c.status === "Met" || c.status === "Strong" || c.status === "Partial" || c.status === "None"
        ? (c.status as ScoreStatus)
        : "None",
    ),
  };
}

/** The number of qualifying (Met/Strong) criteria in a snapshot. */
export function snapshotQualifying(snapshot: PatentSnapshot): number {
  return snapshot.statuses.filter((s) => s === "Met" || s === "Strong").length;
}
