import { NextResponse } from "next/server";

// Client-error beacon (minimal error visibility, CP1 item 24): the error
// boundaries sendBeacon here so an unhandled CLIENT crash leaves a structured
// line in the SERVER log stream (the one place an operator actually looks —
// Vercel function logs / Cloud Run stdout). Deliberately tiny: no auth (the
// crash may be pre-auth), hard caps on size, never throws, and it logs only
// what the boundary sends — no cookies, no headers, no PII beyond the URL.
const MAX_FIELD = 500;

const s = (v: unknown): string =>
  typeof v === "string" ? v.slice(0, MAX_FIELD) : "";

export async function POST(request: Request): Promise<NextResponse> {
  let body: Record<string, unknown> = {};
  try {
    const raw = await request.text();
    if (raw.length <= 4_096) body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    /* malformed beacon — still log the arrival below */
  }
  console.error(
    JSON.stringify({
      kind: "client-error",
      at: new Date().toISOString(),
      boundary: s(body.boundary),
      message: s(body.message),
      digest: s(body.digest),
      path: s(body.path),
    }),
  );
  return NextResponse.json({ ok: true });
}
