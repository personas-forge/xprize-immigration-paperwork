/**
 * Extract the first *balanced* JSON object from a model response: the substring
 * from the first `{` to the `}` that closes it (NOT to the last `}` in the
 * string — see the brace-balancing loop below). Tolerates ```json fences and
 * surrounding prose; returns `null` when nothing parseable is found.
 *
 * Shared by every JSON-returning AI feature (qualification, drafting, rfe,
 * evidence) so the tolerant-parse behavior is defined — and tested — once.
 * Pure (no `server-only`, no Node built-ins), like config.ts and label.ts.
 */
export function extractJson(text: string): unknown {
  // Try each ```fence``` whose body actually contains a `{` (a model that emits
  // a non-JSON reasoning block — ```text```/```sql``` — BEFORE the real
  // ```json``` fence must not let the first fence shadow it), then fall back to
  // scanning the whole text. The first candidate that yields a balanced,
  // parseable object wins.
  const candidates: string[] = [];
  for (const m of text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) {
    if (m[1].includes("{")) candidates.push(m[1]);
  }
  candidates.push(text); // last resort: the raw text (covers unfenced JSON)
  for (const candidate of candidates) {
    const found = balancedObject(candidate);
    if (found !== UNPARSED) return found;
  }
  return null;
}

/** Sentinel distinct from any JSON value (incl. null) for "no object found". */
const UNPARSED = Symbol("unparsed");

/**
 * Extract the first *balanced* JSON object from `candidate`: the substring from
 * the first `{` to the `}` that closes it (NOT to the last `}` — that over-grabs
 * when the model appends a second snippet in prose, e.g. `{"a":1} note {"b":2}`).
 * Tracks string state so braces inside string values don't skew the depth.
 * Returns the parsed object, or the UNPARSED sentinel when none is found.
 */
function balancedObject(candidate: string): unknown {
  // Try each `{` start in turn: if the first opening brace never balances or its
  // slice doesn't parse, move to the next one (so a broken/partial brace earlier
  // in the text doesn't block a valid object that follows).
  for (let start = candidate.indexOf("{"); start !== -1; start = candidate.indexOf("{", start + 1)) {
    const found = parseObjectAt(candidate, start);
    if (found !== UNPARSED) return found;
  }
  return UNPARSED;
}

/** Parse the balanced object beginning at `start` (`candidate[start] === "{"`),
 *  tracking string state so braces inside string values don't skew the depth.
 *  Returns UNPARSED if it doesn't balance or doesn't parse. */
function parseObjectAt(candidate: string, start: number): unknown {
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
        return UNPARSED;
      }
    }
  }
  return UNPARSED;
}
