# Accepted gaps — the known-and-accepted baseline

Issues here are **suppressed**: a run must not re-surface them as findings. Each is something the
team has deliberately decided is out of scope for now (a demo/MVP boundary, an env-gated
production feature, or a documented stub). Append when the user accepts a new one.

> Honesty the build *flags itself* (a disclaimer, a "stubbed" label, a backlog note) is a
> **strength to keep**, not a defect. Never fabricate data to "fix" a finding.

## Deliberately-not-built / env-gated (scope, not defects)

- **Binary PDF/image upload + Document AI OCR** — the Evidence Vault categorizes from *pasted
  text*; binary upload + OCR is an env-gated production extension (`DOCAI_*` vars exist, unused
  locally). Pasting text is the supported local path.
- **Real DocuSign e-sign + real USCIS filing** — "Sign & file" records a receipt number and
  e-sign/USCIS submission as **review events / stubs**, not a real DocuSign envelope or a real
  USCIS submission. By design for the MVP.
- **Production attorney RBAC** — two-tier by design (verified, not loose): `isAttorney` (empty list
  → demo-unlock) gates only own-case **UI affordances**, while the review **queue** + sign/file
  **actions** gate on `isConfiguredAttorney` (**fail-closed**: empty list denies everyone, so no
  signed-in user can enumerate another applicant's case — `roles.ts:40`, `owner-only-gate.test.ts`).
  This fail-closed cross-tenant default is a **security strength to protect**, not a gap. Consequence
  for UAT: the attorney journey needs `ATTORNEY_EMAILS=developer@localhost` set (see `env.md`).
- **Mock demo case file** — the dashboard's built-in demo portfolio (`lib/data/cases.ts`) is
  illustrative mock data shown alongside the user's *real* cases; it is not meant to be editable.
- **Voice intake agent** (`VAPI_API_KEY` / `RETELL_API_KEY`) — not wired locally.
- **Live Polar purchases** — real token *purchases* need Polar sandbox config; the ledger / grant
  / debit / paywall all work without it. Use `TOKENS_BYPASS=1` or `/api/dev/grant-tokens` locally.

## Environment-shaped, not product defects

- **AI latency 15–130 s** via the local Claude CLI is expected for real generation; only an
  *unhandled* timeout / no progress affordance is a finding (see `env.md` latency budget).
- **UK / non-US programs** are **planned, not live** — the qualify selector gates to live US
  programs (O-1A / O-1B / EB-1A). A UK option being absent/locked is by design, not a gap.

## Format

```
- **<short title>** — <one line: what + why accepted>.  (accepted: <date> by <who>)
```

_(No run-accepted entries yet — the lists above are the initial MVP scope baseline derived from
the product notes.)_
