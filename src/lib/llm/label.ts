/**
 * Client-safe helpers for the model "source" of an AI result.
 *
 * No `server-only`, no Node built-ins — safe to import from client components
 * and from the pure feature modules (which run on both server and client). The
 * actual engine implementation lives in `client.ts` (server-only).
 */

/** Where an AI payload came from: a template fallback, or a model engine. */
export type ModelSource = "mock" | "gemini" | "claude";

/** Display label for a source (used on the result badges). */
export function sourceLabel(source: string): string {
  if (source === "gemini") return "Gemini";
  if (source === "claude") return "Claude";
  return "Template";
}

/** True when the source is a real model engine (not the template fallback). */
export function isModelSource(source: string): source is "gemini" | "claude" {
  return source === "gemini" || source === "claude";
}

/** Narrow an unknown (e.g. a value read back from the DB) to a ModelSource. */
export function asModelSource(value: unknown): ModelSource {
  return value === "gemini" || value === "claude" ? value : "mock";
}
