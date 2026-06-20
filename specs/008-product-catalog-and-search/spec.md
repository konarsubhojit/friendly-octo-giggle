# Feature Specification: Product Catalog and Search

**Feature Branch**: `008-product-catalog-and-search`  
**Created**: 2026-06-09  
**Status**: Draft  
**Input**: User description: "Document the shipped customer-facing product catalog, product detail, and search/discovery behavior from code."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Browse the Product Catalog (Priority: P1)

A shopper can open the localized shop route, see bestselling products, browse catalog cards, and continue loading more products without leaving the page.

**Why this priority**: Browsing the catalog is the core discovery path and must work before filtering, search refinement, or product detail interactions matter.

**Independent Test**: Navigate to `/[locale]/shop`, verify the Bestsellers section and initial catalog render, scroll to the sentinel, and confirm additional products load through the products API while preserving the current filters.

**Acceptance Scenarios**:

1. **Given** a shopper opens the shop page, **When** server data loads, **Then** the page shows a Bestsellers section and an initial catalog batch of up to 24 products.
2. **Given** more products exist, **When** the shopper scrolls near the end of the grid, **Then** the client fetches `/api/products` with `limit`, `offset`, and active filters and appends non-duplicate products.
3. **Given** all matching products are loaded, **When** the shopper reaches the end, **Then** the page communicates that all products have been seen and stops requesting more pages.
4. **Given** a product card is displayed, **When** the shopper views it, **Then** it shows image, name, description, formatted price, stock badge, wishlist control, and sold count.

---

### User Story 2 - Refine Catalog Results (Priority: P1)

A shopper can narrow the product catalog using search text, category, sort, price range, stock, rating, and variant-count filters encoded in the URL.

**Why this priority**: Filtering and sorting turn a full catalog into a usable buying journey and are implemented directly in shop page state, API parameters, and search discovery logic.

**Independent Test**: Apply each filter on `/[locale]/shop`, confirm the URL query string changes, reload the page, and verify the same filtered results are rendered from the server and used by load-more requests.

**Acceptance Scenarios**:

1. **Given** a shopper enters a query and clicks Apply, **When** navigation completes, **Then** the URL uses `q=<term>` and the result cards highlight matching text.
2. **Given** a shopper selects a category other than `All`, **When** filters are applied, **Then** only products in that category are requested and displayed.
3. **Given** a shopper selects a sort option, **When** results render, **Then** ordering follows one of: relevance, price low-to-high, price high-to-low, newest, best-selling, or top-rated.
4. **Given** a shopper enters minimum and maximum prices in reverse order, **When** filters are applied, **Then** the client normalizes the range before writing URL parameters.
5. **Given** filters produce no products, **When** the empty state appears, **Then** the shopper can see spell-style suggestions and trending product links when available.

---

### User Story 3 - Search from Catalog and Header (Priority: P2)

A shopper can use inline catalog suggestions or the global search dialog to discover products by name, description, and category.

**Why this priority**: Search accelerates discovery for shoppers who know what they want and provides fallback behavior when the dedicated search service is unavailable.

**Independent Test**: Type into the shop search field and the global product search dialog, verify debounced API calls, suggestions/results, keyboard navigation, and localized navigation to selected products.

**Acceptance Scenarios**:

1. **Given** the shop search input is focused, **When** the shopper types a term, **Then** suggestions are fetched from `/api/search/suggest` and grouped as recent searches, products, categories, popular searches, and mobile category quick links.
2. **Given** the shopper submits a catalog search, **When** the result route loads, **Then** the term is persisted in recent searches scoped to the signed-in user ID or `guest`.
3. **Given** the shopper opens the global product search button or presses Cmd/Ctrl+K, **When** they type a query, **Then** up to 8 product results are fetched from `/api/search` and rendered in a dialog.
4. **Given** global search results are shown, **When** the shopper presses ArrowDown/ArrowUp and Enter or clicks a result, **Then** they navigate to the locale-prefixed product detail page.
5. **Given** Upstash Search is not configured or fails, **When** search executes, **Then** the system falls back to database `ilike` product matching.

---

### User Story 4 - View Product Details and Variants (Priority: P2)

A shopper can open a product detail page, review images and product information, select variants/options, and see the selected variant reflected in the URL.

**Why this priority**: Product detail is the conversion point between discovery and cart; variant correctness is required before add-to-cart can work.

**Independent Test**: Open `/[locale]/products/[id]` with and without `?v=<variantId>`, select different option values, refresh, and verify the chosen/default variant, price, stock, images, and URL behavior.

**Acceptance Scenarios**:

1. **Given** a valid product ID, **When** the product detail page renders, **Then** metadata, name, category, description, price, stock, sold count, images, share button, reviews, and recently viewed sections are available.
2. **Given** `?v=<variantId>` matches a product variant, **When** the page loads, **Then** that variant is selected; otherwise the first variant is selected.
3. **Given** a shopper selects another variant or option value, **When** selection changes, **Then** the page updates price/stock/images and replaces the URL query with the selected variant ID without scrolling.
4. **Given** a product has defined options, **When** variants are rendered, **Then** option values are grouped by option, unavailable values are shown as out of stock, and the selected variant summary shows label, price, low stock, and cart quantity.
5. **Given** a product has variants but no option definitions, **When** SKUs contain consistent delimited segments, **Then** synthetic option selectors are derived; otherwise a simple variant grid is shown.

---

### User Story 5 - Add Available Variants to Cart (Priority: P3)

A shopper can choose a quantity for the selected variant, add it to cart, and receive clear feedback when stock or authentication state affects the action.

**Why this priority**: Add-to-cart depends on detail and variant behavior, and the current implementation supports both authenticated and guest shoppers.

**Independent Test**: Select a variant with stock, add quantities as guest and signed-in user, verify pending cart or Redux cart behavior, quantity clamping, success/error alerts, and mobile sticky action state.

**Acceptance Scenarios**:

1. **Given** a selected variant has remaining stock, **When** the shopper changes quantity, **Then** selectable quantities are capped at the lesser of remaining stock and 10.
2. **Given** the shopper is not authenticated, **When** they add an available variant, **Then** the item is stored as a pending cart item and a success message is shown.
3. **Given** the shopper is authenticated, **When** they add an available variant, **Then** the Redux cart thunk submits product ID, variant ID, and quantity and refreshes stock-aware cart feedback.
4. **Given** the shopper tries to add without a selected variant, **When** add-to-cart runs, **Then** an error asks them to select a variant first.
5. **Given** no remaining stock is available, **When** the detail page renders, **Then** desktop shows an out-of-stock/all-stock-in-cart panel and mobile disables the sticky add button.

---

### Edge Cases

- Deleted products and deleted variants are excluded from public list/detail queries.
- Invalid sort and variant filter values fall back to `relevance` and `all` respectively.
- Product API page size is clamped to 1–100; search API result size is clamped to 1–50; suggestions are clamped to 1–10.
- Empty search suggestions return default popular terms; zero-result catalog searches log a business event and may show suggestions/trending products.
- Bestsellers include products with no sales at the end; ranking excludes cancelled orders and falls back to newest created products.
- Cached product list keys skip free-text search queries to avoid ineffective cache cardinality.
- Search result clicks are logged via `navigator.sendBeacon` when available and `fetch(..., keepalive)` otherwise.
- Recently viewed products are stored client-side, deduplicated by product ID, newest first, and capped at 12.
- Locale-aware links localize internal customer routes but leave API, asset, hash-only, and external URLs unchanged.
- Currency formatting uses the active CurrencyContext and live/fallback exchange rates; source prices are treated as INR values.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST render the customer shop page at the locale-prefixed public route with ISR revalidation of 60 seconds.
- **FR-002**: System MUST load an initial shop catalog batch of 24 products and support subsequent load-more batches of 20 products.
- **FR-003**: System MUST expose `/api/products` for paginated catalog loading with `q`, `category`, `sort`, `minPrice`, `maxPrice`, `inStock`, `minRating`, `variant`, `limit`, and `offset` parameters.
- **FR-004**: System MUST derive catalog card price from the lowest active variant price and stock from the sum of active variant stock.
- **FR-005**: System MUST display product sold counts aggregated from qualifying order items.
- **FR-006**: System MUST show Bestsellers as the top 5 products by sales volume on the shop page and expose `/api/products/bestsellers` with a configurable limit from 1 to 100.
- **FR-007**: System MUST support sort modes `relevance`, `price_asc`, `price_desc`, `newest`, `best_selling`, and `top_rated`.
- **FR-008**: System MUST support catalog filters for category, price range, in-stock-only, minimum rating, and single/multiple variant products.
- **FR-009**: System MUST provide search suggestions from `/api/search/suggest`, including product labels, matched categories, default popular searches, and recent local searches.
- **FR-010**: System MUST provide global product search from `/api/search` with a keyboard-accessible dialog and Cmd/Ctrl+K shortcut.
- **FR-011**: System MUST use Upstash Search for product ID relevance when configured and fall back to database search when unavailable.
- **FR-012**: System MUST cache product detail, product list, bestseller, category, sold-count, search, and suggestion responses according to existing cache helpers and route headers.
- **FR-013**: System MUST render product detail pages for valid product IDs and return a not-found route for missing/deleted products.
- **FR-014**: System MUST select a product variant from `?v=<variantId>` when valid, otherwise default to the first active variant.
- **FR-015**: System MUST reflect variant changes in the URL using `router.replace` without scrolling.
- **FR-016**: System MUST render product options and option values when configured, derive option selectors from compatible SKU segments when not configured, or fall back to a variant grid.
- **FR-017**: System MUST mark out-of-stock option values and product/variant stock states visibly in the UI.
- **FR-018**: System MUST require a selected variant before add-to-cart and cap selectable quantity by remaining stock and 10.
- **FR-019**: System MUST support guest pending-cart adds and authenticated Redux cart adds for selected variants.
- **FR-020**: System MUST track product detail views in client-side recently viewed storage and render recently viewed products when present.
- **FR-021**: System MUST preserve locale-prefixed navigation for shop, product, cart, and internal customer links.
- **FR-022**: System MUST format product, variant, card, search-result, and cart-action prices through `useCurrency().formatPrice`.
- **FR-023**: System MUST log zero-result searches and search-result click events as business events.
- **FR-024**: System MUST keep this functional catalog/search scope separate from the visual shop styling already covered by `specs/001-cozy-shop-ui`.

### Key Entities

- **Product**: Public catalog item with 7-character ID, localized content, image(s), category, soft-delete state, timestamps, options, variants, and sold count.
- **ProductVariant**: Purchasable product configuration with SKU, price, stock, image(s), sort order, soft-delete state, and option value relationships.
- **ProductOption / ProductOptionValue**: Named variant dimensions and values used to render option selectors.
- **CatalogSearchResult**: Derived product listing record containing product identity, category, image, minimum price, total stock, sold count, created date, rating, and variant count.
- **SearchSuggestion**: Suggested product labels, category names, popular terms, and recent local queries returned for discovery input.
- **BestsellerProduct**: Product ordered by sales aggregation with no-sale products included after sellers.
- **RecentlyViewedProduct**: Client-side local history entry with product ID, name, image, price, category, and viewed timestamp.
- **CartLineIntent**: Add-to-cart input composed of product ID, selected variant ID, and requested quantity.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Shop page renders initial products, bestsellers, categories, and active query-state filters from server data without client-only blocking.
- **SC-002**: Applying any supported filter produces a shareable URL and reloads to the same filtered result set.
- **SC-003**: Infinite scrolling appends products without duplicates and stops when `hasMore` is false.
- **SC-004**: Search suggestions and global search return valid product/category/popular data within configured API limits and degrade to empty states without runtime errors.
- **SC-005**: Product detail pages select, display, and share variants accurately through the `v` query parameter.
- **SC-006**: Out-of-stock, low-stock, all-stock-in-cart, and quantity-clamp states are visible before invalid cart quantities can be submitted.
- **SC-007**: Bestsellers and sold-count displays reflect order aggregation logic and are independently cacheable from the main product list.
- **SC-008**: Locale-aware internal links and currency formatting remain consistent across catalog cards, search results, product detail, add-to-cart, recently viewed, and cart links.
