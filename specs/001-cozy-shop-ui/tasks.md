# Tasks: Cozy Shop UI Redesign

**Input**: Design documents from `/specs/001-cozy-shop-ui/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ui-contracts.md ✅, quickstart.md ✅
**Branch**: `001-cozy-shop-ui`
**Tests**: Not explicitly requested — no new test tasks. Existing 426+ unit tests must pass (regression only).

**Organization**: Tasks are grouped by user story (6 stories from spec.md, P1–P6) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Setup and Foundational phases have no story label
- Include exact file paths in descriptions

### Mandatory Rules for Every Component Task

1. **Dark mode is MANDATORY**: Every color must use CSS variable tokens (`var(--foreground)`, `var(--surface)`, etc.) or explicit `dark:` Tailwind variants. No hardcoded hex colors (`#fef7f2`, `#4a3728`), no `bg-white`, `text-gray-*`, or `text-black` in customer-facing components. Verify each component renders correctly under `prefers-color-scheme: dark`.
2. **`--surface` token**: All card/panel backgrounds must use `var(--surface)` (light: `#ffffff`, dark: `#241c16`).
3. **`CATEGORY_FILTERS` constant**: Product filter tabs must import from `lib/constants/categories.ts`.
4. **Admin exclusion**: Do NOT modify `app/admin/*` or `components/admin/*` (FR-034).
5. **No backend changes**: Do NOT modify `lib/*` (except `lib/constants/`), `app/api/*`, or database schema (FR-035).

---

## Phase 1: Setup

**Purpose**: Verify environment and branch readiness

- [x] T001 Verify `001-cozy-shop-ui` branch is checked out, run `npm install`, confirm `npm run dev` starts cleanly

---

## Phase 2: Foundational (Design Token System & Typography)

**Purpose**: Establish the complete design token system and font configuration — ALL user stories depend on this phase

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 Extend CSS custom properties with full cottagecore palette (light + dark mode variants) including `--surface` token (`#ffffff` / `#241c16`), custom utilities (`shadow-warm`, `bg-warm-gradient`, `text-warm-heading`, `border-warm`), animation keyframes, and dark mode `select option` styling in `app/globals.css`
- [x] T003 [P] Add `--font-display` CSS variable and `@utility` directive for decorative headings in `app/globals.css`
- [x] T004 [P] Add warm focus ring `@utility` (`focus-warm`) using `--accent-warm` for keyboard navigation in `app/globals.css`
- [x] T005 [P] Add `prefers-reduced-motion` media query to disable decorative animations in `app/globals.css`
- [x] T006 Import Playfair Display via `next/font/google`, apply to `--font-display`, and update site metadata title/description to "The Kiyon Store" in `app/layout.tsx`
- [x] T007 Add FloralCartIcon, ButterflyAccent, MushroomAccent, and FloralBorder inline SVG components with `aria-hidden="true"` and `readonly className?: string` props in `components/ui/DecorativeElements.tsx`

**Also completed (no task IDs)**: `PRODUCT_CATEGORIES` + `CATEGORY_FILTERS` constants in `lib/constants/categories.ts`; admin `ProductFormModal` category `<select>` dropdown (FR-038); dark mode `select option` global rule (FR-039).

**Checkpoint**: `npm run dev` renders warm cream background; Playfair Display loads for headings; both light and dark mode show warm palette; `focus-warm` utility and `--surface` token available; all decorative SVG components exist.

---

## Phase 3: User Story 1 — First Impression & Brand Identity (Priority: P1) 🎯 MVP

**Goal**: A new visitor lands on the homepage and immediately perceives a warm, handcrafted cottagecore shop. The color palette, typography, hero imagery, header, and footer all convey the "handmade with love" brand identity.

**Independent Test**: Load the homepage and verify warm brand identity visually — header shows "The Kiyon Store" with flower icon, hero displays illustration background with "Handmade With Love" heading, footer matches warm palette, all skeletons use warm shimmer. Toggle dark mode and confirm all elements render with warm dark variant (no white backgrounds, no invisible text).

### Shared UI Components (warm restyling + dark mode)

- [x] T008 [P] [US1] Update Card component: `var(--surface)` background, `var(--border-warm)` border, `shadow-warm`, `rounded-2xl`; verify card renders warm in both light and dark mode in `components/ui/Card.tsx`
- [x] T009 [P] [US1] Update GradientButton: coral/warm gradient using `var(--accent-warm)` → `var(--accent-rose)` tokens, white bold text; verify gradient visible in dark mode in `components/ui/GradientButton.tsx`
- [x] T010 [P] [US1] Update GradientHeading: `font-display` font family, warm text gradient using `text-warm-heading` utility; verify heading renders on `var(--background)` in dark mode in `components/ui/GradientHeading.tsx`
- [x] T011 [P] [US1] Update Badge: warm color variants (sage via `var(--accent-sage)`, peach via `var(--accent-peach)`, blush via `var(--accent-blush)`); verify badge contrast meets WCAG AA in both modes in `components/ui/Badge.tsx`
- [x] T012 [P] [US1] Update CtaButton: coral/salmon gradient (`var(--accent-warm)` → `var(--accent-rose)`), `rounded-full`, white bold text, warm hover state with scale; verify in dark mode in `components/ui/CtaButton.tsx`
- [x] T013 [P] [US1] Update EmptyState: warm illustration, `var(--accent-cream)` background, `var(--foreground)` text, decorative flower element; verify dark mode renders muted warm tones in `components/ui/EmptyState.tsx`
- [x] T014 [US1] Add warm focus ring (`focus-warm` utility or `focus-visible:ring-[var(--accent-warm)]`) to all interactive UI components across `components/ui/Card.tsx`, `GradientButton.tsx`, `CtaButton.tsx`, `Badge.tsx`

### Layout Components

- [x] T015 [US1] Update Header: brand name "The Kiyon Store" with crochet flower icon (🌸 or inline SVG), warm nav link styling with soft rounded edges; replace all hardcoded colors (`bg-[#fef7f2]`, `text-[#7a6355]`, `bg-white`) with `var(--background)`, `var(--surface)`, `var(--foreground)`, `var(--text-secondary)` tokens; verify header renders correctly in dark mode in `components/layout/Header.tsx`
- [x] T016 [US1] Style mobile hamburger menu: `var(--surface)` background, `var(--border-warm)` borders, `var(--foreground)` text, warm slide-in animation; replace hardcoded `text-[#7a6355]` mobile nav links with token references; verify mobile menu is readable in dark mode in `components/layout/Header.tsx`
- [x] T017 [US1] Style search input: `rounded-xl`, `var(--border-warm)` border, `var(--surface)` background, `var(--text-muted)` placeholder, `focus-warm` ring; verify search renders in dark mode in `components/layout/Header.tsx`
- [x] T018 [US1] Replace cart icon with FloralCartIcon component from `DecorativeElements.tsx`; warm badge color using `var(--accent-warm)` with white count text; verify badge visible in both modes in `components/layout/CartIcon.tsx`
- [x] T019 [US1] Restyle Footer: `var(--surface)` background, `var(--foreground)` text, `var(--text-secondary)` for secondary links, `var(--border-warm)` top border, floral decorative elements; replace all hardcoded hex colors with tokens; verify footer renders warm in dark mode in `components/layout/Footer.tsx`

### Hero Section

- [x] T020 [US1] Implement hero illustration using CSS `background-image` with `public/warm-bg.jpeg` covering the full hero area (per FR-010 and prototype2.jpeg), with `background-size: cover` and `background-position: center`; add warm semi-transparent backdrop (~50% opacity `var(--accent-cream)`) behind the text area for legibility; ensure hero scales responsively across mobile/tablet/desktop in `components/sections/Hero.tsx`
- [x] T021 [US1] Update hero text overlay: "Handmade With Love" heading using `font-display` italic at `text-4xl sm:text-5xl lg:text-6xl`, subtitle "CROCHET · FLOWERS · BAGS · ACCESSORIES" in uppercase tracking, and coral "Explore Shop →" CTA button (CtaButton) linking to `/products`; verify all text uses token colors (`var(--foreground)` heading, `var(--text-secondary)` subtitle) and remains legible in dark mode in `components/sections/Hero.tsx`

### Homepage & Global States

- [x] T022 [US1] Update homepage metadata and composition: wrap with `var(--background)` body class, verify page-level decorative layout structure is ready for Phase 7 in `app/page.tsx`
- [x] T023 [P] [US1] Style global error boundary: `var(--background)` page background, `var(--foreground)` text, `var(--accent-warm)` error accent, warm retry button; verify error page renders in dark mode in `app/error.tsx`
- [x] T024 [P] [US1] Style global loading skeleton: warm shimmer animation using `var(--accent-cream)` / `var(--accent-blush)` gradient (not gray); verify skeleton shimmer has warm tone in dark mode in `app/loading.tsx`

### Skeleton Components (warm shimmer + dark mode)

- [x] T025 [P] [US1] Update HeaderSkeleton: warm-toned shimmer using `var(--accent-cream)` / `var(--accent-blush)` (not gray); verify warm shimmer in dark mode in `components/skeletons/HeaderSkeleton.tsx`
- [x] T026 [P] [US1] Update HeroSkeleton: warm-toned shimmer with hero dimensions, `var(--accent-cream)` base; verify dark mode renders muted warm shimmer in `components/skeletons/HeroSkeleton.tsx`
- [x] T027 [P] [US1] Update ProductCardSkeleton: warm-toned shimmer, `var(--surface)` card background, `rounded-2xl`; verify dark mode renders on `var(--surface)` in `components/skeletons/ProductCardSkeleton.tsx`

**Checkpoint**: Homepage shows complete warm cottagecore identity — "The Kiyon Store" header with flower icon, floral cart, hero with `warm-bg.jpeg` background illustration, warm footer, all skeletons warm-toned. Dark mode shows warm dark variant on all elements. This is the MVP deliverable.

---

## Phase 4: User Story 2 — Browsing & Discovering Products (Priority: P2)

**Goal**: A shopper browses products with warm-styled cards, category filter tabs sourced from `CATEGORY_FILTERS`, heart/wishlist icons, and prices in ₹. Product detail pages maintain the cottagecore styling.

**Independent Test**: Navigate to the products page, verify warm card styling with heart icons, filter by category using tabs (All, Handbag, Flowers, Flower Pots, Keychains, Hair Accessories), click into a product detail page and confirm warm typography and `var(--surface)` card backgrounds. Toggle dark mode and confirm all product elements render correctly.

### Product Grid & Cards

- [x] T028 [US2] Style product cards: `var(--surface)` background, `shadow-warm`, `rounded-2xl`, `var(--border-warm)` image border, `var(--foreground)` product name, price in ₹ (INR) via `useCurrency()`, warm hover state (subtle elevation, not blue outline); verify cards render on `var(--surface)` in dark mode in `components/sections/ProductGrid.tsx`
- [x] T029 [US2] Add heart/wishlist icon (visual only — no persistence) to product cards: `var(--accent-pink)` heart SVG with hover effect, positioned in card corner; verify heart icon visible in both light and dark mode in `components/sections/ProductGrid.tsx`
- [x] T030 [US2] Add category filter tabs using `CATEGORY_FILTERS` imported from `lib/constants/categories.ts` (All, Handbag, Flowers, Flower Pots, Keychains, Hair Accessories); active tab indicator with `var(--accent-warm)` border/background, `var(--foreground)` active text, `var(--text-secondary)` inactive text; verify filter tabs render and function in dark mode in `components/sections/ProductGrid.tsx`

### Product-Related Components

- [x] T031 [P] [US2] Update QuickAddButton: coral/warm gradient button using `var(--accent-warm)` → `var(--accent-rose)`, white text, `rounded-full`, `focus-warm` ring; verify in dark mode in `components/sections/QuickAddButton.tsx`
- [x] T032 [P] [US2] Update StockBadge: sage (`var(--accent-sage)`) for in-stock, peach (`var(--accent-peach)`) for low-stock, warm brown text; verify badge contrast in dark mode in `components/sections/StockBadge.tsx`
- [x] T033 [P] [US2] Update ProductStockBadge: warm badge colors matching StockBadge token usage; verify contrast on `var(--surface)` in dark mode in `components/product/ProductStockBadge.tsx`
- [x] T034 [P] [US2] Update VariationButton: `var(--border-warm)` border on selected state, `var(--accent-cream)` hover background, `var(--surface)` default background, `focus-warm` ring; verify selection state visible in dark mode in `components/product/VariationButton.tsx`

### Product Detail Page

- [x] T035 [US2] Style product detail page: warm typography (`font-display` for product name), `rounded-2xl` image framing with `var(--border-warm)`, `var(--surface)` content panels, warm add-to-cart controls (CtaButton style), price in ₹ (INR); replace any hardcoded colors with tokens; verify full page renders in dark mode in `app/products/[id]/page.tsx`

### Product Error & Loading States

- [x] T036 [P] [US2] Style products error page: `var(--background)` page bg, `var(--foreground)` text, warm retry button, decorative flower element; verify in dark mode in `app/products/error.tsx`
- [x] T037 [P] [US2] Style products loading skeleton: warm shimmer using `var(--accent-cream)` / `var(--accent-blush)`, product grid layout; verify in dark mode in `app/products/loading.tsx`
- [x] T038 [P] [US2] Style product detail loading skeleton: warm shimmer for image placeholder, text lines, and price area; verify in dark mode in `app/products/[id]/loading.tsx`

**Checkpoint**: Product listing shows warm cards with heart icons and `CATEGORY_FILTERS` filter tabs; product detail page is fully cottagecore-styled on `var(--surface)` backgrounds; all product loading/error states use warm palette. Dark mode renders warm dark variant on all product elements.

---

## Phase 5: User Story 3 — Shopping Cart Experience (Priority: P3)

**Goal**: The cart page displays warm-styled items with decorative leaf/flower elements, `var(--surface)` card backgrounds, a coral "Checkout →" button, and the floral cart icon in the header updates with item count.

**Independent Test**: Add items to cart, navigate to cart page, verify warm styling with `var(--surface)` card backgrounds, decorative elements, coral checkout button, and correct item count on floral cart icon. Toggle dark mode and confirm all cart elements render correctly.

- [x] T039 [US3] Style CartItemRow: `var(--surface)` background, `var(--border-warm)` border, `var(--foreground)` text, `var(--text-secondary)` quantity labels, warm +/- controls; replace any hardcoded colors with tokens; verify row renders on `var(--surface)` in dark mode in `components/cart/CartItemRow.tsx`
- [x] T040 [US3] Style cart page: decorative leaf/flower elements (LeafAccent from DecorativeElements) in margins, coral "Checkout →" CtaButton, warm running subtotal in `var(--foreground)`, `var(--background)` page bg, `var(--surface)` for cart summary panel; replace any hardcoded colors; verify full cart page renders in dark mode in `app/cart/page.tsx`

**Checkpoint**: Cart page shows warm-styled items with decorative elements and coral checkout CTA. Dark mode renders warm dark variant. Floral cart icon (added in US1) displays correct item count.

---

## Phase 6: User Story 4 — About Us & Brand Story (Priority: P4)

**Goal**: The About page tells the "The Kiyon Store" brand story with illustrated backgrounds, floral bullet-point icons, and a three-column crafting process section, all using CSS variable tokens for dark mode compatibility.

**Independent Test**: Navigate to the About page, verify illustrated background, floral icons beside brand values, storytelling tone, and three-column crafting process layout. Toggle dark mode and confirm warm dark variant.

- [x] T041 [US4] Redesign About page hero: illustrated background (CSS background-image or warm gradient), brand values with FlowerBullet icons (🌸 from DecorativeElements): "Handmade with love", "Small batch", "Eco-friendly", "Made for you ❤️"; warm personal storytelling tone; all colors using `var(--background)`, `var(--foreground)`, `var(--surface)` tokens; verify in dark mode in `app/about/page.tsx`
- [x] T042 [US4] Add three-column crafting process section: "Our Story", "Made with Love", "From Our Hands to Yours" with illustrated imagery or warm gradient cards; `var(--surface)` card backgrounds, `font-display` section headings, `var(--text-secondary)` descriptions; responsive (single-column on mobile); verify in dark mode in `app/about/page.tsx`

**Checkpoint**: About page delivers complete brand story with illustrated backgrounds, floral icons, and three-column crafting process layout. Dark mode renders warm dark variant with readable text on `var(--surface)` cards.

---

## Phase 7: User Story 5 — Decorative Elements & Visual Polish (Priority: P5)

**Goal**: Scattered decorative elements (flowers, leaves, butterflies, mushrooms, floral vine borders) add whimsy across all pages without obstructing content or failing accessibility. Auth pages and secondary pages pass dark mode token compliance.

**Independent Test**: Visually inspect each redesigned page for decorative elements; verify they don't obstruct content, are hidden from screen readers, and hide/scale on mobile viewports. Verify auth pages and secondary pages have no hardcoded light-only colors.

**Note**: All decorative SVG components (FloralCartIcon, ButterflyAccent, MushroomAccent, FloralBorder, ScatteredFlowers, VineDivider, FlowerAccent, LeafAccent, SparkleAccent, FlowerBullet) already exist in `DecorativeElements.tsx` (completed in T007). This phase is purely about placement and verification.

### Decorative Placement (per page)

- [x] T043 [P] [US5] Place decorative elements on homepage: ScatteredFlowers in hero margins, FloralBorder between sections, LeafAccent near product grid; all with `hidden sm:block` responsive hiding and `aria-hidden="true"`; verify placement doesn't break layout in dark mode in `app/page.tsx`
- [x] T044 [P] [US5] Place decorative elements on product pages: ButterflyAccent on product detail page, FlowerAccent on product listing heading; all with `hidden sm:block` and `aria-hidden="true"`; verify in dark mode in `app/products/[id]/page.tsx` and `components/sections/ProductGrid.tsx`
- [x] T045 [P] [US5] Place decorative elements on cart page: LeafAccent in cart margins, MushroomAccent near checkout area; with `hidden sm:block` and `aria-hidden="true"`; verify in dark mode in `app/cart/page.tsx`
- [x] T046 [P] [US5] Place decorative elements on about page: FloralBorder as section dividers, ButterflyAccent near brand story, SparkleAccent near crafting process; with `hidden sm:block` and `aria-hidden="true"`; verify in dark mode in `app/about/page.tsx`

### Auth & Secondary Page Token Compliance

- [x] T047 [US5] Update auth pages and components with dark mode token compliance per FR-031/FR-034: replace hardcoded `bg-white` with `var(--surface)`, hardcoded text colors with `var(--foreground)` / `var(--text-secondary)` in `app/auth/signin/page.tsx`, `app/auth/error/page.tsx`, `components/auth/OAuthButtons.tsx`, `components/auth/LoginModal.tsx`; verify auth pages render correctly in dark mode
- [x] T048 [US5] Visual verification pass on secondary customer-facing pages (FR-037): confirm Blog, Careers, Help, Press, Returns, Shipping, Contact, Orders, and Account pages inherit warm theme via global CSS tokens and restyled Header/Footer; flag and fix any legacy hardcoded colors that clash with the new palette

### Decorative Accessibility Verification

- [x] T049 [US5] Verify all placed decorative components: confirm every instance uses `aria-hidden="true"`, `hidden sm:block` responsive hiding (below 640px), and `prefers-reduced-motion` animation respect; run screen reader pass to confirm decoratives are invisible to assistive technology

**Checkpoint**: All redesigned pages have decorative embellishments; elements are hidden on mobile (<640px), marked as presentational, and don't obstruct content. Auth pages pass dark mode token compliance. Secondary pages confirmed clean with inherited tokens.

---

## Phase 8: User Story 6 — Responsive & Accessible Experience (Priority: P6)

**Goal**: All redesigned pages work fluidly across mobile/tablet/desktop, meet WCAG 2.1 AA standards in BOTH light and dark modes, and support reduced motion preferences.

**Independent Test**: Resize browser across breakpoints, run accessibility audit in both light and dark mode, enable reduced motion — verify all redesigned pages respond correctly.

- [x] T050 [P] [US6] Responsive audit: verify all redesigned pages at 375px (single-column, collapsed nav, 44×44px touch targets), 768px (two-column product grid, scaled hero), 1440px (full desktop layout with decorative elements); verify decorative elements hide below 640px per FR-029
- [x] T051 [P] [US6] Contrast audit in BOTH modes: verify WCAG 2.1 AA ratios — `var(--foreground)` on `var(--background)` (≥4.5:1), white on coral CTA buttons (≥3:1 large text), `var(--text-secondary)` on `var(--background)` (≥4.5:1), `var(--text-muted)` on `var(--background)` (≥4.5:1 per FR-031); check dark mode `#ededed` on `#1a1412` and `#a89080` on `#1a1412`
- [x] T052 [US6] Focus ring audit: verify warm-toned focus indicators (`focus-warm` ring using `var(--accent-warm)`) are visible on all interactive elements — buttons, links, inputs, cards, filter tabs, navigation items; verify focus rings visible in dark mode
- [x] T053 [US6] Dark mode full audit: systematically verify EVERY redesigned page and component renders warm dark variant — `var(--background)` dark brown `#1a1412`, `var(--surface)` dark `#241c16`, muted accents, cream-tinted text; confirm no white backgrounds, no invisible text, no hardcoded hex colors remain; include Header dropdowns, mobile nav, CurrencySelector `<option>` elements, auth pages
- [x] T054 [US6] Reduced motion audit: verify `prefers-reduced-motion: reduce` disables all decorative animations (float, shimmer, fade); confirm no layout shifts when animations disabled; verify skeleton loading still shows static warm background

**Checkpoint**: All pages pass responsive, contrast, focus, dark mode, and reduced motion audits. WCAG 2.1 AA compliance confirmed in both light and dark modes.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all user stories — regression, performance, admin safety, visual fidelity

- [x] T055 Run full test suite regression: `npm run test` — all 426+ existing tests must pass with zero failures (SC-005)
- [x] T056 Run lint check: `npm run lint` — must pass with zero errors
- [x] T057 Verify admin pages unchanged: confirm `/admin/`, `/admin/products`, `/admin/orders`, `/admin/users` render identically to pre-redesign with no visual changes (FR-034); only exception is category dropdown (FR-038) and dark mode `select option` styling (FR-039), both already complete
- [x] T058 Verify no backend files modified: confirm zero changes to `lib/*` (except `lib/constants/`), `app/api/*`, database schema, auth logic (FR-035)
- [x] T059 Performance audit: verify LCP < 2.5s on homepage (SC-006), no layout shifts from font loading or hero CSS background-image, hero `warm-bg.jpeg` is optimized, Playfair Display uses `display: swap`
- [x] T060 Visual comparison: side-by-side check of all redesigned pages against prototype images in `public/prototype2.jpeg` — verify hero layout (top-left quadrant), product grid (top-right), about page (bottom-left), cart (bottom-right) match at ≥90% fidelity (SC-008)
- [x] T061 Run Playwright E2E tests: execute existing visual regression and interaction tests in `playwright-tests/` to verify no functional regressions (SC-007)
- [x] T062 Run quickstart.md validation checklist: verify all items from `specs/001-cozy-shop-ui/quickstart.md` pass — including dark mode on all pages, `CATEGORY_FILTERS` for tabs, `--surface` for cards, no hardcoded colors, responsive breakpoints

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) [x]
  └── Phase 2 (Foundational — Design Tokens & Typography) [x] ⚠️ BLOCKS ALL
        ├── Phase 3 (US1 — First Impression) 🎯 MVP
        │     ├── Phase 4 (US2 — Product Browsing)
        │     │     └── Phase 5 (US3 — Cart Experience)
        │     ├── Phase 6 (US4 — About Page)
        │     └── Phase 7 (US5 — Decorative Polish + Auth/Secondary)
        └── Phase 8 (US6 — Responsive & Accessibility) [after Phases 3–7]
              └── Phase 9 (Polish & Validation) [after all]
```

### User Story Dependencies

| Story        | Depends On                                         | Can Parallel With | Notes                                      |
| ------------ | -------------------------------------------------- | ----------------- | ------------------------------------------ |
| **US1** (P1) | Phase 2 (Foundational)                             | —                 | Must complete first (shared UI components) |
| **US2** (P2) | US1 (shared UI components: Card, Badge, CtaButton) | US4, US5          | Product cards use Card/Badge from US1      |
| **US3** (P3) | US1 (CartIcon, CtaButton already warm)             | US4, US5          | Cart page uses warm CtaButton from US1     |
| **US4** (P4) | US1 (GradientHeading, DecorativeElements)          | US2, US3, US5     | About page uses shared components from US1 |
| **US5** (P5) | US1 (DecorativeElements base exists)               | US2, US3, US4     | Places decoratives + auth/secondary audit  |
| **US6** (P6) | US1–US5 (all pages must be styled first)           | —                 | Cross-cutting validation of all stories    |

### Within Each User Story

- Shared UI components before layout components
- Layout components before section components
- Section components before page composition
- All [P] tasks within a phase can run in parallel
- Every component edit MUST include dark mode verification

### Parallel Opportunities

**Within Phase 3 (US1):**

- T008–T013 (all shared UI components) can run in parallel — different files
- T023, T024 (error/loading) can run in parallel — different files
- T025–T027 (all skeletons) can run in parallel — different files

**Across User Stories (after US1 completes):**

- US2, US4, US5 can proceed in parallel (different files, different pages)
- US3 can start once CartIcon is done (in US1)

**Within Phase 4 (US2):**

- T031–T034 (product sub-components) can run in parallel — different files
- T036–T038 (error/loading states) can run in parallel — different files

**Within Phase 7 (US5):**

- T043–T046 (decorative placement on different pages) can run in parallel — different files

**Within Phase 8 (US6):**

- T050, T051 (responsive + contrast audits) can run in parallel — different audit types

---

## Parallel Example: US1 (Phase 3)

```bash
# Step 1: All shared UI components in parallel (different files)
T008: components/ui/Card.tsx              [--surface bg, dark mode]
T009: components/ui/GradientButton.tsx    [warm gradient, dark mode]
T010: components/ui/GradientHeading.tsx   [font-display, dark mode]
T011: components/ui/Badge.tsx             [warm variants, dark mode]
T012: components/ui/CtaButton.tsx         [coral CTA, dark mode]
T013: components/ui/EmptyState.tsx        [warm state, dark mode]

# Step 2: Focus ring across UI components
T014: components/ui/* (depends on T008–T013)

# Step 3: Layout components (depends on shared UI)
T015–T017: components/layout/Header.tsx (sequential — same file, token replacement)
T018: components/layout/CartIcon.tsx (parallel with Header — FloralCartIcon)
T019: components/layout/Footer.tsx (parallel with Header — token replacement)

# Step 4: Hero section
T020–T021: components/sections/Hero.tsx (sequential — bg image + text overlay)

# Step 5: Homepage + error/loading + skeletons in parallel
T022: app/page.tsx
T023: app/error.tsx
T024: app/loading.tsx
T025: components/skeletons/HeaderSkeleton.tsx
T026: components/skeletons/HeroSkeleton.tsx
T027: components/skeletons/ProductCardSkeleton.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. ~~Complete Phase 1: Setup~~ ✅
2. ~~Complete Phase 2: Foundational~~ ✅
3. Complete Phase 3: User Story 1 — First Impression & Brand Identity
4. **STOP and VALIDATE**: Homepage delivers warm cottagecore identity in BOTH light and dark mode
5. Deploy/demo if ready — this alone transforms the site's first impression

### Incremental Delivery

1. ~~Setup + Foundational → Token system ready~~ ✅
2. **US1** → Homepage + Header + Footer + Hero (with dark mode) → **Deploy/Demo (MVP!)**
3. **US2** → Product browsing with warm cards, `CATEGORY_FILTERS` tabs & hearts → Deploy/Demo
4. **US3** → Cart page with warm `--surface` styling → Deploy/Demo
5. **US4** → About page brand story → Deploy/Demo
6. **US5** → Decorative polish + auth pages dark mode + secondary verification → Deploy/Demo
7. **US6** → Responsive & accessibility validation (both modes) → Final sign-off
8. **Polish** → Regression, performance, visual comparison → Ship it

### Parallel Team Strategy

With multiple developers after Foundational + US1 are complete:

- Developer A: US2 (Product browsing)
- Developer B: US3 (Cart) + US4 (About)
- Developer C: US5 (Decorative elements + auth/secondary verification)
- All converge for US6 (cross-cutting audits) and Phase 9 (Polish)

---

## Notes

- **Dark mode is MANDATORY**: Every component edit must use CSS variable tokens — no hardcoded hex. Verify dark mode renders for every task.
- **`--surface` for cards/panels**: Use `var(--surface)` (light: `#ffffff`, dark: `#241c16`) for all card and panel backgrounds.
- **`CATEGORY_FILTERS` for tabs**: Import from `lib/constants/categories.ts` for product filter tabs.
- **No backend changes**: Do not modify `lib/*` (except `lib/constants/`), `app/api/`, database schema (FR-035)
- **No admin changes**: Do not modify `app/admin/*`, `components/admin/*` (FR-034, exceptions already done)
- **Auth pages in scope**: Auth pages (`app/auth/*`, `components/auth/*`) must comply with dark mode token rules (FR-031)
- **Existing tests**: All 426+ unit tests must continue passing (SC-005)
- **Performance**: LCP must remain < 2.5s (SC-006)
- **Accessibility**: WCAG 2.1 AA compliance in BOTH light and dark mode throughout (FR-031)
- **Decoratives**: Always `aria-hidden="true"` and `hidden sm:block` for responsive hiding
- **Static pages** (Blog, Careers, Help, Press, Returns, Shipping, Orders): Inherit warm aesthetic via global tokens and shared Header/Footer — visual verification in T048
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently

---

## FR Coverage Matrix

| FR     | Task(s)              | Phase   | Dark Mode             |
| ------ | -------------------- | ------- | --------------------- |
| FR-001 | T002, T008–T013      | 2, 3    | ✅ Tokens             |
| FR-002 | T003, T006, T010     | 2, 3    | ✅ Tokens             |
| FR-003 | T002                 | 2       | ✅ Tokens             |
| FR-004 | T002, T053           | 2, 8    | ✅ Full               |
| FR-005 | T015                 | 3       | ✅ Tokens             |
| FR-006 | T015                 | 3       | ✅ Tokens             |
| FR-007 | T007, T018           | 2, 3    | ✅ Tokens             |
| FR-008 | T017                 | 3       | ✅ Tokens             |
| FR-009 | T016                 | 3       | ✅ Tokens             |
| FR-010 | T020                 | 3       | ✅ Tokens             |
| FR-011 | T021                 | 3       | ✅ Tokens             |
| FR-012 | T021                 | 3       | ✅ Tokens             |
| FR-013 | T021                 | 3       | ✅ Tokens             |
| FR-014 | T028                 | 4       | ✅ Tokens             |
| FR-015 | T028, T029           | 4       | ✅ Tokens             |
| FR-016 | T030                 | 4       | ✅ CATEGORY_FILTERS   |
| FR-017 | T030                 | 4       | ✅ Tokens             |
| FR-018 | T035                 | 4       | ✅ Tokens             |
| FR-019 | T035                 | 4       | ✅ Tokens             |
| FR-020 | T039, T040           | 5       | ✅ --surface          |
| FR-021 | T040                 | 5       | ✅ Tokens             |
| FR-022 | T040, T045           | 5, 7    | ✅ Tokens             |
| FR-023 | T041                 | 6       | ✅ Tokens             |
| FR-024 | T041                 | 6       | ✅ Tokens             |
| FR-025 | T042                 | 6       | ✅ --surface          |
| FR-026 | T019                 | 3       | ✅ Tokens             |
| FR-027 | T043–T046            | 7       | N/A (decorative)      |
| FR-028 | T049                 | 7       | N/A (aria)            |
| FR-029 | T049, T050           | 7, 8    | N/A (responsive)      |
| FR-030 | T050                 | 8       | N/A (responsive)      |
| FR-031 | T051, T053, T047     | 8, 7    | ✅ Full audit         |
| FR-032 | T004, T014, T052     | 2, 3, 8 | ✅ focus-warm         |
| FR-033 | T055, T061           | 9       | ✅ Regression         |
| FR-034 | T057                 | 9       | ✅ Admin excluded     |
| FR-035 | T058                 | 9       | N/A                   |
| FR-036 | T023–T027, T036–T038 | 3, 4    | ✅ Tokens             |
| FR-037 | T048                 | 7       | ✅ Token inheritance  |
| FR-038 | T002 (complete)      | 2       | ✅ PRODUCT_CATEGORIES |
| FR-039 | T002 (complete)      | 2       | ✅ select option rule |
