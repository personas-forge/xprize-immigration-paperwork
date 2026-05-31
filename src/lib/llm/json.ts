/**
 * Extract the first JSON object from a model response. Tolerates ```json fences
 * and surrounding prose; returns `null` when nothing parseable is found.
 *
 * Shared by every JSON-returning AI feature (qualification, drafting, rfe,
 * evidence) so the tolerant-parse behavior is defined — and tested — once.
 * Pure (no `server-only`, no Node built-ins), like config.ts and label.ts.
 */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}
