import { NextResponse } from "next/server";
import { dbDriver, isMeteringEnforced } from "@/lib/db/config";
import { resolveEngine } from "@/lib/llm/config";
import { isPolarConfigured } from "@/lib/polar/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";

// Liveness + config-shape probe for uptime monitors and deploy smoke tests.
// Booleans/enum names ONLY — never a secret, never a user count. A 200 means
// "the process serves requests"; the body says which subsystems are wired so
// a misconfigured deployment (e.g. store without LLM key) is visible from the
// outside without shell access.
export function GET(): NextResponse {
  return NextResponse.json(
    {
      ok: true,
      store: dbDriver(), // "firestore" | "pglite" | null (keyless)
      metering: isMeteringEnforced(),
      llm: resolveEngine(), // "gemini" | "claude" | null (template fallback)
      polar: isPolarConfigured(),
      firebaseAuth: isFirebaseConfigured(),
    },
    // Config state must never be cached by an intermediary.
    { headers: { "cache-control": "no-store" } },
  );
}
