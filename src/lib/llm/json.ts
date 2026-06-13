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
  if (start === -1) return null;
  // Find the close brace that *balances* the first `{`, tracking string state so
  // braces inside string values don't skew the depth. Using lastIndexOf("}")
  // instead would over-grab when the model appends a second JSON snippet in
  // prose (e.g. `{"a":1} note {"b":2}`), yielding unparseable text.
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) {
      try {
        return JSON.parse(candidate.slice(start, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}
