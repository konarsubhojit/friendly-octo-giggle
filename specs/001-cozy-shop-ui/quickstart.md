# Quickstart: Cozy Shop UI Redesign

**Feature**: 001-cozy-shop-ui
**Branch**: `001-cozy-shop-ui`

## Prerequisites

- Node.js 20+
- The feature branch checked out: `git checkout 001-cozy-shop-ui`
- Dependencies installed: `npm install`

## Development Workflow

```bash
# Start dev server
npm run dev

# Run unit tests (watch mode)
npm run test:watch

# Run full test suite
npm run test

# Lint check
npm run lint
```

## What's Already Done (Phase 1–2)

The design token system and foundational components are complete:

- **`app/globals.css`**: All CSS custom properties (light + dark mode), warm utilities (`shadow-warm`, `bg-warm-gradient`, `text-warm-heading`, `font-display`, `focus-warm`, `border-warm`), animation keyframes, `prefers-reduced-motion` support, dark mode `select option` rule
- **`app/layout.tsx`**: Playfair Display font loaded via `next/font/google`, metadata set to "The Kiyon Store"
- **`components/ui/DecorativeElements.tsx`**: FloralCartIcon, ButterflyAccent, MushroomAccent, FloralBorder added
- **`lib/constants/categories.ts`**: `PRODUCT_CATEGORIES`, `CATEGORY_FILTERS`, `ProductCategory` type
- **`components/admin/ProductFormModal.tsx`**: Category `<select>` dropdown using `PRODUCT_CATEGORIES`

## Remaining Work — Key Files to Edit (in priority order)

### Phase 3: User Story 1 — First Impression (T008–T027)

**Shared UI Components** (can be done in parallel):

1. `components/ui/Card.tsx` — Warm border, `var(--surface)` background, `shadow-warm`
2. `components/ui/GradientButton.tsx` — Coral/warm gradient
3. `components/ui/GradientHeading.tsx` — `font-display` + warm gradient
4. `components/ui/Badge.tsx` — Warm color variants (sage, peach, blush)
5. `components/ui/CtaButton.tsx` — Coral/salmon, `rounded-full`, white bold text
6. `components/ui/EmptyState.tsx` — Warm illustration + cream background
7. All `components/ui/*` — Add `focus-warm` ring to interactive elements

**Layout Components** (sequential — Header first): 8. `components/layout/Header.tsx` — "The Kiyon Store" + flower icon, warm nav, warm mobile menu, warm search 9. `components/layout/CartIcon.tsx` — Replace with FloralCartIcon 10. `components/layout/Footer.tsx` — Cottagecore restyling

**Hero Section**: 11. `components/sections/Hero.tsx` — Background image `warm-bg.jpeg`, "Handmade With Love" heading, coral CTA

**Homepage & States**: 12. `app/page.tsx` — Update metadata 13. `app/error.tsx` — Warm error boundary 14. `app/loading.tsx` — Warm skeleton shimmer

**Skeletons** (parallel): 15. `components/skeletons/HeaderSkeleton.tsx` — Warm shimmer 16. `components/skeletons/HeroSkeleton.tsx` — Warm shimmer 17. `components/skeletons/ProductCardSkeleton.tsx` — Warm shimmer

### Phase 4: User Story 2 — Product Browsing (T028–T038)

18. `components/sections/ProductGrid.tsx` — Warm cards, heart/wishlist, `CATEGORY_FILTERS` tabs
19. `components/sections/QuickAddButton.tsx` — Coral button
20. `components/sections/StockBadge.tsx` — Warm tones
21. `components/product/ProductStockBadge.tsx` — Warm badge
22. `components/product/VariationButton.tsx` — Warm selection
23. `app/products/[id]/page.tsx` — Warm detail page
24. `app/products/error.tsx` — Warm error
25. `app/products/loading.tsx` — Warm skeleton
26. `app/products/[id]/loading.tsx` — Warm skeleton

### Phase 5: User Story 3 — Cart Experience (T039–T040)

27. `components/cart/CartItemRow.tsx` — Warm styling
28. `app/cart/page.tsx` — Decorative elements, coral checkout CTA

### Phase 6: User Story 4 — About Page (T041–T042)

29. `app/about/page.tsx` — Brand story, illustrated background, three-column process

### Phase 7: User Story 5 — Decorative Placement (T043–T049)

30. New SVG components in `DecorativeElements.tsx` (if needed)
31. `app/page.tsx` — Homepage decoratives
32. `app/products/[id]/page.tsx` + `ProductGrid.tsx` — Product page decoratives
33. `app/cart/page.tsx` + `app/about/page.tsx` — Cart/about decoratives
34. Accessibility audit on all placed decoratives

### Phase 8–9: Audits & Validation (T050–T062)

35. Responsive audit (375px, 768px, 1440px)
36. Contrast audit (WCAG 2.1 AA, both modes)
37. Focus ring audit
38. Dark mode audit (all pages)
39. Reduced motion audit
40. `npm run test` — zero regressions
41. `npm run lint` — zero errors
42. Admin pages unchanged verification
43. No backend files modified verification
44. LCP < 2.5s performance audit
45. Visual comparison vs `prototype2.jpeg`
46. Playwright E2E tests

## Dark Mode Implementation Rule

**MANDATORY for every component edit**: No hardcoded light-only colors. Every color must use either:

- CSS variable: `var(--foreground)`, `var(--background)`, `var(--surface)`, etc.
- Tailwind `dark:` variant: `bg-white dark:bg-[var(--surface)]`
- Token-based class from `globals.css`: `border-warm`, `shadow-warm`, etc.

**Forbidden patterns**:

```tsx
// ❌ BAD — hardcoded light-only colors
className = 'bg-white text-gray-700 bg-[#fef7f2] text-[#4a3728]'

// ✅ GOOD — token-based
className = 'bg-[var(--surface)] text-[var(--foreground)]'
className = 'bg-[var(--background)] text-[var(--text-secondary)]'
```

## Static Assets

Available in `public/`:

- `warm-bg.jpeg` — Hero background illustration (girl crafting with cat)
- `normal-bg.jpeg` — Standard background texture
- `prototype1.jpeg` — Design reference 1
- `prototype2.jpeg` — **Authoritative** design prototype (4-quadrant layout)
- `cart.jpeg` — Cart reference image

## Important Constraints

- **No backend changes** (FR-035): Do not modify `lib/` (except constants), `app/api/`, database schema
- **No admin visual changes** (FR-034): Do not modify `app/admin/`, `components/admin/` (already completed exceptions)
- **Performance**: LCP must remain < 2.5s (SC-006)
- **Accessibility**: WCAG 2.1 AA in BOTH light and dark mode (FR-031)
- **Dark mode**: Fully functional, not just tokens (FR-004)
- **Existing tests**: All 426+ unit tests must continue passing (SC-005)
- **Category filters**: Use `CATEGORY_FILTERS` from `lib/constants/categories.ts` (FR-016, FR-038)

## Validation Checklist

- [ ] `npm run test` passes (426+ tests, zero regressions)
- [ ] `npm run lint` passes
- [ ] Homepage loads with warm cottagecore aesthetic
- [ ] Dark mode renders warm dark variant on ALL customer-facing pages
- [ ] No hardcoded light-only hex colors in any modified component
- [ ] Mobile responsive at 375px, 768px, 1440px
- [ ] All decorative elements have `aria-hidden="true"`
- [ ] Focus indicators use warm tones (`--accent-warm`)
- [ ] Admin pages (`/admin/*`) are unchanged
- [ ] No API/backend files modified
- [ ] LCP < 2.5s on homepage
- [ ] Side-by-side match with `prototype2.jpeg`
- [ ] `CATEGORY_FILTERS` used for storefront filter tabs
- [ ] Native `<select>` elements render correctly in dark mode
