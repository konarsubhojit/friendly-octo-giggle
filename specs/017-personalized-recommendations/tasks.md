# Tasks: Personalized Recommendations

**Input**: Design documents from `/specs/017-personalized-recommendations/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Test tasks ARE included. The spec mandates them via SC-008 (85% service-layer coverage) and SC-002 / SC-003 / SC-004 / SC-007, and Constitution Principle III makes unit tests non-optional for shared utilities and services.

**Organization**: Tasks are grouped by user story. Phase 2 is a hard blocker — the scoring pipeline and selection service must exist before any surface can render.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: `[US1]`–`[US4]` map to the four user stories in spec.md

## Path Conventions

Next.js App Router monolith. All application code under `src/`; tests mirror the source path under `__tests__/`; E2E specs in `playwright-tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the module skeleton and the tuning constants everything else imports.

- [x] T001 Create the feature module directory tree `src/features/recommendations/{components,services,inngest}/` with a `.gitkeep` in each empty directory
- [x] T002 [P] Create `src/features/recommendations/constants.ts` exporting `AFFINITY_WINDOW_DAYS = 180`, `MIN_SUPPORT = 3`, `MAX_PAIRS_PER_ANCHOR = 24`, `RAIL_SIZE = 8`, `ANCHOR_BATCH_SIZE = 250`, and `SIGNAL_WEIGHTS` per [data-model.md](./data-model.md)
- [x] T003 [P] Create `src/features/recommendations/validations.ts` with the `RecommendationSurface` union (`product` | `cart` | `home` | `zero_result`), the `RecommendationItem` projection (`id`, `name`, `description`, `image`, `category`, `price`, `inStock: boolean` — deliberately **excluding** the numeric `stock` and `soldCount` fields that `ProductGridItem` carries, per FR-010), and the `RecommendationResult` type carrying `surface`, `fallback`, and `products: RecommendationItem[]`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, scoring job, selection service, and event plumbing. Every user story reads from this layer.

**⚠️ CRITICAL**: No user story work can begin until T019 (selection service tests) is green.

### Schema and migration

- [x] T004 Add the `productAffinityScores` table to `src/lib/schema.ts` with columns `id`, `anchorProductId`, `recommendedProductId`, `score`, `support`, `source`, `computedAt`; unique `(anchorProductId, recommendedProductId)`; checks `anchorProductId <> recommendedProductId` and `support >= 1`; indexes `(anchorProductId, score DESC)`, `(recommendedProductId)`, `(computedAt)`; both FKs `ON DELETE CASCADE` per [data-model.md](./data-model.md)
- [x] T005 Run `npm run db:generate`, review the emitted SQL, and confirm the generated migration file (whatever sequence number `db:generate` assigns — `0016_*` at time of writing, higher if a parallel feature lands first) is purely additive: one CREATE TABLE, three CREATE INDEX, no ALTER on an existing table
- [x] T006 Apply with `npm run db:migrate` and refresh `scripts/sql/bootstrap-drizzle-initial.sql` to mirror the new migration so `npm run db:bootstrap` stays current

### Cache configuration

- [x] T007 Add `RECOMMENDATIONS_BY_ANCHOR`, `RECOMMENDATIONS_BY_ANCHOR_SET`, and `RECOMMENDATIONS_STATUS` to `CACHE_KEYS` and `RECOMMENDATIONS` (900), `RECOMMENDATIONS_STALE` (60), `RECOMMENDATIONS_STATUS` (60) to `CACHE_TTL` in `src/lib/cache.ts`

### Scoring pipeline

- [x] T008 [P] Write failing unit tests in `__tests__/features/recommendations/services/scoring.test.ts` covering signal weighting, the `MIN_SUPPORT` cutoff, window bounding, `MAX_PAIRS_PER_ANCHOR` truncation, and re-run idempotency (FR-002, FR-003)
- [x] T009 Implement pair aggregation in `src/features/recommendations/services/scoring.ts`: `collectPurchasePairs`, `collectWishlistPairs`, and `collectSharePairs`, each applying the `HAVING COUNT(DISTINCT …) >= MIN_SUPPORT` floor inside the query so sub-threshold pairs never leave the database (FR-003, privacy edge case)
- [x] T010 Implement `mergeSignals` and `writeAffinityBatch` in `src/features/recommendations/services/scoring.ts`: weighted merge into a single directed score, top-`MAX_PAIRS_PER_ANCHOR` truncation per anchor, and a delete-then-insert per anchor batch inside one Drizzle transaction using `primaryDrizzleDb` (FR-001, FR-002)
- [x] T011 Add `SCORE_NAMES.affinityComputed` to `src/lib/inngest/scores.ts`, the score-name constants module consumed by `scoreMiddleware`
- [x] T012 Implement `computeProductAffinityFunction` in `src/features/recommendations/inngest/affinity.ts` with `triggers: [cron('0 4 * * *'), { event: 'recommendations/affinity.recompute' }]`, `concurrency: { limit: 1 }`, `retries: 2`, and the step decomposition in [contracts/inngest-events.md](./contracts/inngest-events.md) — `resolve-window` must return a fixed boundary so retries reproduce the same rows
- [x] T013 Emit `step.score('score-affinity-computed', …)` and a `logBusinessEvent` with `recommendation_scores_computed` carrying `windowDays`, `anchorCount`, `pairCount`, `durationMs`, `triggeredBy` in `src/features/recommendations/inngest/affinity.ts`
- [x] T014 Call `invalidateCache('recommendations:*')` as the final step of `computeProductAffinityFunction`, catching and logging failures without failing the run (Constitution Principle IV)
- [x] T015 Register `computeProductAffinityFunction` in `src/lib/inngest/registry.ts`

### Selection service (shared by all four surfaces)

- [x] T016 [P] Write failing unit tests in `__tests__/features/recommendations/services/selection.core.test.ts` covering the shared predicate and fallback: no scores for the anchor, all candidates filtered out, `getCachedData` throwing, anchor self-exclusion, soft-deleted exclusion, zero sellable stock exclusion, cross-anchor dedupe, and the absence of any `stock` or `soldCount` field in the returned `RecommendationItem` shape on **both** the scored and the fallback branch (SC-001, SC-002, SC-003)
- [x] T017 Implement the shared candidate predicate `isEligibleCandidate` in `src/features/recommendations/services/selection.ts`: excludes `deletedAt IS NOT NULL`, excludes products where no variant has `stock - reservedStock > 0`, excludes the anchor, excludes a caller-supplied exclusion set, and dedupes across anchors (FR-006, R-008)
- [x] T018 Implement `resolveBestsellerFallback` in `src/features/recommendations/services/selection.ts` delegating to `db.products.findBestsellers`, category-scoped when a category is known and unscoped otherwise, and mapping the returned `Product[]` through the same `toRecommendationItem` projection so the fallback branch cannot leak fields the scored branch strips (FR-005, FR-010, R-009)
- [x] T019 Implement the surface entry points `getProductRail`, `getCartRail`, `getHomeRail`, and `getZeroResultRail` in `src/features/recommendations/services/selection.ts`, each reading scores through `getCachedData` with `CACHE_TTL.RECOMMENDATIONS` / `_STALE`, catching read failures and treating them as "no scores", and projecting to `RecommendationItem` so stock is collapsed to a boolean and the numeric value never leaves the service (FR-004, FR-005, FR-010)

### Event recording and shared presentation

- [x] T020 [P] Write failing unit tests in `__tests__/features/recommendations/services/events.test.ts` asserting the emitted `logBusinessEvent` shape for both `recommendation_impression` and `recommendation_click` (FR-012, SC-007)
- [x] T021 [P] Implement `recordRecommendationEvent` in `src/features/recommendations/services/events.ts` calling `logBusinessEvent` with `surface`, `anchorProductId`, `productIds`, and `fallback`; no persistence (R-007)
- [x] T022 Add `RecommendationEventSchema` to `src/features/recommendations/validations.ts` per [contracts/recommendations-api.md](./contracts/recommendations-api.md), including the `.refine` requiring exactly one `productIds` element when `type` is `click`
- [x] T023 Implement `POST /api/recommendations/event` in `src/app/api/recommendations/event/route.ts` using `withApiLogging`, `safeParse` + `handleValidationError`, `apiSuccess`, `handleApiError`, and the rate limiter from `src/lib/rate-limit.ts`
- [x] T024 [P] Create `src/components/skeletons/RecommendationRailSkeleton.tsx` matching the card dimensions of `BestsellerCardSkeleton` so the rail reserves its final height and cannot shift layout (CLS)
- [x] T025 [P] Create the `'use client'` component `src/features/recommendations/components/RecommendationTracker.tsx`: fires one impression beacon on first viewport entry via `IntersectionObserver` and one click beacon per click, using `navigator.sendBeacon` with a `fetch` fallback, silent on failure, with observer cleanup on unmount
- [x] T026 Create the Server Component `src/features/recommendations/components/RecommendationRail.tsx` accepting `readonly` props `{ title, surface, anchorProductId, products: RecommendationItem[], fallback }`, rendering nothing when `products` is empty, wrapping the list in `RecommendationTracker`, rendering its own card rather than delegating to `BestsellersScroller` (whose props require the wider `ProductGridItem`), expressing availability through `StockBadge`'s boolean mode, and formatting prices through the existing currency path — never raw `$` or `.toFixed(2)`
- [x] T027 [P] Write component tests in `__tests__/features/recommendations/components/RecommendationRail.test.tsx` asserting the empty-list null render, that the anchor product never appears, and that no numeric stock or sold-count value is rendered

**Checkpoint**: Scores compute and persist, the selection service resolves with fallback, and the rail component renders. User stories can now proceed in parallel.

---

## Phase 3: User Story 1 - Related products on the product page (Priority: P1) 🎯 MVP

**Goal**: A shopper viewing a product sees co-purchased partners ranked by association strength, with a category-scoped bestseller fallback.

**Independent Test**: Seed orders containing known product pairs, invoke the scoring function, open one product's page, and confirm its partners appear in association-strength order and the anchor itself is absent.

### Tests for User Story 1

- [x] T028 [P] [US1] Write tests in `__tests__/features/recommendations/services/selection.product.test.ts` for `getProductRail`: ordering by descending score, fallback to same-category bestsellers when the anchor has no rows, and anchor absence in every branch (Story 1 scenarios 1–4)

### Implementation for User Story 1

- [x] T029 [US1] Add a `RecommendedProductsSection` async Server Component to `src/app/(public)/products/[id]/page.tsx` (or a colocated file it imports) that calls `getProductRail` and renders `RecommendationRail` with `surface="product"`
- [x] T030 [US1] Wrap that section in a `<Suspense fallback={<RecommendationRailSkeleton />}>` boundary placed below the fold in `src/app/(public)/products/[id]/page.tsx`, ensuring the rail is not awaited in the page body and cannot become the LCP element (FR-011, SC-005)

**Checkpoint**: User Story 1 is independently demonstrable end to end — scoring job through rendered rail.

---

## Phase 4: User Story 2 - Cart cross-sell before checkout (Priority: P2)

**Goal**: A shopper reviewing their cart sees complementary products derived from all cart items combined, excluding what is already in the cart.

**Independent Test**: Add known products to a cart, open the cart, and confirm suggestions derive from the combined contents and exclude every item present.

### Tests for User Story 2

- [x] T031 [P] [US2] Write tests in `__tests__/features/recommendations/services/selection.cart.test.ts` for `getCartRail`: multi-anchor union and merge, exclusion of every current cart product, and an empty-cart input returning an empty result rather than bestsellers (Story 2 scenarios 1–3)

### Implementation for User Story 2

- [x] T032 [US2] Add a `CartCrossSellSection` async Server Component to `src/app/(public)/cart/page.tsx` that reads the server-side cart, returns `null` when the cart is empty, and otherwise calls `getCartRail` with the cart product IDs as both anchors and the exclusion set
- [x] T033 [US2] Wrap that section in a `<Suspense fallback={<RecommendationRailSkeleton />}>` boundary positioned below the checkout call to action in `src/app/(public)/cart/page.tsx` so the rail cannot displace or visually outrank it (Story 2 scenario 4)

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Personalized home rail for signed-in shoppers (Priority: P2)

**Goal**: A returning signed-in shopper sees a rail informed by their own orders and wishlist, seeded with their recently-viewed products; guests see a non-personalized rail with nothing computed or stored for them.

**Independent Test**: Sign in as a user with order and wishlist history, load `/shop`, and confirm the rail reflects that history and differs from a second user's rail.

### Tests for User Story 3

- [x] T034 [P] [US3] Write tests in `__tests__/features/recommendations/services/selection.home.test.ts` for `getHomeRail`: anchors drawn only from the requesting user's own orders and wishlist, client-supplied seeds unioned with those anchors, two different users producing different results, and a user with no history and no seeds falling back to bestsellers (Story 3 scenarios 1, 3, 4; FR-001a; SC-004)
- [x] T035 [P] [US3] Write route tests in `__tests__/app/api/recommendations/personalized.test.ts` asserting the guest branch returns bestsellers with `fallback: true` and executes no per-user query or identifier-keyed cache write, and that an oversized or malformed `seeds` value returns `400` (FR-009)

### Implementation for User Story 3

- [x] T036 [P] [US3] Add `PersonalizedQuerySchema` to `src/features/recommendations/validations.ts` per [contracts/recommendations-api.md](./contracts/recommendations-api.md) — comma-split `seeds` capped at 12 entries of exactly 7 characters, `limit` coerced to `1..12` defaulting to 8
- [x] T037 [US3] Implement `GET /api/recommendations/personalized` in `src/app/api/recommendations/personalized/route.ts`: resolve the session, return the guest bestseller path **before** any per-user read, otherwise union `seeds` with the user's own order and wishlist anchors and call `getHomeRail`; set `Cache-Control: private, no-store` for the authenticated branch and `public, max-age=60` for the guest branch; never return `401`
- [x] T038 [P] [US3] Create the `'use client'` component `src/features/recommendations/components/PersonalizedRailSeeds.tsx` reading recently-viewed IDs via `useRecentlyViewed` and fetching `/api/recommendations/personalized?seeds=…`, rendering `RecommendationRailSkeleton` while pending and `RecommendationRail` with `surface="home"` on resolve (R-006)
- [x] T039 [US3] Mount `PersonalizedRailSeeds` on `src/app/(public)/shop/page.tsx` inside its own `<Suspense>` boundary, positioned so it does not displace the existing `BestsellersScroller` (FR-007, FR-011)

**Checkpoint**: All P1 and P2 stories work independently.

---

## Phase 6: User Story 4 - Recovery from zero-result search (Priority: P3)

**Goal**: A shopper whose search returns nothing is offered relevant products alongside the existing zero-result guidance, respecting an active category filter.

**Independent Test**: Search for a term with no matches and confirm recommended products are offered; repeat with a category filter and confirm the suggestions respect it.

### Tests for User Story 4

- [x] T040 [P] [US4] Write tests in `__tests__/features/recommendations/services/selection.zero-result.test.ts` for `getZeroResultRail`: category-scoped results when a category filter is supplied, unscoped when not, and bestseller fallback when no score data exists (Story 4 scenarios 1–3)

### Implementation for User Story 4

- [x] T041 [US4] Add a `ZeroResultRecoverySection` async Server Component rendered from the existing empty-results branch of `src/app/(public)/shop/page.tsx`, calling `getZeroResultRail` with the active category filter when present
- [x] T042 [US4] Wrap that section in a `<Suspense fallback={<RecommendationRailSkeleton />}>` boundary placed after the existing zero-result guidance copy in `src/app/(public)/shop/page.tsx`, so recommendations supplement rather than replace it and never override the shopper's active filter

**Checkpoint**: All four user stories are independently functional.

---

## Phase 7: Admin Controls (FR-014)

**Purpose**: Let an operator see when scores were last refreshed and trigger a recomputation.

- [x] T043 [P] Write route tests in `__tests__/app/api/admin/recommendations.test.ts` asserting `401` without a session, `403` without `system:manage`, a `200` status payload shape, and a `202` recompute response carrying the `dispatch` result
- [x] T044 [P] Implement `getAffinityStatus` in `src/features/recommendations/services/status.ts` returning `lastComputedAt`, `pairCount`, `anchorCount`, `windowDays`, and `minSupport`, cached through `getCachedData` under `CACHE_KEYS.RECOMMENDATIONS_STATUS`
- [x] T045 [P] Add `RecomputeRequestSchema` (`windowDays` optional, `7..365`) to `src/features/recommendations/validations.ts`
- [x] T046 Implement `GET /api/admin/recommendations/status` in `src/app/api/admin/recommendations/status/route.ts` guarded by `checkAdminAuth('system:manage')`
- [x] T047 Implement `POST /api/admin/recommendations/recompute` in `src/app/api/admin/recommendations/recompute/route.ts` guarded by `checkAdminAuth('system:manage')`, publishing `recommendations/affinity.recompute` through `publishWithTimeout` and returning `202` with the `WorkflowDispatchResult`
- [x] T048 Create the admin page `src/app/admin/recommendations/page.tsx` using `requireAdminPermission('system:manage', '/admin/recommendations')` — the two-argument form used by `src/app/admin/search/page.tsx` — and `await connection()`, server-rendering the status and mounting a client "Recompute now" button that reflects the returned `dispatch` value
- [x] T056 Register `['/admin/recommendations', 'system:manage']` in the admin route-permission map in `src/proxy.ts`, matching the existing `/admin/search` and `/admin/email-failures` entries, so the page is gated at the edge and not only by the in-page check (Constitution Principle V)
- [x] T057 [P] Add a `/admin/recommendations` entry with `permission: 'system:manage'` to the nav list in `src/features/admin/components/AdminNavLinksClient.tsx` so the page is discoverable rather than URL-only

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T049 [P] Write `playwright-tests/recommendations.spec.ts` covering all four surfaces, the empty-cart no-rail case, the guest home rail, and a run with Upstash credentials unset to prove the bestseller fallback renders without error (SC-002)
- [x] T050 [P] Document the recommendation surfaces, the three scoring signals and their weights, the recently-viewed seed mechanism (FR-001a), the minimum-support threshold, the fallback behavior, and the measured job runtime from T058 in `docs/features.md` (FR-015)
- [x] T051 Verify service-layer coverage for `src/features/recommendations/services/**` meets 85% via `npm run test:coverage`; add cases for any uncovered branch (SC-008)
- [x] T052 Run `sonarqube_analyze_file` on every file created or modified, plus `sonarqube_list_potential_security_issues` on the four route handlers and `services/scoring.ts`; resolve all Blocker and Critical findings
- [ ] T053 Measure LCP with Lighthouse against the production build on `/products/[id]`, `/cart`, and `/shop` — median of five runs per page, compared to a baseline captured before the rails were added. Fail on a regression greater than 100 ms or any crossing of the 2.5 s "good" threshold; if a rail is implicated, move its `Suspense` boundary further below the fold (SC-005)
  - **Deferred**: requires a Lighthouse baseline captured before the rails landed. Structurally mitigated: every rail sits below the fold behind its own `Suspense` boundary and is marked per-request with `connection()`, so `npm run build` confirms all three routes still report Partial Prerender (static shell + streamed rail) rather than becoming fully dynamic.
- [ ] T058 Seed a representative order volume (≥ 5,000 orders across ≥ 500 products inside the 180-day window), invoke `computeProductAffinityFunction`, and record per-step and total wall time. Assert the run completes inside the Inngest step budget with headroom; if it does not, reduce `ANCHOR_BATCH_SIZE` or narrow `AFFINITY_WINDOW_DAYS` and re-measure (SC-006)
  - **Deferred**: needs a seeded volume of >=5,000 orders, which the development database does not have. The three bounds it would validate (`AFFINITY_WINDOW_DAYS`, `ANCHOR_BATCH_SIZE` step chunking, `MAX_PAIRS_PER_ANCHOR`) are implemented and unit-tested.
- [ ] T054 Execute the [quickstart.md](./quickstart.md) walkthrough end to end, including the privacy checks (no `stock` or `soldCount` field in any response, two users receiving different rails, guest writing nothing) and capture screenshots of the four surfaces for the PR
  - **Deferred**: the quickstart walkthrough and PR screenshots need a running dev server with seeded catalog data. The privacy invariants it checks are asserted at the service layer (`selection.core.test.ts`) and in `playwright-tests/recommendations.spec.ts`.
- [x] T055 Run the full pre-PR gate: `npm run lint`, `npx tsc --noEmit -p tsconfig.check.json`, `npm test`, `npm run build`, `npm run docs:check`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies
- **Phase 2 (Foundational)**: Depends on Phase 1 — **blocks every user story**
- **Phases 3–6 (User Stories)**: All depend on Phase 2 completing through T027; independent of one another thereafter
- **Phase 7 (Admin)**: Depends on Phase 2 (needs the table and the Inngest event); independent of Phases 3–6
- **Phase 8 (Polish)**: Depends on all desired stories being complete

### Critical Path Within Phase 2

```text
T004 → T005 → T006          (schema → migration → bootstrap)
T004 → T009                 (T009 queries the table T004 creates)
T007                        (cache keys, independent of the migration)
T008 → T009 → T010 → T012 → T013 → T014 → T015   (scoring pipeline)
T011 → T012
T003 → T016 → T017 → T018 → T019   (selection service; T016 asserts the T003 projection, T019 needs T007)
T020 → T021 → T022 → T023   (event recording)
T024, T025 → T026 → T027    (presentation; T026 renders T003's RecommendationItem)
```

### Shared-file serialization points

These tasks edit the same file and must not be run concurrently, even where
they sit in different phases:

| File                                                 | Tasks                  |
| ---------------------------------------------------- | ---------------------- |
| `src/features/recommendations/validations.ts`        | T003, T022, T036, T045 |
| `src/features/recommendations/services/selection.ts` | T017, T018, T019       |
| `src/app/(public)/shop/page.tsx`                     | T039, T042             |

### User Story Dependencies

- **US1 (P1)**: Phase 2 only. No dependency on other stories.
- **US2 (P2)**: Phase 2 only. Reuses `RecommendationRail` from T026.
- **US3 (P2)**: Phase 2 only. T036 is serialized on `validations.ts`; T038 additionally depends on the existing `useRecentlyViewed` hook, which already ships.
- **US4 (P3)**: Phase 2 only. Shares `src/app/(public)/shop/page.tsx` with US3 — **T039 and T042 touch the same file and must not run in parallel.**

### Parallel Opportunities

- T002 and T003 (Phase 1)
- T008, T016, T020, T024, T025 — independent test-first tracks and presentation files (Phase 2)
- T028, T031, T034, T035, T040 — each now writes its own `selection.*.test.ts` file, so all five are genuinely independent
- T038 within US3; T043, T044 within Phase 7 (T045 is serialized on `validations.ts`)
- T049, T050, T057 in Phases 7–8
- Whole user stories: US1, US2, US3, US4 can be staffed in parallel once T027 lands, subject to the serialization table above

---

## Parallel Example: Phase 2 kickoff

```bash
# After T003 and T007 land, launch the four independent test-first tracks together:
Task: "Failing scoring tests in __tests__/features/recommendations/services/scoring.test.ts"        # T008
Task: "Failing selection tests in __tests__/features/recommendations/services/selection.core.test.ts" # T016
Task: "Failing event tests in __tests__/features/recommendations/services/events.test.ts"          # T020
Task: "RecommendationRailSkeleton in src/components/skeletons/RecommendationRailSkeleton.tsx"      # T024
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 — Setup (T001–T003)
2. Phase 2 — Foundational (T004–T027) — **critical, blocks everything**
3. Phase 3 — User Story 1 (T028–T030)
4. **STOP and VALIDATE**: seed pairs, run the job, confirm the product-page rail orders by strength, excludes the anchor, and falls back on a cold anchor
5. Demo-ready

### Incremental Delivery

1. Setup + Foundational → scoring and selection proven at the service layer
2. - US1 → product-page rail (MVP)
3. - US2 → cart cross-sell
4. - US3 → personalized home rail
5. - US4 → zero-result recovery
6. - Phase 7 → admin visibility and manual recompute
7. - Phase 8 → coverage, docs, performance, security, screenshots

Each increment is independently shippable because every surface degrades to bestsellers on its own.

---

## Summary

| Phase | Focus                      | Tasks                | Count  |
| ----- | -------------------------- | -------------------- | ------ |
| 1     | Setup                      | T001–T003            | 3      |
| 2     | Foundational (blocking)    | T004–T027            | 24     |
| 3     | US1 — Product page (P1) 🎯 | T028–T030            | 3      |
| 4     | US2 — Cart cross-sell (P2) | T031–T033            | 3      |
| 5     | US3 — Home rail (P2)       | T034–T039            | 6      |
| 6     | US4 — Zero-result (P3)     | T040–T042            | 3      |
| 7     | Admin controls             | T043–T048, T056–T057 | 8      |
| 8     | Polish                     | T049–T055, T058      | 8      |
|       | **Total**                  |                      | **58** |
