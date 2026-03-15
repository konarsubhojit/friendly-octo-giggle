# Feature Specification: Cozy Shop UI Redesign

**Feature Branch**: `001-cozy-shop-ui`  
**Created**: 2026-03-15  
**Status**: Draft  
**Input**: Redesign the e-commerce website UI to match a cozy, handmade shop aesthetic. Transform the current site ("The Kiyon Store") into a warm, cottage-core themed shop selling handmade crochet items.
**Visual Reference**: `public/prototype2.jpeg` is the authoritative design prototype. All pages should match this prototype's layout, spacing, and visual treatment as closely as possible.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - First Impression & Brand Identity (Priority: P1)

A new visitor lands on the homepage and immediately perceives a warm, handcrafted, cottagecore shop rather than a generic e-commerce site. The color palette, typography, hero imagery, and decorative elements all convey the "handmade with love" brand identity. The visitor feels invited to explore.

**Why this priority**: The homepage is the first touchpoint for every visitor. If the brand identity doesn't land here, the rest of the redesign has no foundation. This story covers the global theme (colors, fonts, layout shell) and the hero section — the highest impact, highest visibility elements.

**Independent Test**: Can be fully tested by loading the homepage and verifying the brand identity visually. Delivers immediate value as the storefront "first impression."

**Acceptance Scenarios**:

1. **Given** a visitor opens the homepage, **When** the page loads, **Then** the background uses warm cream/parchment tones (not white or gray), heading text uses a decorative serif font, body text uses a clean sans-serif in warm brown (not black), and the overall palette features soft peach, cream, sage green, and pink accents.
2. **Given** the homepage is loaded, **When** the visitor views the hero section, **Then** they see a full-width background illustration of a crafting scene (warm-bg.jpeg) with a warm overlay, the tagline "Handmade With Love", a subtitle listing product categories (Crochet · Flowers · Bags · Accessories), and a coral/salmon call-to-action button labeled "Explore Shop →".
3. **Given** a visitor on any page, **When** they view the header, **Then** they see the "The Kiyon Store" brand name with a small crochet flower icon, navigation items (Home, Products, About, Contact), a floral-themed cart icon, and search functionality — all styled with soft rounded edges.
4. **Given** a visitor on any page, **When** they scroll to the footer, **Then** they see a footer that maintains the warm cottagecore aesthetic with floral decorative elements, matching the overall theme.

---

### User Story 2 - Browsing & Discovering Products (Priority: P2)

A shopper browses the product listing page and can filter products by category using visually appealing filter tabs. Product cards feel handcrafted with warm styling, display prices in ₹ (INR), and include a heart/wishlist icon. The overall browsing experience feels like flipping through a crafting catalog.

**Why this priority**: Product discovery is the core shopping experience. After the homepage impression lands, visitors must be able to browse products in a way that maintains the cozy aesthetic. This is the primary revenue-generating flow.

**Independent Test**: Can be tested by navigating to the shop/products page, verifying card styling, filtering by category, and confirming prices display correctly in INR.

**Acceptance Scenarios**:

1. **Given** a visitor navigates to the products page, **When** the page loads, **Then** product cards display with soft rounded corners, subtle warm shadows, product images with warm borders, product names, and prices in ₹ (INR).
2. **Given** the products page is loaded, **When** the visitor views category filters, **Then** styled filter tabs appear (All, Handbag, Flowers, Flower Pots, Keychains, Hair Accessories) that match the warm aesthetic and respond to selection with a cozy visual indicator.
3. **Given** a product card is displayed, **When** the visitor hovers or focuses on it, **Then** a heart/wishlist icon is visible and the card provides a warm hover feedback (subtle elevation or glow, not a cold blue outline).
4. **Given** a visitor clicks on a product card, **When** the product detail page loads, **Then** the page maintains the cottagecore styling with warm typography, decorative elements, and the same soft color palette.

---

### User Story 3 - Shopping Cart Experience (Priority: P3)

A shopper adds items to their cart and views a warm, decorated cart page. The cart displays product thumbnails, quantity controls, a running total in ₹, and a coral "Checkout →" button. The cart icon in the header uses the floral cart design and updates with item count.

**Why this priority**: The cart is the critical conversion step between browsing and purchasing. A cart that maintains the cozy aesthetic (rather than breaking into a generic checkout) reinforces brand trust and reduces abandonment.

**Independent Test**: Can be tested by adding items to the cart, navigating to the cart page, adjusting quantities, and verifying the styled cart with running totals.

**Acceptance Scenarios**:

1. **Given** items are in the cart, **When** the visitor opens the cart page, **Then** the cart uses the warm color palette with product thumbnails, quantity +/- controls, individual item prices, and a running subtotal — all in ₹ (INR).
2. **Given** the cart page is displayed, **When** the visitor views the checkout call-to-action, **Then** a coral/salmon "Checkout →" button is prominently displayed, matching the hero CTA style.
3. **Given** any page is loaded, **When** the visitor views the header cart icon, **Then** the cart icon uses the floral cart design (not a generic shopping cart icon) and shows the current item count.
4. **Given** the cart page is displayed, **When** the visitor views the page, **Then** decorative leaf/flower elements are present, maintaining the handcrafted feel throughout the checkout funnel.

---

### User Story 4 - About Us & Brand Story (Priority: P4)

A visitor reads the About Us section and feels emotionally connected to the brand. The section tells the story of the shop with illustrated backgrounds, floral bullet-point icons, and a warm, personal tone. The crafting process section explains the artisanal approach.

**Why this priority**: Brand storytelling differentiates a handmade shop from a commodity marketplace. This section builds trust and emotional connection, which drives repeat purchases and word-of-mouth — but only after the core shopping experience works.

**Independent Test**: Can be tested by navigating to the About page and verifying illustrated backgrounds, floral icons, storytelling tone, and the crafting process three-column layout.

**Acceptance Scenarios**:

1. **Given** a visitor navigates to the About page, **When** the page loads, **Then** an illustrated background with a crafting scene is displayed, and brand values are listed with floral icons (🌸): "Handmade with love", "Small batch", "Eco-friendly", "Made for you ❤️".
2. **Given** the About page is loaded, **When** the visitor scrolls to the crafting process section, **Then** a three-column layout displays "Our Story", "Made with Love", and "From Our Hands to Yours" with illustrated imagery and warm descriptive text.
3. **Given** the About page content, **When** a visitor reads the text, **Then** the tone is personal, storytelling, and warm — using first-person language ("we", "our") rather than corporate third-person.

---

### User Story 5 - Decorative Elements & Visual Polish (Priority: P5)

Across all pages, small decorative elements — flowers, leaves, butterflies, mushrooms, and floral vine borders — add whimsy and reinforce the handcrafted aesthetic. These elements are purely decorative and do not interfere with content readability or accessibility.

**Why this priority**: Decorative polish is what transforms "a warm-colored website" into "a cottagecore experience." However, the core layout, components, and flows must work first before adding embellishments.

**Independent Test**: Can be tested by visually inspecting each page for decorative elements and verifying they don't obstruct content, break layouts, or fail accessibility checks.

**Acceptance Scenarios**:

1. **Given** any page is loaded, **When** the visitor views the page, **Then** decorative flower, leaf, or vine elements are visible in margins, section dividers, or corners — adding whimsy without obstructing content.
2. **Given** decorative elements are present, **When** the page is inspected for accessibility, **Then** all decorative elements are marked as presentational (hidden from screen readers) and do not interfere with keyboard navigation.
3. **Given** the page is viewed on a small mobile screen, **When** the layout adapts, **Then** decorative elements gracefully scale down or hide to preserve content readability on constrained viewports.

---

### User Story 6 - Responsive & Accessible Experience (Priority: P6)

All redesigned pages work fluidly across mobile, tablet, and desktop viewports. Accessibility standards are maintained — proper contrast ratios, screen reader support, keyboard navigation, and ARIA attributes remain intact through the redesign.

**Why this priority**: Responsive design and accessibility are non-negotiable but are listed after visual stories because they apply as cross-cutting constraints to every story above rather than creating standalone value.

**Independent Test**: Can be tested by resizing the browser across breakpoints and running accessibility audits on every redesigned page.

**Acceptance Scenarios**:

1. **Given** any redesigned page, **When** viewed on a mobile device (< 640px), **Then** the layout stacks vertically, navigation collapses into a mobile menu, product cards display in a single column, and all touch targets meet minimum 44×44px sizing.
2. **Given** any redesigned page, **When** viewed on tablet (640px–1024px), **Then** the layout adapts with a two-column product grid and appropriately scaled hero section.
3. **Given** the new warm color palette, **When** text is displayed against background colors, **Then** all text/background combinations meet WCAG 2.1 AA contrast ratio (4.5:1 for normal text, 3:1 for large text).
4. **Given** any interactive element, **When** a keyboard-only user navigates the page, **Then** focus indicators are visible and styled warmly (not the default blue outline — a warm-toned focus ring instead).

---

### Edge Cases

- **Empty product grid**: When no products match a filter category, a warm "No items found" message with a decorative illustration displays (not a blank page or cold error state).
- **Very long product names**: Product cards gracefully truncate long names with ellipsis without breaking the card layout or warm styling.
- **Slow image loading**: Product images and hero illustrations show warm-toned placeholder shimmer/skeleton states (not gray rectangles).
- **Dark mode**: Dark mode MUST be fully functional via `prefers-color-scheme: dark`. All customer-facing components MUST use CSS variable tokens or `dark:` Tailwind variants — no hardcoded light-only colors. Native `<select>`/`<option>` elements MUST use `--surface` and `--foreground` tokens. `--text-muted` MUST meet 4.5:1 contrast on `--background`.
- **High-contrast / reduced-motion preferences**: Decorative animations respect `prefers-reduced-motion`, and content remains readable under high-contrast system settings.
- **Cart with many items**: The cart page remains usable and styled correctly with 20+ items, with the warm styling scaling to long lists.
- **Admin pages**: Admin panel (dashboard, product management, order management, user management) retains its existing functional styling and is NOT part of this redesign scope.

## Requirements _(mandatory)_

### Functional Requirements

#### Global Theme & Design System

- **FR-001**: The site MUST use a warm color palette consisting of soft peach (`--accent-peach`: #f8c8a8), cream (`--accent-cream`: #fff5eb), muted sage green (`--accent-sage`: #b8c9a3), soft pink (`--accent-pink`: #E8A0BF), and warm brown (`--foreground`: #4a3728) accents throughout all customer-facing pages. Authoritative token values are defined in data-model.md.
- **FR-002**: The site MUST use a decorative serif font (Playfair Display) for headings and brand text, paired with a clean sans-serif (Nunito) for body text. Primary text color MUST be warm brown (not black).
- **FR-003**: The site MUST include a parchment/paper texture feel for page backgrounds, achieved via the warm cream background token (`--background`: #fef7f2) and subtle warm gradient overlays. No literal texture image is required.
- **FR-004**: The site MUST define both light and dark mode variants of the cozy color palette as CSS custom properties. Dark mode MUST be fully functional via `prefers-color-scheme: dark` — all customer-facing pages MUST be readable and visually coherent in dark mode. A `--surface` token MUST be defined for card/panel backgrounds in both modes.

#### Header & Navigation

- **FR-005**: The header MUST display the brand name "The Kiyon Store" alongside a small crochet flower icon.
- **FR-006**: Navigation MUST include: Home, Products, About, Contact links, styled with soft rounded edges.
- **FR-007**: The cart icon in the header MUST use a floral cart design (provided static asset) with flower decorations, displaying a badge with the current item count.
- **FR-008**: The header MUST restyle existing search functionality to be consistent with the warm aesthetic. No new search features required.
- **FR-009**: On mobile, the navigation MUST collapse into a hamburger menu that maintains the cozy styling when expanded.

#### Hero Section

- **FR-010**: The hero section MUST use the illustration of a girl crafting with a white cat (`public/warm-bg.jpeg`) as a **background image** covering the full hero area (as shown in `prototype2.jpeg` top-left quadrant), not as a standalone displayed image. The hero text (heading, subtitle, CTA) MUST be positioned on the left side overlaying the illustration. A subtle warm semi-transparent backdrop (approx. 40–60% opacity warm cream) behind the text area MUST ensure legibility without obscuring the illustration. The illustration should remain clearly visible across the full hero width.
- **FR-011**: The hero MUST feature the text "Handmade With Love" as the primary heading in a decorative font.
- **FR-012**: The hero MUST include a subtitle "CROCHET · FLOWERS · BAGS · ACCESSORIES" below the heading.
- **FR-013**: The hero MUST include a coral/salmon call-to-action button labeled "Explore Shop →" that navigates to the products page.

#### Product Listing & Cards

- **FR-014**: Product cards MUST have soft rounded corners with a subtle warm shadow.
- **FR-015**: Product cards MUST display: product image (with warm border), product name, price in ₹ (INR), and a heart/wishlist icon.
- **FR-016**: The product listing page MUST include category filter tabs: All, Handbag, Flowers, Flower Pots, Keychains, Hair Accessories. These labels MUST match the `PRODUCT_CATEGORIES` constant in `lib/constants/categories.ts`.
- **FR-017**: The product listing page MUST display a warm-styled page heading consistent with the brand.

#### Product Detail Page

- **FR-018**: The product detail page MUST maintain the cottagecore styling with warm typography, rounded image framing, and decorative elements.
- **FR-019**: The product detail page MUST display price in ₹ (INR) with styled add-to-cart controls matching the warm palette.

#### Cart Page

- **FR-020**: The cart page MUST display items with product thumbnails, names, quantity +/- controls, individual prices, and a running subtotal — all in ₹ (INR).
- **FR-021**: The cart page MUST feature a coral/salmon "Checkout →" button matching the hero CTA style.
- **FR-022**: The cart page MUST include decorative leaf/flower elements in the margins or borders.

#### About Page

- **FR-023**: The About page MUST feature an illustrated background with a crafting scene.
- **FR-024**: The About page MUST list brand values with floral icons (🌸): "Handmade with love", "Small batch", "Eco-friendly", "Made for you ❤️".
- **FR-025**: The About page MUST include a crafting process section in a three-column layout: "Our Story", "Made with Love", "From Our Hands to Yours" with illustrated imagery.

#### Footer

- **FR-026**: The footer MUST be restyled to match the warm cottagecore aesthetic with floral decorative elements and warm color tones.

#### Decorative Elements

- **FR-027**: Pages MUST include scattered decorative icons (flowers, leaves, butterflies, mushrooms) and floral vine borders throughout.
- **FR-028**: All decorative elements MUST be marked as presentational and hidden from assistive technologies.
- **FR-029**: Decorative elements MUST scale down or hide on viewports below 640px to preserve readability.

#### Responsiveness & Accessibility

- **FR-030**: All redesigned pages MUST be mobile-first responsive, functioning correctly at mobile (< 640px), tablet (640px–1024px), and desktop (> 1024px) breakpoints.
- **FR-031**: All text/background color combinations MUST meet WCAG 2.1 AA contrast ratios (4.5:1 normal text, 3:1 large text) in BOTH light and dark modes. No hardcoded light-only hex colors (e.g., `bg-white`, `text-gray-700`, `#fef7f2`, `#4a3728`) may appear in customer-facing components — all colors MUST use CSS custom property tokens or include explicit `dark:` Tailwind variants.
- **FR-032**: Keyboard focus indicators MUST be visible and styled with warm tones (not default browser blue outlines).
- **FR-033**: All existing interactive functionality (authentication, cart operations, checkout, admin panel) MUST continue to work identically after the redesign.

#### Admin Improvements (In-Scope)

- **FR-038**: The product category field in the admin ProductFormModal MUST be a `<select>` dropdown populated from a shared `PRODUCT_CATEGORIES` constant (defined in `lib/constants/categories.ts`), not a free-text input. The same constant MUST be used by the storefront category filter tabs.
- **FR-039**: Native form elements (`<select>`, `<option>`) MUST render with correct foreground/background colors in dark mode via CSS rules targeting `select option` elements.

#### Scope Boundaries

- **FR-034**: The admin panel pages (dashboard, product management, order management, user management) MUST NOT be visually restyled in this redesign, except for FR-038 (category dropdown) and FR-039 (dark mode form elements). Auth pages (`app/auth/*`, `components/auth/*`) ARE in scope for dark mode token compliance per FR-031, since they are customer-facing.
- **FR-035**: No backend changes (API routes, database schema, authentication logic, server actions) MUST be made as part of this feature.
- **FR-036**: Loading skeletons and error boundary pages MUST be updated to match the warm aesthetic.
- **FR-037**: Secondary customer-facing pages (Blog, Careers, Help, Press, Returns, Shipping, Contact, Orders, Account) inherit the warm theme via global CSS tokens and the restyled Header/Footer. No page-specific restyling is required, but a visual verification pass MUST confirm no legacy hardcoded colors clash with the new palette.

### Key Entities

- **Color Palette Token**: A named design token (e.g., "peach", "cream", "sage", "blush", "coral") mapping to a specific hex value, used consistently across all components. Tokens have light-mode and dark-mode variants.
- **Typography Scale**: A set of font pairings — decorative script for headings and brand text, clean sans-serif for body — with defined sizes for each usage (hero heading, section heading, card title, body text, caption).
- **Decorative Asset**: A static image or inline graphic (flower, leaf, butterfly, mushroom, vine border) used purely for visual embellishment. Has attributes: type, placement zone, visibility breakpoint.
- **Product Card**: A visual component representing a product. Displays: image, name, price, wishlist indicator. Styled with the cozy theme tokens.

## Assumptions

- The provided static background images (crafting girl with cat, floral cart icon, cottage-scene imagery) are available in a suitable format (SVG, PNG, or WebP) and will be placed in the `public/` directory.
- "The Kiyon Store" is the display brand name for the redesigned storefront. The underlying product data, categories, and pricing remain unchanged.
- The category filter tabs (Handbag, Flowers, Flower Pots, Keychains, Hair Accessories) map to existing product categories in the database via the shared `PRODUCT_CATEGORIES` constant in `lib/constants/categories.ts`.
- Decorative script/handwritten fonts will be sourced from Google Fonts or similar free font libraries to avoid licensing issues.
- The heart/wishlist icon on product cards is a visual element for this phase. Full wishlist functionality (persisting favorites, wishlist page) is outside this redesign scope and would be a separate feature.
- Existing Tailwind CSS utility classes and custom CSS variables in `globals.css` will be extended/modified to implement the new theme — no additional CSS framework will be introduced.
- Performance should not degrade: decorative images will be optimized, and no heavy animation libraries will be introduced.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A first-time visitor can identify the site as a "handmade/artisanal shop" (not a generic e-commerce store) within 5 seconds of the homepage loading, as validated by a visual inspection against the prototype designs.
- **SC-002**: All redesigned pages pass WCAG 2.1 AA accessibility audit with zero critical violations.
- **SC-003**: The product browsing flow (homepage → product listing → product detail → add to cart → view cart) completes in under 4 clicks, with every page maintaining the cozy theme consistently.
- **SC-004**: All redesigned pages render correctly and are fully functional at three viewport sizes: mobile (375px), tablet (768px), and desktop (1440px).
- **SC-005**: Existing automated tests (426+ unit tests) continue to pass after the redesign with no regressions.
- **SC-006**: Page load performance (Largest Contentful Paint) remains under 2.5 seconds on a standard broadband connection after adding decorative assets.
- **SC-007**: All existing functionality — user authentication, cart operations, order placement, admin management — works identically before and after the redesign, verified by the existing end-to-end test suite.
- **SC-008**: The redesigned pages visually match the cottagecore prototype designs with at least 90% fidelity on color palette, typography, and layout structure, as verified by side-by-side comparison.

## Clarifications

### Session 2026-03-15

- Q: Should the spec use "Little Stitch Co." or "The Kiyon Store" as the brand name? → A: Use "The Kiyon Store" — the actual brand name. All spec references updated from "Little Stitch Co." to "The Kiyon Store".
- Q: Should dark mode be fully implemented with toggle, or just CSS tokens for future use? → A: Define dark mode CSS tokens only (no toggle). FR-004 updated to reflect CSS-only scope.
- Q: Should nav use "Shop" (spec) or match existing app route "/products"? → A: Use existing app routes. Navigation labels: Home, Products, About, Contact. FR-006 updated.
- Q: Does "search functionality" (FR-008) mean build new search or restyle existing? → A: Restyle existing search to match warm aesthetic. No new search features.

### Session 2026-03-15 (Pass 2)

- Q: Secondary customer pages (Blog, Careers, Help, Press, Returns, Shipping, Contact, Orders, Account) — active restyling or global token inheritance? → A: Token inheritance + visual verification. These pages inherit the warm theme via globals.css tokens and the restyled Header/Footer; a visual verification pass confirms no legacy hardcoded colors clash.
- Q: Hero illustration asset — which file is the "illustration of a girl crafting with a white cat" referenced in FR-010? → A: `public/warm-bg.jpeg` is the hero asset (per data-model.md). No new asset needs to be sourced.
- Q: Should `warm-bg.jpeg` be used as a background image covering the hero section, or displayed as a standalone image? → A: Use as a background image for the hero section, not as a separate display image. The illustration should fill the hero area behind the text content. Text overlays on the left with a subtle warm backdrop for legibility (per `prototype2.jpeg`).
- Q: What is the authoritative visual design target for the redesign? → A: `public/prototype2.jpeg` — a 4-quadrant prototype showing hero (top-left), shop/products (top-right), about us (bottom-left), and cart (bottom-right). All pages should match this prototype's layout and visual treatment.

### Session 2026-03-15 (Pass 3)

- Q: Dark mode text is unreadable (e.g., CurrencySelector dropdown, header menus) — should dark mode be fully functional or token-only prep? → A: Dark mode MUST be fully functional. All customer-facing components must pass WCAG AA contrast in both light and dark modes. No hardcoded light-only colors. FR-004 and FR-031 updated accordingly.
- Q: Should product category in admin be a free-text input or a dropdown? → A: Dropdown (`<select>`) populated from a shared constant `PRODUCT_CATEGORIES` in `lib/constants/categories.ts`. Same constant used for storefront category filter tabs. FR-038 added.
- Q: Specific dark mode issues identified: CurrencySelector options invisible, Header dropdown menu uses hardcoded `bg-[#fef7f2]`, mobile nav links use hardcoded `text-[#7a6355]`, LoginModal uses `bg-white` without dark variant, Footer/Hero/ProductGrid use hardcoded hex colors. → A: All must be fixed to use CSS variable tokens. FR-039 added for native `<select>` elements.

### Session 2026-03-15 (Pass 4 — Clarification)

- Q: FR-016 category filter tabs ("Flowers, Bags, Keychains, Hair") vs implemented PRODUCT_CATEGORIES ("Handbag, Flowers, Flower Pots, Keychains, Hair Accessories") — which labels are authoritative? → A: Use implementation labels (Handbag, Flowers, Flower Pots, Keychains, Hair Accessories). They are more descriptive and already match the database. FR-016 and User Story 2 acceptance scenario 2 updated.
- Q: Auth pages (sign-in, error, OAuthButtons, LoginModal) — in-scope for dark mode token compliance per FR-031, or excluded per data-model.md 3.4? → A: In-scope. Auth pages are customer-facing and MUST comply with FR-031 (no hardcoded light-only colors). FR-034 updated to clarify. Data-model.md 3.4 "Auth pages out of scope" refers to visual restyling only, not dark mode compliance.
- Q: User Story 1 says "decorative script font" but FR-002 says "decorative serif font (Playfair Display)" — which is correct? → A: "Decorative serif font" is correct (Playfair Display is a serif, not a script). User Story 1 acceptance scenario 1 corrected.
