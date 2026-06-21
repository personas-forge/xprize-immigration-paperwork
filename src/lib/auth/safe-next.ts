// Open-redirect guard for the post-auth `?next=` destination. The login flow
// captures the originally-requested path so a deep link survives the sign-in
// detour, but a raw `next` is a classic phishing pivot: `?next=https://evil/` or
// `?next=//evil` would bounce a just-authenticated user off-site. EVERY consumer
// of `next` must route through this — it accepts only a same-origin RELATIVE path.

const DEFAULT_NEXT = "/dashboard";

const BACKSLASH = String.fromCharCode(0x5c);

// Reject control chars, whitespace, and backslashes (used in `/\evil` tricks).
function hasUnsafeChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x20 || code === 0x5c) return true;
  }
  return false;
}

/**
 * Return `raw` only if it is a safe same-origin relative path, else `/dashboard`.
 * Accepts a single leading `/` that is NOT `//` (protocol-relative), and rejects
 * absolute URLs, backslash tricks, and control chars. Decodes once first so an
 * encoded `%2f%2fevil` can't slip through.
 */
export function safeNext(raw: string | null | undefined): string {
  if (typeof raw !== "string" || raw === "") return DEFAULT_NEXT;
  let value: string;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return DEFAULT_NEXT; // malformed percent-encoding
  }
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith(`/${BACKSLASH}`) ||
    hasUnsafeChar(value)
  ) {
    return DEFAULT_NEXT;
  }
  return value;
}
