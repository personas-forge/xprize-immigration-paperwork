# Brand & Design System — Feature Scout + Ambiguity Guardian

> Context #19 · Group: Marketing & Design System
> Total: 5 findings

## 1. No shared Toast / notification primitive — three ad-hoc copies already exist
- **Lens**: feature-scout
- **Priority**: High
- **Category**: feature
- **File**: `src/app/billing/PurchaseToast.tsx:7` (also `src/features/drafting/components/SaveFailedAlert.tsx:30`)
- **Observation**: The kit exports Card/Badge/Button/Skeleton/PanelErrorBoundary but nothing for transient feedback. `PurchaseToast` hand-rolls a `role="status"` success bar with its own inline check SVG, a `setTimeout(…, 4500)` auto-dismiss, and a bespoke Dismiss button (`PurchaseToast.tsx:11-46`). `SaveFailedAlert` independently re-implements the same shape as a `role="alert"` seal-toned box with its own dismiss/retry chrome (`SaveFailedAlert.tsx:30-69`). Both re-encode the same border/`*-soft`/padding recipe and accessible-live-region decision by hand. Every new "payment received / draft not saved / criterion added" surface copies this again.
- **Proposal**: Add `<Toast>` / `<Alert>` (or a single `<Notice tone meta role>` ) primitive to `src/components/ui/` taking `tone` (reuse `BadgeTone`: success/danger/warning/accent/neutral), an `assertive` flag mapping to `role="alert"` vs `"status"`, optional auto-dismiss ms, and a built-in dismiss affordance with the standard `focus-visible:ring-accent-dark`. Refactor the two existing call sites onto it.
- **Value / Risk-if-ignored**: Feedback is a core SaaS surface; without a primitive each new toast re-decides tone, ARIA role, and timing — guaranteeing drift (one says 4500ms, the next will say something else) and silent a11y regressions (a future author forgets the live-region role). A primitive makes "right" the default and sells faster.
- **Effort**: S

## 2. No Modal/Dialog primitive — focus-trap, Escape, and z-index logic re-implemented per popover
- **Lens**: feature-scout
- **Priority**: High
- **Category**: feature
- **File**: `src/features/case-file/components/CriterionPrimerButton.tsx:14-117`
- **Observation**: `CriterionPrimerButton` hand-builds a full dialog: `role="dialog"`/`aria-modal="true"`, two `useEffect`s for Escape + outside-click, manual focus-in-on-open / focus-return-to-trigger via three refs, and a magic `z-50` (`CriterionPrimerButton.tsx:23-52, 85`). None of this is reusable — the next confirm/overlay/popover (delete confirmations are already flagged in the moonshot backlog) must re-derive the same focus-trap and Escape handling from scratch, and any of them can get it subtly wrong.
- **Proposal**: Extract a headless `<Dialog>` / `usePopover()` primitive into `src/components/ui/` that owns Escape-to-close, outside-click, focus-move-in / focus-return, `aria-modal`, and a tokenized z-index — leaving callers to supply only content. Land `CriterionPrimerButton` on it as the first consumer.
- **Value / Risk-if-ignored**: The "attorney reviews & signs" flow needs trustworthy confirm dialogs; ad-hoc focus management is the single most common a11y failure mode (lost focus, no Escape, background still interactive). One audited primitive prevents every future overlay from re-litigating it.
- **Effort**: M

## 3. No documented z-index scale — layering uses scattered magic numbers
- **Lens**: ambiguity-guardian
- **Priority**: High
- **Category**: maintenance
- **File**: `src/components/brand/PageFrame.tsx:18,39` · `src/components/DashboardTopBar.tsx` (header `z-30`) · `src/components/CriterionPrimerButton.tsx:85` (`z-50`) · `src/app/layout.tsx` (skip-link `z-50`)
- **Observation**: Layering is expressed as raw Tailwind `z-*` literals with no central scale or comment explaining the tiers: PageFrame watermarks `z-0` and content `z-10`, the sticky top bar `z-30`, both the skip-link and the primer dialog `z-50`, and a hero watermark `-z-10`. There is no token (unlike radius/color/tracking, which ARE tokenized in `tailwind.config.ts`) and nothing records *why* a dialog is `z-50` or whether it must out-stack the `z-30` header. A future dev adding a real modal/toast can't recover the intended order and will guess.
- **Proposal**: Define a small named z-index scale (e.g. `--z-base/-watermark/-sticky/-overlay/-toast`) in `globals.css` + `tailwind.config.ts` `zIndex` extend, the way radius and color are already tokenized, and document the tier each existing literal maps to. The skip-link colliding with the primer dialog at `z-50` is the kind of latent stacking bug this prevents.
- **Value / Risk-if-ignored**: Magic z-values inevitably collide as overlays multiply (this codebase already has two `z-50` users with different intent); a tokenized ladder is the cheap insurance, and it matches the system's own stated "tokens drive everything" principle (`globals.css:8`).
- **Effort**: S

## 4. `--indigo` ("official stamp blue") is a first-class token but only Stamp can use it — Badge/Card/Button can't
- **Lens**: ambiguity-guardian
- **Priority**: Medium
- **Category**: trade-off
- **File**: `src/app/globals.css:34` (+`:77`) · `tailwind.config.ts:34-37` · `src/components/ui/Badge.tsx:4-20` · `src/components/brand/Stamp.tsx:25-34`
- **Observation**: `--indigo`/`--indigo-soft` are defined for both themes and exposed as Tailwind colors with the documented intent "official stamp blue." Yet the variant APIs disagree on the brand's own palette: `Stamp` offers `tone: "seal" | "indigo" | "accent"` (`Stamp.tsx:25`), while `Badge` offers `"neutral" | "accent" | "success" | "warning" | "danger"` with NO indigo (`Badge.tsx:4-9`), and `Card` offers `"default" | "accent" | "muted" | "seal"` with no indigo and no success/warning/danger. There's no recorded reason for which token each primitive blesses, so a token that exists and renders is silently unreachable through the kit's main chip/card.
- **Proposal**: Either (a) align the variant vocabularies so the documented brand tones (seal, indigo, accent, status) are consistently reachable across Badge/Card/Stamp, or (b) add a one-line comment at each `toneClass` map recording *why* a primitive deliberately omits a token (e.g. "Cards never use status tones — those belong on Badge"). Make the inclusion/exclusion intentional and discoverable.
- **Value / Risk-if-ignored**: Inconsistent tone APIs cause drift — authors will reach for `<Badge>`, find no indigo, and inline a `bg-indigo` className, fragmenting the very token system `tailwind.config.ts:3-6` exists to centralize. The contract should be explicit, not accidental.
- **Effort**: S

## 5. Motion durations/curves are scattered literals that must stay in lockstep with CSS keyframes by hand
- **Lens**: ambiguity-guardian
- **Priority**: Medium
- **Category**: code_quality
- **File**: `src/lib/motion.ts:21,37,50` · `src/components/Motion.tsx:51,117` · `src/app/globals.css:285,316`
- **Observation**: `motion.ts` documents that `fadeUp`'s 0.7s/`easeArrival` must "match the v2 CSS keyframe `inkRise` exactly so motion-and-CSS reveals coexist" (`motion.ts:13-23`), but the contract is enforced only by twin hand-copied magic numbers: JS `duration: 0.7` + `easeArrival = [0.22,1,0.36,1]` vs CSS `animation: inkRise 700ms cubic-bezier(0.22,1,0.36,1)` (`globals.css:285`). The same `0.7`/`easeArrival` is then re-typed inline in `Motion.tsx:51`, and `HoverCard`'s `0.36` duration (`Motion.tsx:117`) duplicates `.lift`'s `360ms` (`globals.css:316`) — also the `stampIn` curve `[0.34,1.3,0.64,1]` duplicates `sealPress`'s cubic-bezier. There is no shared duration/easing token, so editing one side silently desyncs the JS and CSS reveals the comment promises to keep identical.
- **Proposal**: Introduce shared motion-duration tokens (CSS custom properties consumed by keyframes, plus exported TS constants like `DURATION_REVEAL = 0.7`, `DURATION_LIFT = 0.36`) so the JS framer-motion timings and the CSS keyframes derive from one source instead of duplicated literals. At minimum, cross-reference each paired magic number in a comment.
- **Value / Risk-if-ignored**: The "coexist without a visible mix" guarantee is load-bearing for the engraved aesthetic; today it rests on a developer remembering to edit two files identically. A single forgotten edit produces a subtle, hard-to-debug visual desync between scroll-reveal and CSS-reveal elements on the same page.
- **Effort**: M
