# Data Model: Cozy Shop UI Redesign

**Feature**: 001-cozy-shop-ui
**Date**: 2026-03-15 (updated)

> No database or backend changes are required for this feature (FR-035).
> This document defines the **design token model**, **component entity model**, and **shared constants** that drive the UI redesign.

## 1. Design Token Entities

### 1.1 Color Palette Tokens (Authoritative Values)

These are the canonical token values. Components MUST reference these via `var(--token-name)` — never hardcoded hex.

| Token Name     | CSS Variable       | Light Mode | Dark Mode | Usage                        |
| -------------- | ------------------ | ---------- | --------- | ---------------------------- |
| background     | `--background`     | `#fef7f2`  | `#1a1412` | Page background              |
| foreground     | `--foreground`     | `#4a3728`  | `#ededed` | Primary text                 |
| surface        | `--surface`        | `#ffffff`  | `#241c16` | Card/panel backgrounds       |
| accent-warm    | `--accent-warm`    | `#e8a87c`  | `#d4945c` | CTA gradients, focus rings   |
| accent-rose    | `--accent-rose`    | `#d4856b`  | `#c47a60` | CTA gradient end, hover      |
| accent-peach   | `--accent-peach`   | `#f8c8a8`  | `#8a5e42` | Flower petals, soft accents  |
| accent-cream   | `--accent-cream`   | `#fff5eb`  | `#2a1e16` | Card backgrounds, highlights |
| accent-blush   | `--accent-blush`   | `#fde8d8`  | `#3a2a20` | Gradient mid-tone, badges    |
| accent-sage    | `--accent-sage`    | `#b8c9a3`  | `#7a9068` | Leaf accents, eco badges     |
| accent-pink    | `--accent-pink`    | `#E8A0BF`  | `#b87090` | Heart/wishlist, soft accents |
| border-warm    | `--border-warm`    | `#f0d5c0`  | `#4a3828` | Card/section borders         |
| text-secondary | `--text-secondary` | `#7a6355`  | `#d4c0b0` | Subtitles, descriptions      |
| text-muted     | `--text-muted`     | `#b89a85`  | `#a89080` | Category labels, captions    |

**Dark mode `--text-muted` note**: Value is `#a89080` (not `#7a6050`) to ensure ≥4.5:1 contrast on `--background` (`#1a1412`) per FR-031.

### 1.2 Typography Tokens

| Token            | Value                              | Usage                                      |
| ---------------- | ---------------------------------- | ------------------------------------------ |
| `--font-display` | `'Playfair Display', serif`        | Hero heading, brand name, section headings |
| `--font-body`    | `'Nunito', sans-serif`             | Body text, buttons, navigation, captions   |
| **Sizes**        |                                    |                                            |
| Hero heading     | `text-4xl sm:text-5xl lg:text-6xl` | Homepage hero "Handmade With Love"         |
| Section heading  | `text-2xl sm:text-3xl`             | Page/section titles                        |
| Card title       | `text-lg`                          | Product card names                         |
| Body             | `text-base`                        | Paragraphs, descriptions                   |
| Caption          | `text-sm`                          | Labels, categories, badges                 |
| Small            | `text-xs`                          | Fine print, metadata                       |

### 1.3 Spacing & Shape Tokens

| Token                  | Value                             | Usage                      |
| ---------------------- | --------------------------------- | -------------------------- |
| Border radius (card)   | `rounded-2xl` / `rounded-3xl`     | Product cards, hero panel  |
| Border radius (button) | `rounded-full`                    | CTA buttons, badges, pills |
| Border radius (input)  | `rounded-xl`                      | Form inputs, search        |
| Shadow (warm)          | `shadow-warm` (custom utility)    | Cards, elevated elements   |
| Shadow (warm-lg)       | `shadow-warm-lg` (custom utility) | Hero panel, modal          |

### 1.4 Custom Utilities (Implemented in globals.css)

| Utility             | Definition                                                                |
| ------------------- | ------------------------------------------------------------------------- |
| `bg-warm-gradient`  | `linear-gradient(135deg, #fef7f2 0%, #fde8d8 50%, #fef0e6 100%)`          |
| `text-warm-heading` | Gradient text: `#d4856b → #e8a87c → #c97b5e` with background-clip         |
| `border-warm`       | `border-color: #f0d5c0`                                                   |
| `shadow-warm`       | Warm-toned box-shadow with coral/peach tints                              |
| `shadow-warm-lg`    | Larger warm-toned box-shadow                                              |
| `font-display`      | `font-family: var(--font-display)`                                        |
| `focus-warm`        | Focus ring using `var(--accent-warm)` with offset                         |
| `animate-*`         | `fade-in-up`, `fade-in`, `slide-in-left/right`, `float-gentle/slow`, etc. |

## 2. Decorative Asset Entities

| Asset Type        | Implementation       | Source                   | Breakpoint Visibility       | Status       |
| ----------------- | -------------------- | ------------------------ | --------------------------- | ------------ |
| ScatteredFlowers  | Inline SVG component | `DecorativeElements.tsx` | Hidden < 640px              | Exists       |
| VineDivider       | Inline SVG component | `DecorativeElements.tsx` | Always visible (scales)     | Exists       |
| FlowerBullet      | Inline SVG component | `DecorativeElements.tsx` | Always visible              | Exists       |
| FlowerAccent      | Inline SVG component | `DecorativeElements.tsx` | Hidden < 640px              | Exists       |
| LeafAccent        | Inline SVG component | `DecorativeElements.tsx` | Hidden < 640px              | Exists       |
| SparkleAccent     | Inline SVG component | `DecorativeElements.tsx` | Hidden < 640px              | Exists       |
| FloralCartIcon    | Inline SVG component | `DecorativeElements.tsx` | Always visible              | ✅ New       |
| ButterflyAccent   | Inline SVG component | `DecorativeElements.tsx` | Hidden < 640px              | ✅ New       |
| MushroomAccent    | Inline SVG component | `DecorativeElements.tsx` | Hidden < 640px              | ✅ New       |
| FloralBorder      | Inline SVG component | `DecorativeElements.tsx` | Simplified < 640px          | ✅ New       |
| Hero illustration | CSS background-image | `public/warm-bg.jpeg`    | Always visible (responsive) | Asset exists |

## 3. Shared Constants

### 3.1 Product Categories (`lib/constants/categories.ts`)

```typescript
export const PRODUCT_CATEGORIES = [
  'Handbag',
  'Flowers',
  'Flower Pots',
  'Keychains',
  'Hair Accessories',
] as const

export const CATEGORY_FILTERS = ['All', ...PRODUCT_CATEGORIES] as const

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]
```

**Usage**:

- Admin `ProductFormModal`: `<select>` dropdown options (FR-038) ✅
- Storefront `ProductGrid`: Category filter tabs (FR-016, T030) — pending

## 4. Component Entity Map

### 4.1 Modified Components

| Component           | File                                           | Changes                                                                | Dark Mode        |
| ------------------- | ---------------------------------------------- | ---------------------------------------------------------------------- | ---------------- |
| Header              | `components/layout/Header.tsx`                 | Brand → "The Kiyon Store" + flower icon; warm nav; warm mobile menu    | Must use tokens  |
| Footer              | `components/layout/Footer.tsx`                 | Warm cottagecore palette; floral decorative elements                   | Must use tokens  |
| CartIcon            | `components/layout/CartIcon.tsx`               | Floral cart SVG design; warm badge color                               | Must use tokens  |
| Hero                | `components/sections/Hero.tsx`                 | Background image `warm-bg.jpeg`; text overlay with warm backdrop       | Must use tokens  |
| ProductGrid         | `components/sections/ProductGrid.tsx`          | Warm card styling; `CATEGORY_FILTERS` tabs; heart/wishlist icon        | Must use tokens  |
| QuickAddButton      | `components/sections/QuickAddButton.tsx`       | Coral/warm button gradient                                             | Must use tokens  |
| StockBadge          | `components/sections/StockBadge.tsx`           | Warm-toned badge colors                                                | Must use tokens  |
| CartItemRow         | `components/cart/CartItemRow.tsx`              | Warm styling; decorative elements                                      | Must use tokens  |
| DecorativeElements  | `components/ui/DecorativeElements.tsx`         | ✅ FloralCartIcon, ButterflyAccent, MushroomAccent, FloralBorder added | N/A (decorative) |
| Card                | `components/ui/Card.tsx`                       | Warm border, shadow, `var(--surface)` background                       | Must use tokens  |
| GradientButton      | `components/ui/GradientButton.tsx`             | Coral/warm gradient                                                    | Must use tokens  |
| GradientHeading     | `components/ui/GradientHeading.tsx`            | Warm heading gradient with `--font-display`                            | Must use tokens  |
| EmptyState          | `components/ui/EmptyState.tsx`                 | Warm empty state with decorative illustration                          | Must use tokens  |
| Badge               | `components/ui/Badge.tsx`                      | Warm badge color variants (sage, peach, blush)                         | Must use tokens  |
| CtaButton           | `components/ui/CtaButton.tsx`                  | Coral/salmon CTA style, `rounded-full`                                 | Must use tokens  |
| HeaderSkeleton      | `components/skeletons/HeaderSkeleton.tsx`      | Warm-toned shimmer (peach/cream)                                       | Must use tokens  |
| HeroSkeleton        | `components/skeletons/HeroSkeleton.tsx`        | Warm-toned shimmer                                                     | Must use tokens  |
| ProductCardSkeleton | `components/skeletons/ProductCardSkeleton.tsx` | Warm-toned shimmer                                                     | Must use tokens  |
| ProductStockBadge   | `components/product/ProductStockBadge.tsx`     | Warm badge colors                                                      | Must use tokens  |
| VariationButton     | `components/product/VariationButton.tsx`       | Warm selection styling                                                 | Must use tokens  |

### 4.2 Modified Pages

| Page                   | File                            | Changes                                                            |
| ---------------------- | ------------------------------- | ------------------------------------------------------------------ |
| Homepage               | `app/page.tsx`                  | Metadata update; decorative element placement                      |
| About                  | `app/about/page.tsx`            | Brand story; illustrated background; three-column crafting process |
| Cart                   | `app/cart/page.tsx`             | Warm styling; decorative leaf/flower elements; coral checkout CTA  |
| Product Detail         | `app/products/[id]/page.tsx`    | Warm typography; rounded image framing; decorative elements        |
| Global Error           | `app/error.tsx`                 | Warm error boundary styling                                        |
| Global Loading         | `app/loading.tsx`               | Warm skeleton colors                                               |
| Products Error         | `app/products/error.tsx`        | Warm error styling                                                 |
| Products Loading       | `app/products/loading.tsx`      | Warm skeleton                                                      |
| Product Detail Loading | `app/products/[id]/loading.tsx` | Warm skeleton                                                      |

### 4.3 Modified Config (Complete)

| File              | Changes                                                                     | Status |
| ----------------- | --------------------------------------------------------------------------- | ------ |
| `app/globals.css` | Design tokens, dark mode, utilities, animations, focus ring, reduced motion | ✅     |
| `app/layout.tsx`  | Playfair Display font, metadata title/description                           | ✅     |

### 4.4 Out of Scope

| Area            | Files                                   | Reason                                                         |
| --------------- | --------------------------------------- | -------------------------------------------------------------- |
| Admin panel     | `app/admin/*`, `components/admin/*`     | FR-034 (except FR-038/FR-039, done)                            |
| API routes      | `app/api/*`                             | FR-035                                                         |
| Backend lib     | `lib/*` (schema, db, auth, redis, etc.) | FR-035 (except `lib/constants/`, done)                         |
| Auth pages      | `app/auth/*`, `components/auth/*`       | Dark mode token compliance only (FR-031) — no visual restyling |
| Secondary pages | Blog, Careers, Help, Press, etc.        | FR-037 — inherit via global tokens only                        |

## 5. State Transitions

No new application state is introduced. The redesign is purely visual — all existing Redux state (cart, orders, admin), auth state, and currency state remain unchanged.

The only "state" affected is CSS custom property values, which transition between light and dark mode based on `prefers-color-scheme`.

## 6. Dark Mode Compliance Matrix

Every modified component MUST be verified against this checklist during implementation:

- [ ] No hardcoded `bg-white`, `bg-gray-*`, `text-gray-*`, `text-black` classes
- [ ] No hardcoded hex colors (`#fef7f2`, `#4a3728`, etc.) in className strings
- [ ] All backgrounds use `var(--background)`, `var(--surface)`, `var(--accent-cream)`, or `dark:` variants
- [ ] All text uses `var(--foreground)`, `var(--text-secondary)`, `var(--text-muted)`, or `dark:` variants
- [ ] All borders use `var(--border-warm)` or `dark:` variants
- [ ] Native `<select>`/`<option>` elements inherit from the global dark mode rule in `globals.css`
