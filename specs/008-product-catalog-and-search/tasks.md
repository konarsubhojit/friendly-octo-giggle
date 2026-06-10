# Tasks: Product Catalog and Search

**Input**: Design documents from `/specs/008-product-catalog-and-search/`  
**Prerequisites**: `spec.md`, `plan.md`

## Phase 1: Foundation (Catalog Data + Cache)

**Purpose**: Establish the public catalog data model, read paths, and cache behavior used by all user stories.

- [ ] T001 Verify product, product option, product option value, product variant, and variant-option relationship schema in `src/lib/schema.ts`.
- [ ] T002 Verify public product types include images, category, sold count, options, and variants in `src/lib/types.ts`.
- [ ] T003 Implement/verify product list, minimal product, product-by-ID, and bestseller query helpers in `src/lib/db-queries.ts`.
- [ ] T004 Implement/verify sold-count aggregation from order items and qualifying orders in `src/lib/db-queries.ts`.
- [ ] T005 Implement/verify cache keys, TTLs, public cache headers, and invalidation helpers for product list/detail/bestsellers/categories/sold counts in `src/lib/cache.ts`.

---

## Phase 2: User Story 1 - Browse the Product Catalog (Priority: P1) 🎯 MVP

**Goal**: Shoppers can open the localized shop route, see bestsellers, browse product cards, and load more catalog products.

**Independent Test**: Navigate to `/[locale]/shop`, verify bestsellers and the initial 24 cards render, then scroll until another API-backed batch appends without duplicates.

### Implementation for User Story 1

- [ ] T006 [US1] Implement/verify `/api/products` pagination with validated `limit`/`offset` and `hasMore` response in `src/app/api/products/route.ts`.
- [ ] T007 [US1] Implement/verify `/api/products/bestsellers` with Zod `limit` validation and CDN cache headers in `src/app/api/products/bestsellers/route.ts`.
- [ ] T008 [US1] Implement/verify server-rendered shop data loading, ISR, category fetch, bestseller fetch, and initial catalog query in `src/app/[locale]/(public)/shop/page.tsx`.
- [ ] T009 [US1] Implement/verify product cards show image, localized link, wishlist button, stock badge, formatted price, and sold count in `src/features/product/components/ProductGrid.tsx`.
- [ ] T010 [US1] Implement/verify infinite-scroll load-more behavior, duplicate merging, loading state, error state, and end-of-results messaging in `src/features/product/components/ProductGrid.tsx`.
- [ ] T011 [US1] Add/verify route/component tests for product API pagination, bestseller ordering, shop server data fallback, and ProductGrid load-more behavior.

**Checkpoint**: A shopper can browse and page through catalog products without using search or filters.

---

## Phase 3: User Story 2 - Refine Catalog Results (Priority: P1)

**Goal**: Shoppers can filter and sort the catalog through URL-backed controls and reloadable query state.

**Independent Test**: Apply each supported filter on the shop page, reload the resulting URL, and confirm products and load-more requests keep the same filters.

### Implementation for User Story 2

- [ ] T012 [US2] Implement/verify search query parsing for `q`, `category`, `sort`, `minPrice`, `maxPrice`, `inStock`, `minRating`, and `variant` in `src/app/[locale]/(public)/shop/page.tsx`.
- [ ] T013 [US2] Implement/verify validated sort and variant filter constants in `src/lib/search-discovery.ts`.
- [ ] T014 [US2] Implement/verify catalog filtering by price, stock, rating, and variant count in `src/lib/search-discovery.ts`.
- [ ] T015 [US2] Implement/verify catalog sorting by relevance, price, newest, best-selling, and top-rated in `src/lib/search-discovery.ts`.
- [ ] T016 [US2] Implement/verify ProductGrid filter controls build canonical URL parameters and normalize reversed price ranges in `src/features/product/components/ProductGrid.tsx`.
- [ ] T017 [US2] Implement/verify empty-state suggestions and trending links when filters/search produce no results in `src/features/product/components/ProductGrid.tsx` and `src/lib/search-discovery.ts`.
- [ ] T018 [US2] Add/verify tests for filter parsing, URL generation, sort ordering, zero-result suggestions, and trending fallback.

**Checkpoint**: Catalog result state is shareable via URL and consistent across server render and client pagination.

---

## Phase 4: User Story 3 - Search from Catalog and Header (Priority: P2)

**Goal**: Shoppers can discover products through the shop search suggestions and global search dialog with resilient search service fallback.

**Independent Test**: Use the inline shop search and global Cmd/Ctrl+K dialog, verify debounced calls, grouped suggestions/results, keyboard navigation, localized product navigation, and fallback behavior when Upstash Search is unavailable.

### Implementation for User Story 3

- [ ] T019 [US3] Implement/verify Upstash Search availability checks, product indexing/search, Redis caching, and DB fallback signal in `src/lib/search/client.ts` and `src/lib/search/product-search.ts`.
- [ ] T020 [US3] Implement/verify search orchestration, relevance mapping, facets, suggestions, trending fallback, and zero-result logging in `src/lib/search-discovery.ts`.
- [ ] T021 [US3] Implement/verify `/api/search` query validation, result response, and public cache headers in `src/app/api/search/route.ts`.
- [ ] T022 [US3] Implement/verify `/api/search/suggest` validation, cached suggestion response, and popular default terms in `src/app/api/search/suggest/route.ts`.
- [ ] T023 [US3] Implement/verify `/api/search/click` body validation and business-event logging in `src/app/api/search/click/route.ts`.
- [ ] T024 [US3] Implement/verify shop `SearchBar` recent searches, grouped suggestions, popular searches, category quick links, and localStorage scoping in `src/components/SearchBar.tsx`.
- [ ] T025 [US3] Implement/verify global `ProductSearch` dialog shortcut, debounce, result normalization, keyboard navigation, and localized navigation in `src/features/product/components/ProductSearch.tsx`.
- [ ] T026 [US3] Add/verify tests for search APIs, suggestion caching, fallback search, recent searches, and dialog keyboard navigation.

**Checkpoint**: Search works from both catalog and header paths and degrades safely when the external search service is absent.

---

## Phase 5: User Story 4 - View Product Details and Variants (Priority: P2)

**Goal**: Shoppers can open product detail pages, see complete product data, and select/share variants through URL state.

**Independent Test**: Load product detail with and without `?v=`, select option values, refresh, and verify selected variant, price, stock, images, and URL state.

### Implementation for User Story 4

- [ ] T027 [US4] Implement/verify product detail server page ISR, metadata generation, cached product fetch, and not-found handling in `src/app/[locale]/(public)/products/[id]/page.tsx`.
- [ ] T028 [US4] Implement/verify `/api/products/[id]` cached detail response, locale content localization, and 404 behavior in `src/app/api/products/[id]/route.ts`.
- [ ] T029 [US4] Implement/verify initial variant resolution from `?v=` and URL replacement on variant selection in `src/app/[locale]/(public)/products/[id]/ProductClient.tsx` and `lib/variant-utils.ts`.
- [ ] T030 [US4] Implement/verify product info, category, price, stock badge, sold count, share button, and variant selector in `src/app/[locale]/(public)/products/[id]/components/ProductInfoCard.tsx`.
- [ ] T031 [US4] Implement/verify option-based variant selection, SKU-derived synthetic options, out-of-stock option states, and selected variant summary in `src/app/[locale]/(public)/products/[id]/components/VariantSelector.tsx`.
- [ ] T032 [US4] Implement/verify product/variant image selection and carousel input construction in `src/app/[locale]/(public)/products/[id]/lib/images.ts` and `components/ProductImageSection.tsx`.
- [ ] T033 [US4] Implement/verify recently viewed tracking and rendering with dedupe/newest-first/max-12 behavior in `src/features/product/hooks/useRecentlyViewed.ts` and `RecentlyViewed.tsx`.
- [ ] T034 [US4] Add/verify tests for product detail 404, metadata, variant query handling, option selection, image fallback, and recently viewed behavior.

**Checkpoint**: Product detail and variant selection are independently functional without requiring cart actions.

---

## Phase 6: User Story 5 - Add Available Variants to Cart (Priority: P3)

**Goal**: Shoppers can add selected, in-stock variants to cart with guest/authenticated paths and stock-aware feedback.

**Independent Test**: Select an in-stock variant, add as guest and authenticated user, verify pending cart/Redux cart outcomes, quantity limits, all-stock-in-cart state, and mobile sticky action behavior.

### Implementation for User Story 5

- [ ] T035 [US5] Implement/verify cart fetching for authenticated users and cart quantity mapping by product/variant in `src/app/[locale]/(public)/products/[id]/ProductClient.tsx` and `lib/cart-quantities.ts`.
- [ ] T036 [US5] Implement/verify selected-variant requirement, guest pending-cart add, authenticated Redux add-to-cart, and result feedback in `src/app/[locale]/(public)/products/[id]/ProductClient.tsx`.
- [ ] T037 [US5] Implement/verify quantity clamping by remaining stock and stock warning messages in `src/app/[locale]/(public)/products/[id]/lib/variant-utils.ts`.
- [ ] T038 [US5] Implement/verify desktop quantity selector, total price, add button, View Cart link, and alerts in `src/app/[locale]/(public)/products/[id]/components/AddToCartSection.tsx` and `CartStatusAlerts.tsx`.
- [ ] T039 [US5] Implement/verify out-of-stock/all-stock-in-cart panel behavior in `src/app/[locale]/(public)/products/[id]/components/OutOfStockPanel.tsx`.
- [ ] T040 [US5] Implement/verify mobile sticky action bar wishlist, price, quantity, disabled state, and cart link in `src/app/[locale]/(public)/products/[id]/components/StickyMobileActionBar.tsx`.
- [ ] T041 [US5] Add/verify tests for guest pending cart, authenticated cart thunk dispatch, quantity limits, out-of-stock panel, and mobile disabled add button.

**Checkpoint**: Stock-valid variants can be added to cart and invalid quantities/actions are blocked with clear feedback.

---

## Phase 7: Cross-Cutting Validation

**Purpose**: Confirm catalog/search/detail behavior remains stable across localization, currency, accessibility, cache, and telemetry boundaries.

- [ ] T042 Verify locale-aware internal links in `src/components/ui/LocaleLink.tsx`, ProductGrid, BestsellersScroller, SearchBar, ProductSearch, RecentlyViewed, and product detail cart links.
- [ ] T043 Verify all customer-facing prices use `useCurrency().formatPrice` from `src/contexts/CurrencyContext.tsx`.
- [ ] T044 Verify public API validation rejects invalid search/product parameters with expected error responses.
- [ ] T045 Verify cache behavior for list/detail/bestseller/search/suggest routes and that free-text product-list queries are not cached by product-list cache keys.
- [ ] T046 Run `npm run lint`, `npx tsc --noEmit`, `npm test`, and `npm run build` before release.
- [ ] T047 Run Playwright coverage for shop browse/filter/search, global search dialog, product detail variant selection, and stock/add-to-cart states.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: No dependencies; blocks all user stories.
- **Phase 2 (US1)**: Depends on Phase 1; delivers browsing MVP.
- **Phase 3 (US2)**: Depends on Phase 1 and shares ProductGrid/search-discovery files with US1.
- **Phase 4 (US3)**: Depends on Phase 1 and can proceed after search-discovery contracts stabilize.
- **Phase 5 (US4)**: Depends on Phase 1; can proceed in parallel with US2/US3 after product detail query shape is stable.
- **Phase 6 (US5)**: Depends on US4 variant and stock state.
- **Phase 7**: Depends on selected user stories being complete.

### User Story Dependencies

- **US1**: Requires catalog data, cache, and product API foundation only.
- **US2**: Requires catalog API/search-discovery filters and ProductGrid URL controls.
- **US3**: Requires search-discovery and search APIs; integrates with locale navigation.
- **US4**: Requires product detail data with variants/options.
- **US5**: Requires selected variant and stock computations from US4.

### Parallel Opportunities

- T001–T005 can be reviewed in parallel by file area.
- US1 API tasks (T006–T007) can run in parallel with shop/ProductGrid tasks (T008–T010) after query helpers exist.
- US3 API tasks (T021–T023) can run in parallel with SearchBar/ProductSearch tasks (T024–T025) once response contracts are fixed.
- US4 detail components (T030–T033) can run in parallel after ProductClient state contracts are established.
- Cross-cutting validation tasks T042–T045 can be split by localization, currency, API validation, and caching.

## Notes

- This task list documents the already-shipped implementation and is ordered as if rebuilding it incrementally.
- Visual styling requirements belong to `specs/001-cozy-shop-ui`; this feature tracks functional catalog/detail/search behavior.
- Tests should be written or verified before changing behavior in any future maintenance pass.
