---
description: 'Task list for adopting Next.js 16 Cache Components and Partial Prerendering'
---

# Tasks: Cache Components and Partial Prerendering

**Input**: Design documents from `/specs/012-cache-components-and-ppr/`  
**Prerequisites**: `plan.md` (required), `spec.md` (user stories)

**Tests**: Included. The migration touches shared error handling, cache invalidation, and every route's rendering class, all of which have existing Vitest coverage that must be extended rather than bypassed.

**Organization**: Tasks are grouped by user story so each story can be implemented, verified, and reviewed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Every task names the exact file it changes

## Phase 1: Setup (Shared Vocabulary)

**Purpose**: Establish the cache-life and cache-tag vocabulary before any scope uses it. Nothing here changes rendering behavior, so it can land ahead of the flag.

- [x] T001 Create `src/lib/cache-tags.ts` exporting `productTag(id)`, `productListTag()`, `bestsellersTag()`, `categoriesTag()`, plus a `revalidateCacheTags(tags, context)` helper that calls `revalidateTag(tag, profile)` from `next/cache` (second argument is required in 16.2), swallows nothing silently, and reports failures through `logError` with an operation context so a tag failure never fails the originating write (FR-004, FR-012).
- [x] T002 Add the `catalog`, `product`, and `taxonomy` `cacheLife` profiles to `next.config.ts` using the values in `plan.md` (`stale`/`revalidate`/`expire`), keeping `cacheComponents` **off** in this task.
- [x] T003 [P] Add `__tests__/lib/cache-tags.test.ts` covering tag-string shape, deduplication of repeated ids, and that a throwing `revalidateTag` is logged and does not propagate.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Make the application build with `cacheComponents` enabled. Verified against a real `next build` probe on 2026-08-01: without every task in this phase the build fails.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Call `unstable_rethrow(error)` from `next/navigation` as the first statement of `handleApiError` in `src/lib/api-utils.ts` so Next.js prerender bail-out signals propagate instead of being converted into JSON 500 responses (observed on `/api/products`, `/api/products/bestsellers`, `/api/search`, `/api/search/suggest`).
- [x] T005 In `src/lib/api-middleware.ts`, stop recording Next.js control-flow errors as `statusCode: 500` in `withLogging` and `withApiLogging`; rethrow them without emitting a request log line.
- [x] T006 [P] Add a `Suspense` boundary above `AppProviders` in `src/app/layout.tsx` so `makeStore()`'s `Math.random()` usage in `src/lib/store.ts` no longer aborts the prerender of otherwise-static pages.
- [x] T007 Remove all 60 `export const dynamic = 'force-dynamic'` declarations listed in the Class A and Class B tables of `plan.md` (47 route handlers under `src/app/api/`, 13 pages under `src/app/(public)/` and `src/app/admin/`).
- [x] T008 Remove all 11 `export const revalidate` declarations: the 8 marketing pages under `src/app/(public)/`, plus `src/app/(public)/shop/page.tsx`, `src/app/(public)/products/[id]/page.tsx`, and `src/app/api/categories/route.ts`.
- [x] T009 Remove `export const runtime = 'nodejs'` from `src/app/api/upload/route.ts` and confirm the Node-only Azure Blob path in `src/lib/image-storage.ts` still works under the default runtime; record the verification in the PR description.
- [x] T010 Add an explicit permission check plus `await connection()` to `src/app/admin/page.tsx`, which is the only admin page without a page-level auth call and therefore the only one Next.js attempts to prerender.
- [x] T011 Set `cacheComponents: true` in `next.config.ts`.
- [x] T012 Run `npm run build` and confirm it completes with the Cache Components banner and no prerender errors; capture the route table (`○` / `◐` / `ƒ`) as the migration baseline.
- [x] T013 [P] Extend `__tests__/lib/api-utils.test.ts` to assert that a Next.js control-flow error is rethrown by `handleApiError` while an ordinary `Error` still yields an API error response.
- [x] T014 [P] Extend `__tests__/lib/api-middleware.test.ts` to assert that control-flow errors are rethrown without a 500 request log.

**Checkpoint**: `npm run build` passes with Cache Components enabled and no route's data-fetching behavior has changed yet.

---

## Phase 3: User Story 1 - Instant storefront shell for catalog browsing (Priority: P1) 🎯 MVP

**Goal**: `/shop` and `/products/[id]` serve catalog content from a prerendered shell; only genuinely per-request regions stream.

**Independent Test**: Build, then request `/shop` and a product detail route with JavaScript disabled and confirm product cards, category chips, name, price, media, and variant options are present in the initial HTML while session-dependent regions render their fallbacks.

### Tests for User Story 1

- [x] T015 [P] [US1] Add a no-JavaScript assertion to `playwright-tests/public-pages.spec.ts` that `/shop` initial HTML contains product cards and category chips.
- [x] T016 [P] [US1] Add a no-JavaScript assertion to `playwright-tests/product-navigation.spec.ts` that a product detail route's initial HTML contains name, description, price, and variant options.

### Implementation for User Story 1

- [x] T017 [US1] Extract the bestsellers read in `src/app/(public)/shop/page.tsx` into a `"use cache"` function that declares `cacheLife('catalog')` and `cacheTag(bestsellersTag(), productListTag())`, reading the database through `db.products.findBestsellers()` rather than `cacheProductsBestsellers` (no Redis inside a cached scope — `plan.md` R8).
- [x] T018 [US1] Extract the category-chip read in `src/app/(public)/shop/page.tsx` into a `"use cache"` function with `cacheLife('taxonomy')` and `cacheTag(categoriesTag())`.
- [x] T019 [US1] Keep the `searchParams`-driven catalog search in `src/app/(public)/shop/page.tsx` inside the existing `Suspense` boundary and confirm `ShopCatalogFallback` still renders `BestsellerCardSkeleton`/`ProductCardSkeleton` for the streamed region (FR-009).
- [x] T020 [US1] Convert `getProduct` in `src/app/(public)/products/[id]/page.tsx` to a `"use cache"` function with `cacheLife('product')` and `cacheTag(productTag(id))`, calling `db.products.findById(id, false)` so the Redis wrapper is bypassed inside the cached scope.
- [x] T021 [US1] Move the per-request parts of `src/app/(public)/products/[id]/page.tsx` (the `isAiEnabled()` Edge Config read and the `searchParams` variant selection) out of the cached scope and behind a `Suspense` boundary with a skeleton from `src/components/skeletons/`.
- [x] T022 [US1] Convert `GET` in `src/app/api/categories/route.ts` to a `"use cache"` handler with `cacheLife('taxonomy')` and `cacheTag(categoriesTag())`, retaining the existing `Cache-Control` header.
- [x] T023 [US1] Audit every new cached scope for session, cookie, header, or currency-dependent reads and confirm none are present (FR-013); currency conversion must remain a client-side concern in `CurrencyContext`.

**Checkpoint**: catalog markup is in the initial HTML; `npm run build` still passes.

---

## Phase 4: User Story 2 - Writes make cached content stale immediately (Priority: P1)

**Goal**: An admin write is visible on the storefront on the first request after the write, with no wait and no manual cache clear.

**Independent Test**: Edit a product in the admin UI, reload its storefront page, and confirm the change is visible on the first request.

### Tests for User Story 2

- [x] T024 [P] [US2] Extend `__tests__/lib/cache.test.ts` to assert that `invalidateProductCaches` revalidates `productTag(id)` and `productListTag()` in addition to the Redis patterns.
- [x] T025 [P] [US2] Add `__tests__/features/orders/services/order-cache.test.ts` asserting that `invalidateOrderCaches` revalidates `productTag(...)` per affected product plus `bestsellersTag()`.
- [x] T026 [P] [US2] Extend the tests under `__tests__/app/api/admin/categories/` to assert `categoriesTag()` revalidation on create, update, delete, and reorder.

### Implementation for User Story 2

- [x] T027 [US2] Call `revalidateCacheTags` from `invalidateProductCaches` in `src/lib/cache.ts` so all 12 existing call sites (`src/app/api/admin/products/**`, `src/app/api/admin/variants/**`, `src/app/api/admin/import/products/route.ts`, `src/lib/db-queries.ts`) inherit tag revalidation without duplicated code (FR-005, Principle VIII).
- [x] T028 [US2] Add `categoriesTag()` revalidation to the category mutation handlers under `src/app/api/admin/categories/` (`route.ts`, `[id]/route.ts`, `reorder/route.ts`).
- [x] T029 [US2] Add product and bestsellers tag revalidation to `invalidateOrderCaches` in `src/features/orders/services/order-cache.ts`, which the durable `invalidateOrderCachesFunction` in `src/features/orders/inngest/side-effects.ts` already invokes with `productIds` (FR-006).
- [x] T030 [US2] Confirm soft deletes revalidate listing tags so a deleted product disappears from `/shop` on the next request rather than surviving in a stale listing (spec Edge Cases).
- [x] T031 [US2] Verify a failing `revalidateTag` is logged with operation context and does not fail the originating write, and that the `cacheLife` bound still guarantees eventual freshness (FR-012).

**Checkpoint**: writes propagate on the first subsequent request; User Stories 1 and 2 both hold.

---

## Phase 5: User Story 3 - Correct classification of per-request routes (Priority: P1)

**Goal**: Cart, checkout, orders, account, and every `/admin` surface render per-request data with no cross-user contamination.

**Independent Test**: With two concurrent authenticated sessions, load `/cart`, `/orders`, `/account`, and `/admin` in each and confirm neither receives the other's data.

### Tests for User Story 3

- [x] T032 [P] [US3] Add a two-session isolation spec to `playwright-tests/` that signs in as two users and asserts `/cart`, `/orders`, `/account`, and `/admin` return only the requesting user's data (SC-005).
- [x] T033 [P] [US3] Extend `playwright-tests/admin-views.spec.ts` to assert an unauthorized role is still rejected by the `src/proxy.ts` admin gate and that no cached admin content is served (FR-008 acceptance 4).

### Implementation for User Story 3

- [x] T034 [US3] Walk the Class A and Class B tables in `plan.md` against the post-migration build output and confirm every listed route reports `ƒ` or a `◐` whose dynamic hole contains all session-derived data; correct any mismatch at the source.
- [x] T035 [US3] Confirm no cached scope emits `Set-Cookie` or a session-derived header, and that `auth()` is never called inside a `"use cache"` boundary (FR-008, FR-013).
- [x] T036 [US3] Record the final classification decision for every remaining dynamic surface in `plan.md` so each has a written justification (FR-007, SC-006).

**Checkpoint**: all three P1 stories are independently verifiable.

---

## Phase 6: User Story 4 - Prebuilt detail pages for popular products (Priority: P2)

**Goal**: The most-requested product detail pages exist at build time; the rest are generated on demand and retained.

**Independent Test**: Inspect the build output for prerendered `/products/[id]` entries, then request a product outside that set and confirm it renders and is retained.

- [x] T037 [US4] Add `generateStaticParams` to `src/app/(public)/products/[id]/page.tsx` returning a bounded, documented set of product ids (bestsellers first), reusing the existing `db.products` helpers (FR-011).
- [x] T038 [US4] Wrap the static-params query so an unreachable database at build time degrades to an empty list, logging through `logError`, instead of failing the build (spec US4 acceptance 3).
- [x] T039 [US4] Confirm the build output lists the intended prerendered product routes and that a non-prebuilt product still renders on first request.

**Checkpoint**: all four user stories are complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T040 [P] Update `docs/architecture.md` sections 1, 7, and the ISR-first summary to describe the Cache Components model and the Cache Components / Redis / database division of responsibility (FR-010, FR-015).
- [x] T041 [P] Update `docs/development.md` guidance that currently recommends `revalidate = 60` for public pages so it teaches `"use cache"` + `cacheLife` + `cacheTag` instead (FR-015).
- [x] T042 [P] Clear the follow-up TODO in `.specify/memory/constitution.md` once this feature lands, and confirm the implementation matches amended Principle IV (no segment configs, `"use cache"` scopes carry `cacheLife` + `cacheTag`, no Redis read nested inside a cached scope, writes invalidate both layers) and amended Principle VI (`unstable_rethrow` before logging or response conversion).
- [x] T043 Measure Largest Contentful Paint for `/shop` and a product detail route before and after, and record both numbers; a regression on either blocks the change (SC-003). Measured with headless Chrome over the DevTools Protocol against `next start` for both trees; no route regresses. Numbers in `plan.md` → Release validation → T043.
- [x] T044 Verify all cached public routes still render from the database with Redis credentials removed (SC-007). Verified against a production build with the Upstash Redis variables stripped from the server process; results in `plan.md` → Release validation → T044.
- [ ] T045 Run the full Playwright suite against a production build and record the result (SC-008). **Deferred** — the suite is not runnable yet (`playwright.config.ts` probes the removed `/en/shop` URL and `global-setup.ts` needs seeded credentials); see `plan.md` → Release validation → T045. Repairing the suite was owned by `013-e2e-in-continuous-integration`, withdrawn on 2026-08-07, so this task is now unowned.
- [x] T046 Confirm the whole change set is a single revertable commit (FR-014) — a partial revert cannot build, because Next.js rejects `cacheComponents` combined with any segment config. Confirmed: the set reverse-applies cleanly, the reverted tree builds, and reverting only the config flag fails compilation; evidence in `plan.md` → Release validation → T046.
- [x] T047 Run `npm run lint`, `npx tsc --noEmit -p tsconfig.check.json`, `npm test`, and `npm run build` and fix every failure (SC-001). All four pass; recorded in `plan.md` → Release validation → T047.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies; can start immediately.
- **Foundational (Phase 2)**: depends on Phase 1 for the `cacheLife` profiles; BLOCKS every user story. T007, T008, T009, T010, and T011 must land together — the build fails with the flag on and any segment config present, and fails differently with the flag off and cached scopes present.
- **User Story 1 (Phase 3)**: depends on Phase 2.
- **User Story 2 (Phase 4)**: depends on Phase 3 — there is nothing to invalidate until cached scopes exist.
- **User Story 3 (Phase 5)**: depends on Phase 2; can run in parallel with Phase 3 and Phase 4.
- **User Story 4 (Phase 6)**: depends on Phase 3.
- **Polish (Phase 7)**: depends on all desired stories.

### Within Each User Story

- Vocabulary before scopes; scopes before invalidation; invalidation before prebuilding.
- Playwright assertions are written before the behavior they assert and must fail first.
- The build gate (T012) is re-run after each phase, not only at the end.

### Parallel Opportunities

- T003 runs alongside T001/T002.
- T006, T013, and T014 touch different files from T007/T008 and can proceed in parallel.
- T015 and T016 are independent spec files.
- T024, T025, and T026 are independent test files.
- T032 and T033 are independent Playwright specs.
- T040, T041, and T042 are independent documentation files.

---

## Implementation Strategy

### MVP First (Foundational + User Story 1)

1. Complete Phase 1 and Phase 2 — the build passes with Cache Components enabled and no behavior change.
2. Complete Phase 3 — catalog content moves into the prerendered shell.
3. **STOP and VALIDATE**: request `/shop` and a product route with JavaScript disabled.

### Incremental Delivery

1. Phase 1 + Phase 2 → rendering model switched, behavior unchanged, fully revertable.
2. Phase 3 → static catalog shell (the visible win).
3. Phase 4 → aggressive caching becomes safe, because writes now invalidate precisely.
4. Phase 5 → per-request classification proven with two concurrent sessions.
5. Phase 6 → popular product pages prebuilt.
6. Phase 7 → documentation, measurements, and release gates.

### Parallel Team Strategy

1. One developer owns Phase 2 alone; it is a single atomic change set and does not split cleanly.
2. After the checkpoint: Developer A takes User Story 1 then User Story 4; Developer B takes User Story 2; Developer C takes User Story 3 and the Playwright work.

---

## Notes

- [P] tasks touch different files and have no ordering constraint between them.
- Constitution v2.0.0 amended Principle IV to mandate this rendering model and Principle VI to require `unstable_rethrow`; the constitution records the current codebase as a tracked deviation until this feature lands. That amendment is a prerequisite of this task list, not part of it.
- Findings R1–R8 in `plan.md` were produced by real `next build` probes against this working tree; the probes were reverted and no probe code is part of this feature.
- Out of scope, per `spec.md`: moving cart, checkout, order, or admin reads into cached scopes; replacing Upstash Redis or Upstash Search; changing Inngest checkout behavior beyond tag revalidation on existing side effects.
- `playwright.config.ts` still probes a `/en/shop` URL that no longer exists in the route tree; T045 depends on that repair, which was owned by `013-e2e-in-continuous-integration` until that specification was withdrawn on 2026-08-07.
