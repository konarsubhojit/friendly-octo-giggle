# Feature Specification: Personalized Recommendations

**Feature Branch**: `017-personalized-recommendations`  
**Created**: 2026-08-01  
**Status**: Draft  
**Epic**: Phase 2 — Correctness and commerce depth  
**Input**: Compute product affinity from purchase, wishlist, and share signals and surface it as recommendation rails on the product page, the cart, the `/shop` landing page, and zero-result search, with a bestseller fallback whenever scores are unavailable.

## Baseline (verified 2026-08-01)

- Discovery today is query-driven and non-personalized: faceted search and suggestions (`src/lib/search-discovery.ts`, `src/lib/search/`), click analytics, a bestsellers scroller, and a recently-viewed strip.
- Signals already exist in the database and are not yet used for affinity: `OrderItem` (co-purchase), `ProductShare` (intent), `Review` and `ReviewVote` (sentiment), and `Wishlist` (explicit interest).
- The infrastructure needed to compute and serve scores is already in place: Inngest scheduled functions (`refreshExchangeRatesFunction`, `scanAbandonedCartsFunction`) as the cron pattern, Redis with stampede prevention and stale-while-revalidate via `getCachedData`, and cache key conventions in `src/lib/cache.ts`.
- The platform's established fallback discipline — every optional service degrades to a database-backed path — applies directly: bestsellers is the natural fallback for an unavailable recommendation score.
- There is no `recommend*` module anywhere in `src/`; this capability does not exist in any form today.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Related products on the product page (Priority: P1)

A shopper viewing a product sees other products frequently bought or viewed alongside it, ranked by strength of association.

**Why this priority**: The product page is where purchase intent is highest and where a relevant adjacent item most reliably increases basket size. It also validates the scoring pipeline end to end with a single surface.

**Independent Test**: Seed orders containing known product pairs, run the scoring job, open one product's page, and confirm its co-purchased partners appear in association-strength order.

**Acceptance Scenarios**:

1. **Given** products co-purchased in past orders, **When** a shopper opens one of them, **Then** its partners are shown ordered by association strength.
2. **Given** a product with no association data, **When** a shopper opens it, **Then** the rail falls back to bestsellers from the same category rather than rendering empty.
3. **Given** a recommendation candidate that is soft-deleted or out of stock, **When** the rail renders, **Then** that candidate is excluded.
4. **Given** the recommendation rail, **When** it renders, **Then** it never includes the product currently being viewed.

---

### User Story 2 - Cart cross-sell before checkout (Priority: P2)

A shopper reviewing their cart sees complementary products derived from everything already in the cart.

**Why this priority**: A high-conversion placement that reuses the Story 1 scoring pipeline, but it must not distract from checkout completion.

**Independent Test**: Add known products to a cart, open the cart, and confirm suggestions derive from the combined cart contents and exclude items already present.

**Acceptance Scenarios**:

1. **Given** a cart with items, **When** the cart page renders, **Then** suggestions are derived from all cart items combined.
2. **Given** a product already in the cart, **When** suggestions render, **Then** it is not suggested again.
3. **Given** an empty cart, **When** the page renders, **Then** no cross-sell rail is shown.
4. **Given** the cross-sell rail, **When** it renders, **Then** it does not displace or visually outrank the checkout call to action.

---

### User Story 3 - Personalized home rail for signed-in shoppers (Priority: P2)

A returning signed-in shopper sees a rail informed by their own orders, wishlist, and recently viewed products.

**Why this priority**: Highest personalization value, but it depends on per-user data and carries the strictest privacy constraints, so it follows the anonymous surfaces.

**Independent Test**: Sign in as a user with order and wishlist history, load the `/shop` landing page, and confirm the rail reflects that history — combined with any recently-viewed seeds supplied by the browser — and differs from a second user's rail.

**Acceptance Scenarios**:

1. **Given** a signed-in shopper with history, **When** they open the `/shop` landing page, **Then** a personalized rail reflects their own signals.
2. **Given** a guest, **When** they open the `/shop` landing page, **Then** they see a non-personalized rail and no per-user data is computed or stored for them.
3. **Given** two different signed-in shoppers, **When** each loads the `/shop` landing page, **Then** neither receives the other's recommendations.
4. **Given** a signed-in shopper with no history, **When** the rail renders, **Then** it falls back to bestsellers.

---

### User Story 4 - Recovery from zero-result search (Priority: P3)

A shopper whose search returns nothing is offered relevant products instead of a dead end.

**Why this priority**: Recovers an otherwise-lost session, but affects a smaller share of traffic than the primary rails.

**Independent Test**: Search for a term with no matches and confirm recommended products are offered alongside the existing zero-result guidance.

**Acceptance Scenarios**:

1. **Given** a search with no results, **When** the page renders, **Then** recommended products are offered.
2. **Given** the search had a category filter, **When** recovery renders, **Then** suggestions respect that category when possible.
3. **Given** no recommendation data exists, **When** recovery renders, **Then** bestsellers are shown.

---

### Edge Cases

- A cold catalog with no order history must degrade to bestsellers everywhere rather than showing empty rails.
- Scores must never expose another customer's purchase history, directly or by inference from a single-order association.
- An association derived from a single order is statistically meaningless and must be suppressed by a minimum-support threshold.
- Guest recommendation requests must not create or persist per-user profiles.
- Recommendation data must never reveal exact stock counts, consistent with the AI assistant's existing stock-privacy rule.
- The scoring job must be bounded in runtime and memory so a growing order table cannot exhaust the function timeout.
- Deleting a user or product must remove the associated signals from subsequent score computation.
- A cache stampede on a popular product's rail must be prevented by the existing `getCachedData` mechanism.
- Recommendations must never override explicit shopper intent such as an active category filter.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: A scheduled Inngest function MUST compute product affinity scores from server-side signals: order co-purchase, wishlist co-occurrence, and share co-occurrence.
- **FR-001a**: The personalized rail MUST additionally accept the shopper's recently-viewed products as client-supplied anchor seeds at selection time. Recently-viewed history MUST NOT be persisted server-side, so it contributes to which scores are read rather than to how scores are computed.
- **FR-002**: The scoring job MUST process a bounded window of history per run and MUST be safe to re-run without corrupting scores.
- **FR-003**: Associations below a documented minimum support threshold MUST be discarded.
- **FR-004**: Computed scores MUST be cached in Redis through `getCachedData` with stampede prevention and an explicit TTL.
- **FR-005**: Every recommendation surface MUST fall back to category-scoped bestsellers when scores are unavailable, empty, or Redis is down.
- **FR-006**: Recommendation results MUST exclude soft-deleted and out-of-stock products, and MUST exclude the anchor product or current cart contents. The catalog has no separate publication state; soft-delete is the sole inactive-product marker.
- **FR-007**: Recommendations MUST be surfaced on the product detail page, the cart page, the `/shop` landing page for signed-in shoppers, and the zero-result search state.
- **FR-008**: Personalized results MUST be computed only for authenticated users, scoped strictly to the requesting user's own signals.
- **FR-009**: Guest requests MUST NOT create, persist, or cache a per-user profile.
- **FR-010**: Recommendation responses MUST NOT disclose exact stock counts or sales-volume counts. Availability MUST be expressed as a boolean.
- **FR-011**: Recommendation surfaces MUST NOT block page rendering; they MUST stream inside `Suspense` boundaries with skeleton fallbacks.
- **FR-012**: Recommendation impressions and clicks MUST be recorded so effectiveness can be measured, reusing the existing search click-analytics approach.
- **FR-013**: Schema changes MUST ship as a reviewed Drizzle migration with indexes supporting anchor-product score lookups.
- **FR-014**: An administrator MUST be able to trigger a score recomputation and see when scores were last refreshed.
- **FR-015**: `docs/features.md` MUST document the recommendation surfaces, the signals used, and the fallback behavior.

### Key Entities

- **ProductAffinityScore**: A directed association between an anchor product and a recommended product, with a strength value, a support count, and a computation timestamp.
- **RecommendationSignal**: A contributing scoring input — order co-purchase, wishlist co-occurrence, or share co-occurrence — with its weight in the scoring model. Recently-viewed is a selection-time seed (FR-001a), not a scoring signal.
- **RecommendationSurface**: A placement (product page, cart, home rail, zero-result recovery) with its own candidate rules and fallback.
- **RecommendationEvent**: An impression or click record used to measure effectiveness. Emitted as a structured log record, not persisted to a table (see SC-007).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Every recommendation surface renders non-empty content for any valid anchor, including on a catalog with no order history.
- **SC-002**: With Redis unavailable, every surface still renders through the bestseller fallback without error.
- **SC-003**: No recommendation response contains exact stock counts or another user's data.
- **SC-004**: Two different signed-in shoppers receive different personalized rails given different histories.
- **SC-005**: Recommendation rails do not regress Largest Contentful Paint on the product, cart, or `/shop` pages. Measured with Lighthouse in the production build, median of five runs per page, against a pre-change baseline; a regression greater than 100 ms or any crossing of the 2.5 s "good" threshold fails.
- **SC-006**: The scoring job completes within its scheduled window on a representative data volume.
- **SC-007**: Impression and click events are emitted as structured log records for every surface, carrying `surface`, `anchorProductId`, `productIds`, and `fallback`, such that click-through rate is derivable by aggregating `recommendation_impression` against `recommendation_click` in the log platform.
- **SC-008**: Service-layer coverage for scoring and selection meets the 85% threshold for `src/features/**/services/**`.

## Out of Scope

- Machine-learned ranking models, embeddings, or vector similarity; this feature is signal-based scoring only.
- Real-time per-event score updates; scores refresh on a schedule.
- Email or push recommendation campaigns.
- Manual merchandising rules or admin-curated placement.
- In-application click-through-rate reporting; CTR is derived from log aggregation (SC-007).
- Server-side persistence of recently-viewed history; it remains a client-supplied seed (FR-001a).

## Dependencies

- Reuses the Inngest cron pattern and the Redis caching helpers already in production.
- Complements `020-storefront-ai-assistant`, which may consume these scores but must not depend on them.
