# L1 review — Priscilla Osei, in-house GC (vendor diligence)

- **Character:** `priscilla-osei-startup-gc` · **segment:** prospect-buyer (external economic buyer / vendor diligence)
- **Journeys walked:** evaluate-as-prospect, qualify-verdict, share-verdict
- **Date:** 2026-06-20 · **cert_level:** L1 (theoretical, no browser)

Reachability note: every surface in my binding (`/`, `/faq`, `/validation`, `/billing`, `/pricing`→`/billing`, `/landing-claude`, `/qualify`, `/c/[token]`) is **public and reachable** for a cold prospect — no auth, no attorney gating, no live-program gating in my path. I never touch the queue/sign/file walls, so nothing in my verdict is `unreachable`. The one nuance: the landing **Instant Verdict** runs the keyless *mock* (`/api/qualify/preview`) — the real model screening sits behind sign-in. I judge the public mock as what a prospect actually sees.

---

## Journey 1 — evaluate-as-prospect · verdict: **L1-conditional**

**Grounding score:** n/a (non-AI surface). **Est. time-saved-if-it-worked:** the whole eval — a credible self-serve diligence pass that replaces a sales call + a back-and-forth security questionnaire; minutes vs a multi-week vendor review, *if* the security story held.

**Walkthrough.** I land cold from the founder's link. Within ~30 seconds the positioning is unmistakable and — to the build's credit — **identical** across every masthead I check: "a drafting tool, **not a law firm**," "*your* attorney of record reviews and signs," "never legal advice." The landing hero says it (`page.tsx:154-157`, Promise III `page.tsx:254-255`), the FAQ leads with it (`faq/page.tsx:27,31,43`), billing footnotes it (`billing/page.tsx:163-165`), the alt masthead carries it in the footer (`landing-claude/page.tsx:201`), and `/qualify` repeats it inline (`qualify/page.tsx:36-37`). The `/pricing` route doesn't show a stale fee schedule — it 301s straight to `/billing` (`pricing/page.tsx:8`), so I can't be quoted two prices; I notice and approve. Pricing is fully self-serve and **canonical**: the bundle cards on the landing and billing pages both render from `economy.ts` `BUNDLES` (`page.tsx:13,357` / `billing/page.tsx:108`), the per-op costs render from the metering registry (`billing/page.tsx:146`, `costOf`), so the "$5 / $15 / $48 / $150" and the "qualify 3 / draft 12 / RFE 5" can't drift from what actually charges. No "contact sales" wall on the core offer — only Enterprise is contact-only (`billing/page.tsx:127`), which is exactly where I'd expect it and not a peeve. Refund/chargeback terms are stated (`faq` Q7 `:51`, `billing` Refunds footnote `:166-169`). The **validation page is the highlight**: it's not adjectives, it's a cited evidence table — 8 CFR 214.2(o)(3)(iii) and the USCIS Policy Manual vol. 2 part M for O-1A with the 3-of-8 threshold and a freshness countdown (`validation.ts:55-78`), EB-1A mapped verbatim to 204.5(h)(3)(i)-(x) (`validation.ts:103-126`), an honest **"Counsel pending"** badge on every record (`validation/page.tsx:203-205`, `counselApproved:false`), and — the thing I specifically came to find — the **Arizona ABS** posture named with the actual Supreme Court order R-20-0034 as a primary "court-order" source (`validation.ts:178-201`). That tells me *why* a software-licensed-to-an-attorney-owned-firm is allowed to exist; I can defend that to my board.

**Where it breaks for me.** The single load-bearing answer for a GC — **FAQ Q8, data security** — reads exactly like the posture I want on the page (`faq/page.tsx:55`: "AES-256 at rest, TLS 1.3 in transit, U.S.-based servers, every access logged, we don't train models on your data, export or hard-delete everything at any time"). But I diligence claims against code, not copy, and **none of these four claims are backed by anything in the repo**:

- **Encryption at rest / in transit:** there is no encryption code anywhere — no AES, no KMS, no field-level crypto. Data lands in plaintext PGlite locally (`lib/db/pglite-store.ts`) or Firestore in prod (`lib/db/firestore-store.ts`); "AES-256 at rest / TLS 1.3" is an unbacked assertion. (`confirmed-absent` — grep for `AES|encrypt|TLS` returns only the FAQ string itself.)
- **"Every access is logged":** there IS an audit subscriber (`events/subscribers/audit-log.ts`), but it logs domain *mutations* (CaseStatusChanged / DraftGenerated / EvidenceUploaded) — not data **access/reads** — and its default sink is `console.info` to stdout (`audit-log.ts:22-23`), not a durable, queryable access log. The FAQ's "every access is logged" overstates what exists.
- **"Export or hard-delete everything at any time":** the only "export" in the build is `casesToCsv` — a CSV of the case *list* (file number, petitioner, status, attorney) (`case-file/export.ts:33-49`), **not** a full PII/data export. And there is **no hard-delete path**: the only delete is `removeCaseDocument` (one vault doc) (`db/store.ts:260`, `pglite-store.ts:716`); no account/case purge, no "delete everything," no DSAR endpoint. (`confirmed-absent`.)
- **"We don't train models on your data":** true in effect (the LLM wrapper just calls the model), but it's a **policy claim with no DPA, no privacy policy, and no terms page anywhere** to bind it (no `/privacy`, `/terms`, `/dpa`, `/security` route exists). "U.S.-based servers" likewise has no region pin in the Firestore config.

This is precisely the pattern that has burned me before: a real-sounding security paragraph with no policy document behind it and no code that does what it says. I would not sign an order form on this paragraph, and I'd send it back as my single biggest blocker. (Note: this is *narrower* than "the product is insecure" — it's an **MVP that overclaims its security posture in customer-facing copy**; the honest move is to soften the FAQ to what's true, or build+document the posture.)

**Findings:** PO-EVAL-01 (blocker), PO-EVAL-02 (minor), PO-EVAL-03 (minor/strength-adjacent).

---

## Journey 2 — qualify-verdict · verdict: **L1-pass**

**Grounding score:** **2/2 on the public path** (the two inputs that matter — the pasted profile and the selected classification — both reach the engine). On the *authenticated* model path: the prompt receives the full pasted profile + the correct per-classification criteria pack = the real grounding (the keyless preview is a keyword heuristic by design and labeled as such). **Est. time-saved-if-it-worked:** an honest free read on a real candidate in <2 min vs emailing the outside firm for a "is this person O-1-able?" gut check (days, and a relationship cost).

**Walkthrough.** I run the screener on a real engineer to see if the engine flatters to sell. The public Instant Verdict posts to `/api/qualify/preview`, which is **deliberately the keyless deterministic mock** — no model, no charge, no DB, always labeled `source:"mock"` (`preview/route.ts:14-24,69-70`) — and the SoftGate is **honest about it**: "This was an instant keyword read… the full screening reads your whole record in depth" (`InstantVerdict.tsx:273-277`). That candor is exactly what I want from a vendor; it isn't pretending the free tier is the deep product. The criteria/threshold model is correct and **per-pack** (O-1A = 8 / threshold 3, EB-1A = 10 / 3, O-1B = 6 / 3 — `packs.ts:90-168`), the report passes the pack's own threshold so EB-1A doesn't misreport (`CriteriaReport.tsx:30-43,196-199`), and an unscored **"None" criterion never renders green** (it counts toward neither `summarizeCriteria` nor the success accent — `qualification.ts:32-33`, `CriteriaReport.tsx:20-26`). The authenticated prompt is genuinely sober: it forbids inventing facts ("Base every score ONLY on what the user actually describes," `qualification.ts:133-134`) and forbids one criterion's evidence satisfying another (`:136-138`) — anti-flatter by construction — and pastes my **real profile verbatim** into the prompt (`:159-161`). The `DISCLAIMER` renders first and non-dismissible on the result (`CriteriaReport.tsx:47-48`), and the result tells me what's next (open a case / go deeper). For my "would I let this touch an employee's record?" bar, the design clears it — *subject to L2 confirming the live model is as sober as the prompt instructs.*

**Honest caveat (not a finding).** The public verdict a prospect first sees is the *keyword mock*, which can over- or under-score on naive keyword presence (e.g. ORIGINAL fires on "github"/"shipped", `packs.ts:67`). It's labeled "instant keyword read," so it isn't a flatter-to-sell lie — but the felt honesty I'd actually stake an adoption on lives on the authenticated model path, which is L2's to verify live.

**Findings:** PO-QUAL-01 (strength), PO-QUAL-02 (minor — stale `/qualify` metadata).

---

## Journey 3 — share-verdict · verdict: **L1-pass**

**Grounding score:** n/a (non-AI; deterministic codec). **Est. time-saved-if-it-worked:** the lead-gen artifact a candidate forwards internally — worth $0 to me as a buyer except as a *risk* surface (does it overclaim or leak?), which is exactly how I read it.

**Walkthrough.** I ask the question a GC asks of any shareable artifact: does it leak PII, and does it read as a legal *grant* a candidate could wave around? Both answers are clean. The token encodes **only** name, classification, likelihood, and per-criterion status chars — the comment and the `compact` object explicitly **omit the profile text** (`letters-patent.ts:21-29,69-77`; share component reiterates "never the profile text," `LettersPatentShare.tsx:8-11`). It decodes from the token alone — **no DB row** (`letters-patent.ts:84-102`, `c/[token]/page.tsx:43-46`) — and rejects a tampered token whose status count doesn't match the live pack (`:97`), so nobody can forge a bogus coat-of-arms. The framing is **informational, not a grant**: the page stamps "Qualifies / In progress" (not "Approved/Granted"), reads "Certificate of Extraordinary Ability," and carries "Informational only · not legal advice · no account needed" (`c/[token]/page.tsx:119,124-131`). Nothing here would embarrass me if an employee or my outside firm saw it. The one nit: the share affordance renders for *every* finished result, including below-threshold ones (`InstantVerdict.tsx:201-206`) — but since the card honestly shows "In progress" for those, it doesn't overclaim, so I let it pass.

**Findings:** PO-SHARE-01 (strength).

---

## Findings table

| id | journey | type | severity | dimension | impact (f/r/t) | title | code_check | verdict |
|---|---|---|---|---|---|---|---|---|
| PO-EVAL-01 | evaluate-as-prospect | trust | **blocker** | trust | high/high/high | FAQ data-security answer makes 4 specific claims (AES-256/TLS, access-logged, no-train, export/hard-delete) that nothing in code backs | confirmed-absent | confirmed |
| PO-EVAL-02 | evaluate-as-prospect | missing-feature | minor | missing | med/high/med | No privacy policy / terms / DPA / security page to bind the security & "we don't train on your data" claims | confirmed-absent | confirmed |
| PO-EVAL-03 | evaluate-as-prospect | trust | minor | trust | low/high/low | "Every access is logged" overstates the audit subscriber, which logs mutations to stdout, not access/reads | present-broken | confirmed |
| PO-QUAL-01 | qualify-verdict | strength | polish | trust | — | Screener is honest by construction: keyless preview labeled "keyword read", anti-fabrication/anti-cross-credit prompt, per-pack threshold, "None" never green, disclaimer-first | by-design | confirmed |
| PO-QUAL-02 | qualify-verdict | confusion | minor | clarity | low/med/low | `/qualify` page metadata still says "O-1A self-screening / eight criteria" though the page leads with multi-program best-path | present-but-missed | confirmed |
| PO-SHARE-01 | share-verdict | strength | polish | trust | — | Share token leaks no profile/PII, renders DB-free, rejects tampering, frames as informational not a legal grant | by-design | confirmed |

---

## First-person review — in Priscilla's voice

I came in cold and adversarial, the way I come into every "AI for legal" pitch a founder forwards me, and I expected to kill it in one read. I almost didn't — and that surprised me.

The positioning is the cleanest I've seen from this category. Most of these vendors smudge the "who signs" line because the blur is the business model; this one says "drafting tool, not a law firm, *your* attorney of record signs the I-129, never legal advice" in the same words on the landing page, the FAQ, billing, the alt masthead, and the screener — and `/pricing` doesn't even let me get two different numbers, it just throws me to the one canonical ledger. The pricing is a real schedule I can put in a board deck: $5 to $150 bundles, a draft is 12 tokens — call it a dollar — against the $8k–$15k plus RFE surcharges I pay my firm per O-1. The cost-per-case story isn't *implied*, it's arithmetic, and it's a five-figure line item with weeks of cycle time across a year of cases. And the validation page actually answered the question I walked in with: it names the Arizona ABS order by number and tells me *why* a software company is allowed to sit next to a law firm here, with the 8 CFR and Policy Manual citations and an honest "counsel pending" stamp instead of a "verified ✓" it hasn't earned. That honesty is what made me keep reading.

Then I hit the data-security answer and the whole thing stopped. It's a *beautifully written* security paragraph — AES-256, TLS 1.3, US servers, access logged, "we don't train on your data," export and hard-delete anytime — and it is exactly the paragraph I'd want, which is what made me check it against the code instead of trusting it. There's no encryption in the repo. There's no hard-delete — you can delete a single uploaded document, not a person. The "export" is a CSV of a case list, not my engineers' PII. The "access log" is a console line. And there is no privacy policy, no DPA, no terms page anywhere to bind a single word of it. That is the exact failure mode that burned me last time: a real-sounding posture with nothing behind it and no contract to hold it to. I'm not signing an order form on a paragraph. The honest version of this FAQ answer is half as long and says what's actually true — and the fact that the *rest* of the build is so disciplined about honesty (the "keyword read" label, the "counsel pending" badge, the "In progress" stamp) makes the security overclaim stand out even more. Fix that one paragraph and ship a DPA, and this moves from "walk" to "pilot it on one non-sensitive case." Leave it, and I can't bring it past my own desk — adopting a tool that overstates where my employees' immigration records live is *my* career, not the founder's.

The free screener, for what it's worth, passed the test I most distrust: it doesn't flatter to sell. The public read is openly a keyword skim and *tells you so*, and the real engine's prompt is built to refuse inventing evidence and refuse double-counting it. The shareable certificate doesn't leak anything and reads as informational, not a grant — I wouldn't be embarrassed to see an employee post it. So the product is real. The diligence verdict is: **conditional walk — adopt-eligible the day the security copy matches reality and a DPA exists; not before.**

---

## What passed (strengths to protect)

- **UPL/positioning line is load-bearing and identical across every masthead** — `/`, `/faq`, `/billing`, `/landing-claude`, `/qualify`, `/validation` all say drafting-tool-not-a-law-firm / your-attorney-signs / never-legal-advice. Do not let this drift. (`page.tsx:154-157,254-255`, `faq/page.tsx:27,31,43`, `billing/page.tsx:163-165`, `landing-claude/page.tsx:201`, `qualify/page.tsx:36-37`)
- **`DISCLAIMER` rides on every AI payload** via one canonical string + the disclaimer-first render (`result.ts:37-41`, `CriteriaReport.tsx:47-48`, `DisclaimerStamp` used by qualify/draft/RFE/guidance/best-path).
- **Pricing is canonical and self-serve** — bundles from `economy.ts`, per-op costs from the registry, so landing and billing can't drift; only Enterprise is contact-only. (`economy.ts:43-50`, `billing/page.tsx:108,146`)
- **`/pricing` permanently redirects to `/billing`** — no stale second price surface. (`pricing/page.tsx:8`)
- **Validation page is real evidence, not adjectives** — 8 CFR + Policy Manual citations, per-pack thresholds, freshness countdown, honest "Counsel pending," and the **Arizona ABS court order named as a primary source**. (`validation.ts:54-202`, `validation/page.tsx`)
- **Screener is honest by construction** — keyless preview labeled a "keyword read," anti-fabrication/anti-cross-credit prompt, per-pack threshold, "None" never green. (`preview/route.ts:14-24`, `qualification.ts:133-138,159-161`, `CriteriaReport.tsx:20-26`)
- **Share token is privacy-clean** — encodes no profile text, renders DB-free, rejects tampering, frames informational-not-a-grant. (`letters-patent.ts:21-29,84-102`, `c/[token]/page.tsx:119`)
- **Fail-closed cross-tenant attorney gating** (per accepted-gaps) is a security default worth keeping — relevant to a GC's risk read even though it's outside my prospect path.
