# UI Contracts: Cozy Shop UI Redesign

**Feature**: 001-cozy-shop-ui
**Date**: 2026-03-15 (updated)

> This feature is UI-only. No external API contracts change.
> This document defines the **visual contracts** — the design tokens and component interfaces that must be consistent across the redesign.

## 1. Design Token Contract

### CSS Custom Properties (`:root`)

All customer-facing components MUST use these CSS variables (never hardcoded hex values):

```css
:root {
  /* Core palette */
  --background: #fef7f2;
  --foreground: #4a3728;
  --surface: #ffffff;

  /* Accent palette */
  --accent-warm: #e8a87c;
  --accent-rose: #d4856b;
  --accent-peach: #f8c8a8;
  --accent-cream: #fff5eb;
  --accent-blush: #fde8d8;
  --accent-sage: #b8c9a3;
  --accent-pink: #e8a0bf;

  /* Semantic tokens */
  --border-warm: #f0d5c0;
  --text-secondary: #7a6355;
  --text-muted: #b89a85;

  /* Typography */
  --font-display: 'Playfair Display', serif;
  --font-body: 'Nunito', sans-serif;
}
```

### Dark Mode Contract

All tokens MUST have a `@media (prefers-color-scheme: dark)` override. Dark mode is **fully functional** — not just token preparation.

**Forbidden**:

- Hardcoded `bg-white`, `bg-gray-*`, `text-gray-*`, `text-black` in customer-facing components
- Inline hex colors (`#fef7f2`, `#4a3728`, etc.) in className strings
- Any color that doesn't have a dark mode equivalent via tokens or `dark:` variant

**Required**:

- All backgrounds: `var(--background)`, `var(--surface)`, `var(--accent-cream)`, or equivalent `dark:` variant
- All text: `var(--foreground)`, `var(--text-secondary)`, `var(--text-muted)`, or equivalent `dark:` variant
- All borders: `var(--border-warm)` or equivalent `dark:` variant
- Native `<select>/<option>`: Inherit from global dark mode rule (`select option { background-color: var(--surface); color: var(--foreground); }`)

## 2. Component Interface Contracts

### DecorativeElement Props

All decorative components exported from `DecorativeElements.tsx` MUST:

- Accept `readonly className?: string` prop
- Render with `aria-hidden="true"` on the root SVG/container
- Use palette CSS variables (not hardcoded colors) where practical
- Respect `prefers-reduced-motion` for any animation
- Use `hidden sm:block` pattern for responsive hiding (unless always-visible like VineDivider)

### Product Card Contract

Product cards displayed in grids MUST render:

- Product image with warm border (`border-[var(--border-warm)]`)
- Product name (truncated with ellipsis if > 2 lines)
- Price displayed in ₹ (INR) via `useCurrency()` hook
- Heart/wishlist icon (visual only — no persistence in this feature)
- Warm hover state (elevation change, no blue outlines)
- `var(--surface)` background (works in both light and dark mode)

### Category Filter Tabs Contract

Filter tabs on the product listing page MUST:

- Use `CATEGORY_FILTERS` from `lib/constants/categories.ts` as the source of tab labels
- Display: All, Handbag, Flowers, Flower Pots, Keychains, Hair Accessories
- Show warm selection indicator on active tab (`var(--accent-warm)` border or background)
- Use `var(--text-secondary)` for inactive tabs, `var(--foreground)` for active

### CTA Button Contract

All primary call-to-action buttons MUST:

- Use coral/warm gradient (`from-[var(--accent-warm)] to-[var(--accent-rose)]`)
- Be `rounded-full` with adequate padding
- Use white text in bold/semibold (meeting 3:1 contrast for large text)
- Include hover state with darker gradient and subtle scale
- Work in both light and dark mode

### Focus Indicator Contract

All interactive elements MUST:

- Show a visible focus ring on keyboard navigation
- Use warm-toned focus ring (not browser default blue)
- Implementation: `focus-warm` utility from `globals.css`
- Equivalent to: `focus-visible:ring-2 focus-visible:ring-[var(--accent-warm)] focus-visible:ring-offset-2`

### Hero Section Contract

The hero section MUST:

- Use `public/warm-bg.jpeg` as a full-width CSS background image
- Display text overlay on the left side: "Handmade With Love" heading, subtitle, coral CTA
- Include a warm semi-transparent backdrop (~40-60% opacity) behind text for legibility
- Heading uses `--font-display` italic, subtitle uses uppercase tracking
- CTA button labeled "Explore Shop →" navigates to `/products`

### Skeleton/Loading State Contract

All skeleton/loading components MUST:

- Use warm-toned shimmer animation (peach/cream gradient, not gray)
- Background: `var(--accent-cream)` or `var(--accent-blush)` with shimmer overlay
- Work correctly in both light and dark mode

## 3. Page Layout Contract

### Customer-Facing Pages

All customer-facing pages MUST:

- Use `var(--background)` as page background
- Include `<Header />` and `<Footer />` (except admin)
- Maintain max content width of `max-w-7xl` with responsive padding
- Work in both light and dark mode with zero hardcoded light-only colors

### Admin Pages

Admin pages (`/admin/*`) MUST NOT be modified visually. Exceptions already implemented:

- FR-038: Category dropdown in `ProductFormModal` (complete)
- FR-039: Dark mode `select option` styling in `globals.css` (complete)

Any shared component changes (e.g., `Card.tsx`, `Badge.tsx`) must not visually break admin pages.

## 4. Accessibility Contract

- All decorative SVGs: `aria-hidden="true"`
- All text on `var(--background)`: minimum 4.5:1 contrast ratio (both modes)
- All text on accent backgrounds: minimum 3:1 contrast ratio for large text
- Touch targets: minimum 44×44px on mobile
- Focus indicators: visible warm-toned ring on all interactive elements
- Decorative elements: hidden on viewports < 640px via `hidden sm:block`
- Animations: respect `prefers-reduced-motion: reduce`
- `--text-muted` on `--background`: ≥4.5:1 in BOTH light and dark mode

## 5. Responsive Contract

| Viewport | Width      | Product Grid | Nav       | Decoratives | Touch Targets |
| -------- | ---------- | ------------ | --------- | ----------- | ------------- |
| Mobile   | < 640px    | 1 column     | Hamburger | Hidden      | ≥ 44×44px     |
| Tablet   | 640–1024px | 2 columns    | Full nav  | Reduced set | ≥ 44×44px     |
| Desktop  | > 1024px   | 3–4 columns  | Full nav  | Full set    | N/A           |
