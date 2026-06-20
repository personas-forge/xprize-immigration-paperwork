> Total: 5 | Critical: 0 | High: 1 | Medium: 3 | Low: 1
> Context: Brand & Design System
> Lens mix: bug-hunter 1, ui-perfectionist 4

## 1. Button strips the focus-visible outline on every variant but only re-adds a ring for `ghost` — primary/secondary/seal are keyboard-invisible
- **Severity**: High
- **Lens**: bug-hunter
- **Category**: focus-visible (WCAG 2.4.7)
- **File**: src/components/ui/Button.tsx:50 (with variantClass 10-23); test gap at src/components/ui/Button.test.ts:23
- **Scenario**: A keyboard user tabs through a form. The global `:focus-visible { outline: 2px solid var(--accent) }` in globals.css:232 would normally mark the focused control. But `Button` adds `focus-visible:outline-none` to the **base** class (applied to all four variants), and only the `ghost` variant re-introduces a `focus-visible:ring-*`. So `primary`, `secondary`, and `seal` buttons have their outline removed and **nothing replaces it** — there is no visible focus indicator at all. `PanelFallback`'s Retry button (PanelErrorBoundary.tsx:60) is a `secondary` Button, so even the error-recovery affordance is unreachable-looking by keyboard.
- **Root cause**: `focus-visible:outline-none` lives in the shared base (line 50) instead of beside the variant that supplies its own ring. The unit test (`Button.test.ts`) asserts the ring **only** for `variant="ghost"`, so the regression on the other three variants is invisible to CI and reads as "covered."
- **Impact**: WCAG 2.4.7 (Focus Visible) failure on the most-used interactive primitive in the system; affects every primary CTA ("Sign", "File"), every secondary action, and the seal/ceremonial buttons. Keyboard and low-vision users cannot tell which control is focused.
- **Fix sketch**: Move the focus treatment out of per-variant strings into the shared base so every variant gets it: append `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-dark focus-visible:ring-offset-2 focus-visible:ring-offset-background` to the base `cn(...)` and delete the duplicated ring from the `ghost` string. Then extend `Button.test.ts` to loop over all four variants asserting the ring classes (turn `renderClassAttr` into a parametrized test) so a future regression is caught.

## 2. Focus-ring color is inconsistent across primitives — most controls ring on `--accent` (2.63:1), the exact value Button's own comment rejects as below WCAG 1.4.11
- **Severity**: Medium
- **Lens**: ui-perfectionist
- **Category**: focus-visible / token-drift
- **File**: src/components/ThemeToggle.tsx:53; src/components/FaqEntry.tsx:33; src/components/PetitionStepper.tsx:56,85; src/components/ConsentForm.tsx:47,90,114; src/components/legal/AdjudicationBadge.tsx:47 — vs. src/components/ui/Button.tsx:16-20
- **Scenario**: Button's `ghost` variant carries a careful comment (lines 16-19) explaining it deliberately rings on `--accent-dark`, not `--accent`, because gold-leaf `--accent` is only 2.63:1 against parchment — below the 3:1 non-text-contrast minimum (WCAG 1.4.11). Yet every **other** focusable control in the system rings on `focus-visible:ring-[color:var(--accent)]/40` — the rejected low-contrast token, additionally knocked to 40% opacity, making the ring even fainter. So the one primitive that documented the right answer is the only one that follows it.
- **Root cause**: No shared focus-ring token/utility. Each component hand-writes its `focus-visible:ring-*` string, and they drifted to the wrong color. There is no `--ring`/`--focus-ring` CSS var and no `FOCUS_RING` constant to import, so the corrected value from Button's comment never propagated.
- **Impact**: Inconsistent focus affordance across the design system and a likely 1.4.11 contrast miss on toggle, FAQ, stepper, consent inputs/submit, and the adjudication link — exactly the surfaces (consent + filing) where keyboard accessibility matters most.
- **Fix sketch**: Add a `--focus-ring: var(--accent-dark)` token (or a `FOCUS_RING` class constant) and replace every `ring-[color:var(--accent)]/40` with `ring-2 ring-accent-dark ring-offset-2 ring-offset-background`. Reuse it from Button too so there is one audited focus style.

## 3. Card promises a hover lift / leaf-shadow in its docstring but renders a static card — the `.lift` motion in globals.css is never applied
- **Severity**: Medium
- **Lens**: ui-perfectionist
- **Category**: missing-state / component-consistency
- **File**: src/components/ui/Card.tsx:8-10,18-29 (vs. `.lift` defined at src/app/globals.css:314-319)
- **Scenario**: Card's docstring states "a soft leaf-shadow on hover" and "depth comes from edge contrast and **lift on hover**." The rendered element (line 22) only ever has the static `shadow-leaf` and `border` — there is no `hover:` class, no `.lift`, and no `HoverCard` wrapper. So Cards are inert on hover despite the documented and globally-defined interaction (the GPU-friendly `.lift` translateY(-3px) sits unused in CSS, and `HoverCard` in Motion.tsx duplicates the same -3px lift in framer-motion).
- **Root cause**: The hover behavior was specced in CSS (`.lift`) and in motion (`HoverCard`) but never wired into the shared `Card` primitive, so each call-site must remember to add it — and the docstring over-promises what the component delivers.
- **Impact**: Inconsistent interaction (some Cards lift, most don't), a dead `.lift` rule, and a docstring that misleads maintainers. Two parallel lift implementations (`.lift` CSS and `HoverCard` motion) with no single source of truth.
- **Fix sketch**: Either add an opt-in `interactive?: boolean` prop to `Card` that appends the `lift` class (respecting reduced-motion via the existing `@media (prefers-reduced-motion: reduce)` override), or compose `Card` over `HoverCard`. Pick ONE lift implementation and delete the other. Update the docstring to match the actual default (static) vs. opt-in (interactive) behavior.

## 4. Wordmark's hover rotate ignores `prefers-reduced-motion`, unlike every other motion in the system
- **Severity**: Medium
- **Lens**: ui-perfectionist
- **Category**: a11y / motion-consistency
- **File**: src/components/brand/Wordmark.tsx:23
- **Scenario**: The seal in the wordmark animates on hover via `transition-transform duration-500 group-hover:rotate-[8deg]`. This is a plain Tailwind transition with no `motion-reduce:` variant and no reduced-motion guard. Meanwhile the rest of the system is rigorous about this: Motion.tsx (`Rise`/`Stagger`/`HoverCard`) returns a plain element when `useReducedMotion()` is true, and globals.css:305-311 forces `transition-duration: 0.01ms` under `prefers-reduced-motion: reduce`. The global rule actually neutralizes the **duration** here, so the seal still snaps to 8deg instantly on hover rather than not rotating — a transform the user asked to avoid.
- **Root cause**: The rotate is expressed as a hover transform in component classes rather than going through the reduced-motion-aware motion layer, and the global `reduce` override only collapses timing, it does not suppress the transform itself.
- **Impact**: A vestibular-sensitive user who set reduce-motion still gets an abrupt 8° rotation on the primary brand mark (present in every header / top bar), inconsistent with the otherwise-careful motion discipline.
- **Fix sketch**: Gate the transform with Tailwind's `motion-safe:` (i.e. `motion-safe:group-hover:rotate-[8deg] motion-safe:transition-transform`) so reduce-motion users get no rotation, matching the `useReducedMotion()` early-return pattern used in Motion.tsx.

## 5. Stamp bypasses `cn`, hardcodes `border-2`, and `aria-hidden`s a meaningful status label
- **Severity**: Low
- **Lens**: ui-perfectionist
- **Category**: component-consistency / token-drift
- **File**: src/components/brand/Stamp.tsx:20-31
- **Scenario**: Every other primitive (Button, Badge, Card, Skeleton) composes classes via `cn(...)` and references geometry tokens, but `Stamp` builds its className with a raw template literal (`` `inline-flex … ${toneClass}` ``) and hardcodes `border-2 border-double` instead of using the system's border-radius/width conventions. It also wraps the entire stamp in `aria-hidden`, even though the docstring says it "stamps a key fact (qualification, status, etc.)" — i.e. it can carry real, non-decorative information (e.g. an approval status), which would then be silently dropped for screen-reader users.
- **Root cause**: Stamp predates / diverges from the `cn`-based primitive convention, and treats a potentially-informational component as purely decorative by default with no escape hatch.
- **Impact**: Minor visual/maintenance drift (the only primitive not using `cn`; a raw `border-2` that won't re-theme with the rest), plus an a11y gap when Stamp is used to convey status rather than pure ornament.
- **Fix sketch**: Route the class string through `cn(...)`. Add an optional `decorative?: boolean` (default `true`) that, when `false`, drops `aria-hidden` and exposes `role="img"` + `aria-label={`${label} ${meta ?? ""}`}` so informational stamps reach assistive tech. Keep the rotate transform but consider `motion-safe:` as in finding 4 if it ever animates.
