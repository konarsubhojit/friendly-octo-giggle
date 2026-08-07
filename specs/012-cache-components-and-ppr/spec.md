# Feature Specification: Cache Components and Partial Prerendering

**Feature Branch**: `012-cache-components-and-ppr`  
**Created**: 2026-08-01  
**Status**: Draft  
**Epic**: Phase 1 — Foundation: rendering model and stack modernization  
**Input**: Adopt the Next.js 16 Cache Components model (`cacheComponents`, `"use cache"`, `cacheLife`, `cacheTag`) so the storefront serves a prerendered static shell with streamed dynamic holes, replacing the legacy segment-level `revalidate` / `force-dynamic` model.

## Baseline (verified 2026-08-01)

- The application runs Next.js `16.2.11` and React `19.2.7`, both of which ship the Cache Components model.
- `"use cache"`, `cacheLife`, `cacheTag`, and `updateTag` have **zero** occurrences in `src/`. `next.config.ts` declares no `cacheComponents` flag, so Partial Prerendering is entirely unrealized.
- Caching is expressed with the legacy segment model: `export const revalidate = 60` on `/shop` and `/products/[id]`, `revalidate = 3600` on marketing routes, and **60** occurrences of `export const dynamic = 'force-dynamic'` across `src/app`.
- Freshness after writes is managed manually through Redis key invalidation (`src/lib/cache.ts`, `src/lib/redis.ts`) plus Inngest cache-invalidation functions (`invalidateOrderCachesFunction`).
- No route defines `generateStaticParams`, so no product detail page is prebuilt at build time.
- Per-request deduplication already uses React `cache()` (for example `getProduct` in `src/app/(public)/products/[id]/page.tsx`).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Instant storefront shell for catalog browsing (Priority: P1)

A shopper opening the home, shop, or product detail page receives a prerendered shell immediately, while genuinely per-request content (cart badge, session state, personalized rails) streams in without blocking first paint.

**Why this priority**: Catalog pages are the highest-traffic surfaces and the primary Largest Contentful Paint (LCP) contributors. Cache Components is the mechanism that makes the shell static without giving up per-request correctness.

**Independent Test**: Build the application, request `/`, `/shop`, and a product detail route with JavaScript disabled, and confirm the catalog markup is present in the initial HTML payload while session-dependent regions render as their fallbacks.

**Acceptance Scenarios**:

1. **Given** the storefront is built with `cacheComponents` enabled, **When** an anonymous visitor requests `/shop`, **Then** the initial HTML contains product cards and category chips without waiting on a database round trip.
2. **Given** a product detail route, **When** a visitor requests it, **Then** product name, description, media, price, and variant options are served from the prerendered shell and only session-scoped regions stream.
3. **Given** a page mixes cached and uncached reads, **When** the build runs, **Then** every uncached read is enclosed in a `Suspense` boundary and the build completes without an uncached-data error.
4. **Given** a cached catalog page, **When** the response is served, **Then** it is not personalized: no session, cookie, or user-specific value leaks into the cached output.

---

### User Story 2 - Writes make cached content stale immediately (Priority: P1)

An administrator who edits a product, variant, category, or coupon sees the change on the storefront without waiting for a time-based window to elapse.

**Why this priority**: Tag-based invalidation is what makes aggressive caching safe. Without it, longer cache lifetimes trade correctness for speed, which is not acceptable for price and stock data.

**Independent Test**: Edit a product through the admin UI, then reload the corresponding storefront page and confirm the change is visible on the first request without a manual redeploy or a wait.

**Acceptance Scenarios**:

1. **Given** a cached product detail page, **When** an admin updates that product, **Then** the associated cache tag is revalidated and the next request serves updated content.
2. **Given** a cached catalog listing, **When** an admin creates, soft-deletes, or reorders a product or category, **Then** listing tags are revalidated so the item appears or disappears on the next request.
3. **Given** an order is created and stock is decremented, **When** the Inngest side-effect functions run, **Then** the product and listing tags affected by the stock change are revalidated.
4. **Given** a tag revalidation call fails, **When** the failure is observed, **Then** it is logged with context and the time-based `cacheLife` bound still guarantees eventual freshness.

---

### User Story 3 - Correct classification of per-request routes (Priority: P1)

Authenticated and operational surfaces — cart, checkout, orders, account, and every `/admin` route — continue to render per-request data with no cross-user contamination.

**Why this priority**: The migration touches 60 `force-dynamic` declarations. Wrongly caching an authenticated surface is a data-disclosure defect, which makes explicit classification the highest-risk part of this work.

**Independent Test**: For each route that currently declares `force-dynamic`, record its classification and verify with two concurrent authenticated sessions that no response body from one session is served to the other.

**Acceptance Scenarios**:

1. **Given** two different signed-in users, **When** each loads `/cart`, `/orders`, `/account`, and `/admin`, **Then** each response contains only that user's data.
2. **Given** a route classified as per-request, **When** the migration completes, **Then** the route reads session state outside any cached scope and is documented in the classification table.
3. **Given** a route classified as cacheable-with-holes, **When** it renders, **Then** its per-request regions are isolated inside `Suspense` boundaries and its cached regions contain no user-specific data.
4. **Given** an admin route, **When** it is requested without the required role, **Then** the existing `proxy.ts` permission gate still rejects it and no cached admin content is served.

---

### User Story 4 - Prebuilt detail pages for popular products (Priority: P2)

The most-requested product detail pages are generated at build time and the remainder are generated on demand and retained.

**Why this priority**: Removes cold-start latency for the pages most likely to be the entry point from search and shared links. It depends on Story 1 and delivers less value on its own.

**Independent Test**: Inspect build output and confirm the intended product routes are listed as prerendered, then request a product outside that set and confirm it renders correctly and is retained for subsequent requests.

**Acceptance Scenarios**:

1. **Given** the catalog contains products, **When** the application builds, **Then** a bounded set of product detail routes is prerendered.
2. **Given** a product that was not prebuilt, **When** it is first requested, **Then** it renders correctly and is retained for later requests.
3. **Given** the database is unreachable at build time, **When** static params are collected, **Then** the build degrades to prerendering no product routes instead of failing.

---

### Edge Cases

- A cached scope must never read cookies, headers, or session state; any such read must fail the build rather than silently produce a per-user cached entry.
- Serverless in-memory cache entries do not persist across instances or deployments; cross-instance durability must continue to come from Redis, and the specification must state which layer owns which responsibility.
- Redis being unavailable must not turn cached routes into errors; the database path remains the correctness floor.
- Revalidating a tag for a soft-deleted product must remove it from listings rather than serve a tombstone page.
- Currency selection is a client-side display concern; cached price markup must remain currency-agnostic or the currency must be part of the cache key.
- Draft, soft-deleted, and out-of-stock products must not become reachable through a stale cached listing after their state changes.
- Concurrent revalidations of the same tag must not produce a cache stampede against the database.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The application MUST enable `cacheComponents` in `next.config.ts` and build successfully with it enabled.
- **FR-002**: Public catalog reads (home, shop listing, product detail, category lists, bestsellers) MUST be served from `"use cache"` scopes rather than segment-level `revalidate`.
- **FR-003**: Every cached scope MUST declare an explicit `cacheLife` profile; implicit or default-only lifetimes are prohibited.
- **FR-004**: Every cached catalog scope MUST declare `cacheTag` values keyed by entity identity (product, category, listing) so writes can revalidate precisely.
- **FR-005**: Product, variant, category, and coupon mutations MUST revalidate the corresponding tags in the same code path that already performs Redis invalidation.
- **FR-006**: Order creation and stock mutation side effects MUST revalidate the product and listing tags they affect.
- **FR-007**: All 60 existing `force-dynamic` declarations MUST be classified as per-request, cacheable, or cacheable-with-holes, and the classification MUST be recorded in the feature plan.
- **FR-008**: Routes classified as per-request (cart, checkout, orders, account, auth, all `/admin` and `/api/admin` surfaces) MUST NOT place session-derived data inside a cached scope.
- **FR-009**: Uncached reads inside otherwise-cached pages MUST be wrapped in `Suspense` boundaries with skeleton fallbacks consistent with the existing components in `src/components/skeletons/`.
- **FR-010**: Redis caching via `getCachedData` MUST be retained for cross-request and cross-instance data; the specification MUST document that `"use cache"` does not replace it in a serverless deployment.
- **FR-011**: Product detail routes MUST implement `generateStaticParams` for a bounded, documented set of products, with on-demand generation for the remainder.
- **FR-012**: Failures in tag revalidation MUST be logged through `logError` with operation context and MUST NOT fail the originating write request.
- **FR-013**: Cached responses MUST NOT vary by user, and no `Set-Cookie` or session-derived header may be emitted from a cached scope.
- **FR-014**: The migration MUST be delivered as a self-contained, revertable change set so the rendering model can be rolled back in a single commit.
- **FR-015**: `docs/architecture.md` and `docs/development.md` MUST describe the resulting caching model, including the division of responsibility between Cache Components and Redis.

### Key Entities

- **Cache Scope**: A function, component, or route segment marked `"use cache"`, identified by its arguments and closed-over dependencies.
- **Cache Tag**: A stable identity string associated with a cache scope, used to invalidate on write (for example a product identifier or a catalog listing key).
- **Cache Life Profile**: The named freshness bound applied to a cache scope, expressing how stale a response may be in the absence of tag revalidation.
- **Route Classification**: The recorded decision for each current `force-dynamic` route: per-request, cacheable, or cacheable-with-holes.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: `npm run lint`, `npx tsc --noEmit -p tsconfig.check.json`, `npm test`, and `npm run build` all pass with `cacheComponents` enabled.
- **SC-002**: The initial HTML for `/`, `/shop`, and a product detail route contains catalog content with JavaScript disabled.
- **SC-003**: Largest Contentful Paint for `/`, `/shop`, and a product detail route is measured before and after, and does not regress on any of the three.
- **SC-004**: An admin product edit is visible on the corresponding storefront page on the first request after the write, with no manual cache clear.
- **SC-005**: Two concurrent authenticated sessions receive only their own data on `/cart`, `/orders`, `/account`, and `/admin`.
- **SC-006**: The count of `force-dynamic` declarations in `src/app` decreases, and every remaining declaration has a recorded justification.
- **SC-007**: With Redis unavailable, all cached public routes still render from the database without error.
- **SC-008**: The full Playwright suite passes against a production build with the new rendering model.

## Out of Scope

- Migrating authenticated cart, checkout, order, or admin data reads into cached scopes.
- Replacing Upstash Redis or Upstash Search.
- Changing the Inngest checkout pipeline's behavior beyond adding tag revalidation to existing side effects.

## Dependencies

- Would benefit from an end-to-end suite that runs in CI so the rendering change is validated at the browser level. The specification that owned that work (`013-e2e-in-continuous-integration`) was withdrawn on 2026-08-07, so no such dependency is currently tracked.
- Benefits from `015-build-and-dx-modernization` for build-time feedback but does not require it.
