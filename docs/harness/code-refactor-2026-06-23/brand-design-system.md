# Code Refactor — Brand & Design System
> Total: 5 (C0/H2/M2/L1)

Scope note: the task file list named `src/components/ui/SectionHeader.tsx`, `StatCard.tsx`,
`src/lib/format.ts`, and `format.test.ts` — none of these exist on disk
(`find src -iname "*format*" / "*SectionHeader*" / "*StatCard*"` all return nothing). They appear
to be stale entries in the assignment, not deletions to flag. Analysis covered every file that
actually exists in the context. All dead-code claims were verified with `grep` across `src/`.

---

## 1. Dead `[data-animate]` keyframe system in globals.css (4 hooks + 4 keyframes, ~50 lines)
- **Severity**: High
- **Category**: dead-code
- **File**: src/app/globals.css:239-302 (keyframes `inkRise`/`sealPress`/`ribbonSlide`/`underlineGrow` at 239-255; `[data-animate="ink-rise"|"seal"|"ribbon"|"underline"]` selectors at 283-302)
- **Scenario**: globals.css defines a full attribute-driven animation API — four keyframes plus four
  `[data-animate="…"]` selectors (each wiring `animation` + `--delay`). Nothing sets the attribute.
  `grep -rn 'data-animate=' src` → **zero matches**. `grep -rn 'inkRise|sealPress|ribbonSlide|underlineGrow' src` outside globals.css → only one doc-comment reference in `src/lib/motion.ts:14` (prose, "Matches the v2 CSS keyframe `inkRise`"), no live consumer.
- **Root cause**: The v2 reveal mechanism was re-implemented in JS as the framer-motion `Rise`/`fadeUp`
  primitives (`src/components/Motion.tsx`, `src/lib/motion.ts`). The CSS `[data-animate]` predecessor
  was never removed, so two reveal systems were specced but only the JS one is wired.
- **Impact**: ~50 lines of unreachable CSS shipped in the global stylesheet; misleads maintainers into
  thinking `data-animate="seal"` etc. is a supported authoring API. The `inkRise` keyframe is also the
  one the `fadeUp` JS variant claims to "match exactly", so the dead copy invites silent drift if one is
  edited and the other isn't.
- **Fix sketch**: Delete the four `[data-animate]` selector blocks (283-302) and the `sealPress`,
  `ribbonSlide`, `underlineGrow` keyframes. Keep `inkRise` only if you want the documented parity anchor,
  otherwise drop it too and remove the stale comment in `motion.ts:14`. The live `enterCard`/`card-enter`
  and `skeletonShimmer` animations ARE used (`DraftStudio.tsx:581`, `Skeleton.tsx`) — leave them.

## 2. Hand-copied focus-ring class string across 35 files, in two divergent syntaxes
- **Severity**: High
- **Category**: duplication
- **File**: src/components/ui/Button.tsx:52 (canonical) vs 35 hand-rolled call-sites
- **Scenario**: The canonical `Button` renders the ring with token classes:
  `focus-visible:ring-2 focus-visible:ring-accent-dark focus-visible:ring-offset-2 focus-visible:ring-offset-background`.
  Thirty-five non-primitive files instead hand-write the bracket form
  `focus-visible:ring-2 focus-visible:ring-[color:var(--accent-dark)]` (no offset).
  `grep -rln 'focus-visible:ring-\[color:var(--accent-dark)\]' src` → **35 files**
  (ThemeToggle.tsx:53, AdjudicationBadge.tsx:47, FieldGuidancePanel.tsx, every dashboard/billing/review
  panel, etc.); `grep -rln 'focus-visible:ring-accent-dark' src` → only 2 (Button.tsx, CriterionPrimerButton.tsx).
  A third mechanism — the global `:focus-visible { outline: 2px solid var(--accent) }` at globals.css:232 —
  rings on `--accent` (a different, lower-contrast color the Button comment explicitly avoids).
- **Root cause**: No shared focus-ring utility (e.g. a `.focus-ring` class in globals.css or a
  `focusRing` const). Each interactive element that isn't a `<Button>` re-types the ring by hand, and the
  bracket form drifted from the token form — and dropped the `ring-offset` the Button standard includes.
- **Impact**: 35 copies to keep in sync; the comment in Button.tsx:48-52 documents the WCAG rationale
  (rings on `--accent-dark` not the 2.63:1 `--accent`) but the global `:focus-visible` outline at 232
  contradicts it by using `--accent`. Any future ring-color/contrast change must be made in ~37 places.
- **Fix sketch**: Add one `.focus-ring` utility class to globals.css carrying the Button standard
  (`ring-2 ring-[--accent-dark] ring-offset-2 ring-offset-background`) and replace the 35 inline strings
  with it; reconcile or remove the global `:focus-visible` outline so there is one ring contract.

## 3. Dead `Stagger` motion wrapper (+ transitively-dead `staggerParent` variant)
- **Severity**: Medium
- **Category**: dead-code
- **File**: src/components/Motion.tsx:64-93 (`Stagger`); src/lib/motion.ts:30-38 (`staggerParent`)
- **Scenario**: `Stagger` is exported and documented but rendered nowhere.
  `grep -rn '<Stagger' src` and `grep -rn 'import.*Stagger' src` → **zero** outside Motion.tsx's own
  definition/docstrings. Its sole default variant `staggerParent` is consumed only by `Stagger`
  (`grep -rn 'staggerParent' src` → just the import + use inside Motion.tsx and its own declaration).
  By contrast its sibling `Rise` is used in ~10 pages and `HoverCard` in one.
- **Root cause**: The motion toolkit was built as a trio (`Rise`/`Stagger`/`HoverCard`); pages adopted
  `Rise` for reveals but never needed parent-orchestrated staggering, leaving `Stagger` (and the variant
  it pulls in) unreferenced.
- **Impact**: A ~30-line client component plus a `Variants` export that look like supported API but ship
  no value; the README lists `Stagger` and `staggerParent` as features (`README.md:272,283`), compounding
  the false impression.
- **Fix sketch**: Delete `Stagger` from Motion.tsx and `staggerParent` from motion.ts (and their README
  lines), OR adopt `Stagger` where multi-child reveals exist (e.g. the billing bundle grid / faq list).
  `Rise`, `fadeUp`, `easeArrival`, and `stampIn` are all live — keep them.

## 4. Dead `.double-rule` CSS class — defined but never applied
- **Severity**: Medium
- **Category**: dead-code
- **File**: src/app/globals.css:175-181
- **Scenario**: `.double-rule` (a three-layer engraved-frame `box-shadow`) is defined in globals.css.
  No element carries the class: `grep -rn 'double-rule' src --include=*.tsx` → only
  `Stamp.tsx:5` (the hyphenated English word "double-ruled" in a docstring) and `PageFrame.tsx:7`
  (a docstring claiming PageFrame draws "the engraved double-rule border that frames every document").
  PageFrame's actual JSX uses `perforation-y` lines and corner `Guilloche`, never `double-rule`.
- **Root cause**: The "engraved frame around official documents" was specced as a reusable class but the
  document chrome ended up implemented with `border-border-strong` + `shadow-leaf` on individual cards
  (e.g. login/billing sections), so the class was orphaned. PageFrame's docstring still advertises it.
- **Impact**: Dead style rule plus a docstring that describes behavior the component does not implement —
  a maintainer reading PageFrame.tsx:7 will look for a double-rule border that isn't there.
- **Fix sketch**: Either delete `.double-rule` and correct the PageFrame docstring, or actually apply
  `double-rule` where the design intends the engraved frame (and update the docstring to match).

## 5. Two parallel hover-lift implementations: `.lift` CSS vs `HoverCard` JS wrapper
- **Severity**: Low
- **Category**: structure
- **File**: src/app/globals.css:313-319 (`.lift`); src/components/Motion.tsx:96-123 (`HoverCard`); consumed at src/components/ui/Card.tsx:27 and src/app/billing/BundleGrid.tsx:87
- **Scenario**: Two mechanisms produce the identical "translateY(-3px) on hover" lift. `.lift` (CSS, with
  a `will-change`/cubic-bezier transition) is opted into via `Card interactive` (`Card.tsx:27`), used by
  exactly one page (`app/page.tsx`). `HoverCard` (framer-motion `whileHover={{ y: -3 }}` + `easeArrival`)
  is used by exactly one file (`billing/BundleGrid.tsx`). `grep -rln 'HoverCard' src` → 1 consumer;
  `grep -rln 'interactive' src` (Card) → 1 consumer. HoverCard's own docstring admits it is "the same
  restrained motion the `.lift` CSS class provides."
- **Root cause**: The hover-lift was implemented twice — once in CSS for the Card primitive and once as a
  JS wrapper for non-Card elements — with no decision to canonicalize on one. Adoption of both is near-zero.
- **Impact**: Two SSoTs for one micro-interaction (and two reduced-motion handling paths: `.lift` relies on
  the global `prefers-reduced-motion` reset, `HoverCard` branches on `useReducedMotion()`); the 3px value
  and easing must be kept in sync by hand. Low because the surface is tiny, but it is duplicated motion logic.
- **Fix sketch**: Pick one. Simplest: have `BundleGrid` wrap its cards in `Card interactive` (or add the
  `lift` class) and delete `HoverCard` + its `staggerParent`-adjacent dead siblings — collapsing to the CSS
  `.lift` as the single lift contract. Keep whichever you standardize on documented in the Card primitive.
