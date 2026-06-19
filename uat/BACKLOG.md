# UAT backlog — remaining L1 findings, by business impact

Derived from the `2026-06-19-l1` sweep (43 findings) after the first fix wave. **15 of 22
actionable findings shipped in PR #92** (positioning, draft integrity, attorney ceremony, RFE
adjudication parity, qualify calibration, dashboard) and were **L2-verified live**
(`runs/2026-06-19-l2/report.md`). This backlog is the **6 remaining open items** — all deferred,
by-design minors — grouped into packages and sorted by business impact.

> Out of scope / no-change: **SR-DP-02** (keyless mock-draft is templated — by-design + labeled
> "Placeholder output"; L2 confirmed the real Claude path argues from the user's words).

---

## G1 — AI output grounding & fidelity  ·  HIGHEST impact

The product's core promise is output a senior would sign. L2 named this "the whole ballgame."
These three feed the model a richer, more faithful context → better drafts/RFEs → clears the
attorney's bar → adoption + trust.

- **G1.1 — dc-draft-02** (minor · senior-quality) — *Section regenerate has no narrative continuity.*
  `buildSectionPrompt` sees only the focus criterion, not the rest of the letter, so a regenerated
  section can repeat/contradict the intro and siblings.
  **Fix:** pass the other sections (headings + trimmed bodies) into the section prompt as read-only
  context. **Cheap** — Package B already sends the client's current sections to the server, so the
  context is already in hand. _Acceptance:_ a regenerated section references/stays consistent with
  the rest of the letter; no duplicate intros.
  Evidence: `src/features/drafting/drafting.ts:211,230`, `draftOperation.ts` (prompt hook).

- **G1.2 — dc-rfe-02** (minor · senior-quality) — *RFE response doesn't see the as-filed petition prose.*
  `buildRfePrompt` grounds on criteria + evidence + exhibits + the RFE text, but not the actual
  drafted letter, so it can't quote/track the petition's own language.
  **Fix:** load `getLatestDraft` in the RFE route and fuse the sections into the prompt as
  "as-filed petition" context. **Medium.** _Acceptance:_ the RFE response references the petition's
  specific argument/language, not just the criteria structure.
  Evidence: `src/features/rfe/rfe.ts:147,176`, `src/app/api/rfe/route.ts`.

- **G1.3 — PN-DRAFT-01** (minor · senior-quality) — **RESOLVED (accepted, no code change).**
  *Draft argues from per-criterion paraphrases, not the full CV.* Decided 2026-06-19 to accept the
  current grounding: **L2 proved the live draft already names the supplied specifics** (FoldX2,
  RECOMB, the patent #, Quanta, NeurIPS) because the qualify model captures them into the persisted
  criteria evidence/rationale — which is the petition's argument. The **"populate the vault first"
  nudge already shipped** covers the empty-vault enrichment path. Full-profile persistence (a
  schema column + dedicated getter to keep the CV out of the dashboard/review **list** payloads,
  both stores, draft thread) was judged disproportionate + PII-sensitive for a *minor*.
  Evidence: `runs/2026-06-19-l2/draft-claude.json` (grounding confirmed); nudge in `DraftStudio.tsx`.

## G2 — Evidence-vault intelligence  ·  MEDIUM impact

Better-organized evidence is upstream of every draft (the draft cites the vault). Improves the
operator (paralegal) experience and the honesty of the coverage read.

- **G2.1 — PN-EVID-01** (minor · missing) — *Categorization sees one document at a time.*
  `buildCategorizePrompt` is fed only the single doc's name + text — no whole-vault view, so it can
  split related evidence across buckets or duplicate.
  **Fix:** pass a compact summary of existing buckets (criterion → doc count/titles) into the
  categorize prompt so a new doc is placed consistently with siblings. **Medium.**
  Evidence: `src/features/evidence/evidence.ts:98`, `src/app/api/evidence/categorize/route.ts:62`.

- **G2.2 — dc-evidence-02** (minor · clarity · _uncertain_) — *Refile to a wrong bucket silently inflates coverage.*
  `onRefile` changes a doc's criterion with no sanity check; `summarizeVault` then counts the
  (possibly wrong) bucket as covering that criterion.
  **Fix (light):** keep refile as a manual override, but distinguish coverage as "documents present"
  vs "criterion proven", or flag a refiled doc whose facts don't match the new bucket. **Low.**
  Evidence: `src/features/evidence/components/EvidenceVault.tsx:113`, `lib/data/evidence.ts:61`.

## G3 — Verdict framing  ·  LOW / polish

- **G3.1 — PN-QUAL-01** (polish · trust · _uncertain/subjective_) — *"Certificate / Approved" theater
  vs a sober screening for rigor-focused users.* The honest scored data is underneath; only the
  award-ceremony branding risks the "horoscope" read.
  **Fix (light):** soften the hero's "Approved/Certificate" framing toward "informational screening"
  (keep the data). **Low.** L2 to judge whether it aids or hurts credibility.
  Evidence: `src/features/qualification/components/InstantVerdict.tsx:220`, `src/app/page.tsx:214,228`.

---

### Sequencing
Implement G1 first (highest impact), in leverage order **G1.1 → G1.2 → G1.3**; then G2 (**G2.1 → G2.2**);
then G3. Verify each (`typecheck` + `lint` + `test`) before the next. Re-run L2 on the AI surfaces
after G1 to confirm the richer grounding actually shows in the live output.
