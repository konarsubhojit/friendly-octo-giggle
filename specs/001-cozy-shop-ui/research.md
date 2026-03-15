# Research: Cozy Shop UI Redesign

**Feature**: 001-cozy-shop-ui
**Date**: 2026-03-15
**Status**: Complete (updated)

## R-001: Tailwind CSS v4.1 Theming Approach

**Question**: How to implement a comprehensive design token system in Tailwind CSS v4.1 for the cottagecore palette?

**Decision**: Use CSS custom properties in `globals.css` `:root` block as the design token layer, referenced by Tailwind's `@utility` directives and direct `var()` usage. No `tailwind.config.ts` theme extension needed — Tailwind v4 reads CSS variables natively.

**Rationale**: The project already uses this pattern (existing `--background`, `--foreground`, `--accent-*` variables in `globals.css`). Tailwind v4.1 with `@import "tailwindcss"` supports arbitrary CSS variables as first-class tokens. This avoids a separate config file and keeps tokens co-located with utilities.

**Alternatives considered**:

- `tailwind.config.ts` theme extension: Not needed in Tailwind v4.1; CSS-first config is the recommended approach
- CSS Modules / Styled Components: Would break existing Tailwind utility class patterns
- Separate `tokens.css` file: Unnecessary indirection; `globals.css` already serves as the token source

**Status**: ✅ Implemented in T002. All tokens defined in `globals.css` with light + dark mode variants. Custom utilities (`shadow-warm`, `bg-warm-gradient`, `text-warm-heading`, `border-warm`, `font-display`, `focus-warm`) created via `@utility`.

## R-002: Google Fonts for Cottagecore Typography

**Question**: Which decorative script and body fonts best convey "handmade cottagecore"?

**Decision**:

- **Headings/brand**: **Playfair Display** (elegant serif with italic flourish) via `next/font/google`
- **Body text**: Continue using **Nunito** (already configured) — warm, rounded, pairs well with decorative headings

**Rationale**: `Playfair Display` italic provides an elegant, handcrafted look without sacrificing readability at heading sizes. Both are Google Fonts (free, no licensing issues). The project already uses `next/font/google` for `Nunito`, so adding a second font follows the established pattern.

**Alternatives considered**:

- Dancing Script: Too casual, harder to read at smaller sizes
- Pacifico: Too retro/beachy, doesn't match cottagecore
- Caveat: True handwritten script — good for accent text but less readable for section headings

**Status**: ✅ Implemented in T006. Playfair Display loaded in `layout.tsx` with `--font-display` CSS variable.

## R-003: Dark Mode Implementation

**Question**: How to implement a warm dark mode that is fully functional (not just token prep)?

**Decision**: Extend the `@media (prefers-color-scheme: dark)` block in `globals.css` with warm dark mode values for ALL design tokens. Dark mode uses warm dark browns (#1a1412 background), muted accent colors, and cream-tinted text. All customer-facing components MUST use CSS variable tokens or `dark:` Tailwind variants — no hardcoded light-only hex colors anywhere.

**Rationale**: The spec (FR-004, FR-031, Pass 3 clarifications) explicitly requires fully functional dark mode. The approach leverages the existing `prefers-color-scheme` media query pattern. A `--surface` token (`#ffffff` light / `#241c16` dark) is defined for card/panel backgrounds. Native `<select>` elements get explicit dark mode rules.

**Key constraints** (from spec Pass 3):

- No hardcoded `bg-white`, `text-gray-700`, `#fef7f2`, `#4a3728` in customer-facing components
- All colors must use `var(--token)` or include explicit `dark:` Tailwind variants
- `--text-muted` must meet 4.5:1 contrast on `--background` in dark mode
- Native `<select>/<option>` elements must use `--surface` and `--foreground` tokens

**Alternatives considered**:

- Class-based dark mode toggle: More work, requires theme context; spec doesn't require manual toggle
- Skip dark mode: Explicitly prohibited by FR-004
- Token-only prep (no visual implementation): Rejected in spec Pass 3

**Status**: ✅ Token layer implemented in T002. Remaining: each component (T008–T049) must be audited during implementation to replace any hardcoded colors. T053 is the final dark mode audit.

## R-004: Decorative Asset Strategy

**Question**: How should decorative elements be implemented for performance and accessibility?

**Decision**: Inline SVG components in `DecorativeElements.tsx` with `aria-hidden="true"`. Background images (hero, warm-bg) served via `next/image` or CSS `background-image`. No external SVG sprites or animation libraries.

**Rationale**: The project already has `DecorativeElements.tsx` with `FlowerAccent`, `LeafAccent`, `SparkleAccent`, `VineDivider`, `FlowerBullet`, `ScatteredFlowers` — all inline SVG. This pattern gives zero-latency rendering, easy color theming via CSS variables, and built-in accessibility (`aria-hidden`). New elements (FloralCartIcon, ButterflyAccent, MushroomAccent, FloralBorder) follow the same pattern.

**Alternatives considered**:

- SVG sprite sheet: More complex build setup, harder to theme dynamically
- External SVG files: Additional HTTP requests, harder to inline `aria-hidden`
- Lottie/animation library: Violates performance constraint

**Status**: ✅ Implemented in T007. All 4 new decorative components exist. Remaining: placement on pages (T043–T049).

## R-005: Hero Illustration Integration

**Question**: How to integrate the hero illustration as a full-width background image with text overlay?

**Decision**: Use `public/warm-bg.jpeg` as a CSS `background-image` covering the full hero area (matching `prototype2.jpeg` top-left quadrant). Hero text (heading, subtitle, CTA) overlays on the left side with a warm semi-transparent backdrop (~40-60% opacity warm cream) for legibility. The illustration remains visible across the full hero width.

**Rationale**: The spec (FR-010, Pass 2 clarification) explicitly states the illustration should be a background image, not a standalone displayed image. A CSS background-image with `object-fit: cover` provides the right visual treatment. The warm backdrop behind text ensures WCAG contrast compliance without obscuring the illustration.

**Alternatives considered**:

- `next/image` as foreground element: Contradicts spec FR-010 ("background image")
- CSS background-image without `next/image` optimization: Acceptable for hero background since it's a single decorative image; the `priority` optimization matters less for CSS backgrounds
- Split hero into two columns (image + text): Contradicts prototype showing full-width illustration with text overlay

**Status**: Pending — T020, T021.

## R-006: Component Redesign Scope Analysis

**Question**: Which existing components need modification and which are out of scope?

**Decision**:

**In scope (customer-facing)**: 20 component files, 9 page files, as detailed in plan.md Project Structure.

**Out of scope (per FR-034/FR-035)**:

- `app/admin/*` — All admin panel pages
- `app/api/*` — All API routes
- `lib/*` — All backend logic, DB, auth, Redis (except `lib/constants/categories.ts` already done)
- `components/admin/*` — Admin components (except ProductFormModal dropdown, already done)
- `app/auth/*` — Auth pages (not in spec scope)

**Admin exceptions (already implemented)**:

- FR-038: `components/admin/ProductFormModal.tsx` — category `<select>` dropdown using `PRODUCT_CATEGORIES`
- FR-039: `app/globals.css` — dark mode `select option` CSS rules

**Status**: ✅ Scope fully defined. Admin exceptions already implemented.

## R-007: Responsive Breakpoint Strategy

**Question**: How to handle decorative elements and layouts across breakpoints?

**Decision**: Use Tailwind's responsive utilities (`sm:`, `md:`, `lg:`) with `hidden sm:block` patterns for decorative elements. Mobile-first approach:

- Mobile (<640px): Single-column, decoratives hidden, collapsed nav, 44×44px touch targets
- Tablet (640px–1024px): Two-column product grid, scaled hero, reduced decoratives
- Desktop (>1024px): Full layout with all decorative elements

**Rationale**: Follows Tailwind's mobile-first approach and satisfies FR-029 (decorative elements scale down/hide below 640px) and FR-030 (mobile-first responsive).

**Status**: Pending — enforced per-component in T008–T049, audited in T050.

## R-008: WCAG Contrast Compliance

**Question**: Do the proposed warm colors meet WCAG 2.1 AA contrast ratios in BOTH modes?

**Decision**: Verified key combinations:

**Light mode**:

- Warm brown `#4a3728` on cream `#fef7f2`: ratio ~8.2:1 ✅ (AA normal + large)
- Medium brown `#7a6355` on cream `#fef7f2`: ratio ~4.5:1 ✅ (AA normal text)
- Muted brown `#b89a85` on cream `#fef7f2`: ratio ~2.6:1 ⚠️ (AA large text only — use for captions)
- White `#FFFFFF` on coral `#d4856b`: ratio ~3.2:1 ✅ (AA large text / bold buttons)

**Dark mode**:

- Light text `#ededed` on dark brown `#1a1412`: ratio ~13.5:1 ✅
- Secondary `#d4c0b0` on dark brown `#1a1412`: ratio ~8.5:1 ✅
- Muted `#a89080` on dark brown `#1a1412`: ratio ~5.0:1 ✅ (AA normal text)

**Action**: Button text uses bold font (16px+ bold = "large text" per WCAG), meeting 3:1 ratio. `--text-muted` updated in dark mode to `#a89080` to ensure 4.5:1 compliance on `--background`.

**Status**: ✅ Token values verified. Per-component compliance audited in T051.

## R-009: Performance Budget for Decorative Assets

**Question**: Will adding decorative images and fonts impact LCP?

**Decision**:

- Inline SVGs: Zero additional HTTP requests — no performance impact
- Hero illustration: CSS `background-image` — not LCP-critical since text overlays are the primary content
- Playfair Display font: `next/font/google` auto-subsets and self-hosts. Adds ~15-20KB. `display: "swap"` prevents layout shift.
- No heavy animation libraries — all animations are CSS keyframes

**Constraint**: SC-006 requires LCP < 2.5s. The inline SVG approach + optimized images + font subsetting maintains this budget easily.

**Status**: ✅ Font loading verified (T006). Hero image and performance audit pending (T059).

## R-010: Shared Category Constant Architecture

**Question**: How to ensure product categories are consistent between admin forms and storefront filters?

**Decision**: Single source of truth in `lib/constants/categories.ts`:

- `PRODUCT_CATEGORIES`: Array of category strings used in admin `<select>` dropdown
- `CATEGORY_FILTERS`: `["All", ...PRODUCT_CATEGORIES]` used in storefront filter tabs
- `ProductCategory`: TypeScript type derived from the constant

**Rationale**: Eliminates drift between admin input and storefront display. The shared constant ensures any category added in the admin form immediately appears as a filter option.

**Status**: ✅ Implemented. `ProductFormModal.tsx` uses `PRODUCT_CATEGORIES`; storefront `ProductGrid` will use `CATEGORY_FILTERS` in T030.
