// Fire-and-forget beacon from an error boundary to /api/client-error, so a
// client crash is visible in the server log stream (Vercel function logs /
// Cloud Run stdout) — not only in the victim's devtools console. sendBeacon
// survives the page teardown a crash often precedes; fetch(keepalive) is the
// fallback. Must never itself throw inside a boundary.
export function reportClientError(
  boundary: string,
  error: Error & { digest?: string },
): void {
  try {
    const payload = JSON.stringify({
      boundary,
      message: String(error?.message ?? error).slice(0, 500),
      digest: error?.digest ?? "",
      path: window.location.pathname,
    });
    if (navigator.sendBeacon?.("/api/client-error", payload)) return;
    void fetch("/api/client-error", {
      method: "POST",
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* reporting is best-effort by definition */
  }
}
