---
description: 'Task list for the shipped wishlist feature'
---

# Tasks: Wishlist

**Input**: Design documents from `/specs/010-wishlist/`  
**Prerequisites**: `plan.md`, `spec.md`

**Tests**: Include route, Redux, component, and data-access tests because the shipped implementation has automated coverage for these areas.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish data and state foundations used by all wishlist stories.

- [ ] T001 Add `Wishlist` table, unique `(userId, productId)` constraint, indexes, and user/product relations in `src/lib/schema.ts`.
- [ ] T002 Add `db.wishlists.getProductIds`, `getProducts`, `add`, `remove`, and `has` helpers in `src/lib/db-queries.ts`.
- [ ] T003 Mount `wishlistReducer` in the storefront Redux store in `src/lib/store.ts`.
- [ ] T004 [P] Add DB helper tests for ids, products, deleted-product filtering, idempotent add, remove, and membership checks in `__tests__/lib/db-queries.test.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: API and client state contracts that MUST be complete before user-facing flows.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T005 Create authenticated `GET` and `POST` handlers in `src/app/api/wishlist/route.ts` using `auth()`, `apiSuccess`, `apiError`, `handleApiError`, and Zod validation for `productId`.
- [ ] T006 Create authenticated `DELETE` handler in `src/app/api/wishlist/[productId]/route.ts` with route param validation and shared error handling.
- [ ] T007 Implement `fetchWishlist`, `addToWishlist`, `removeFromWishlist`, and `optimisticToggle` in `src/features/wishlist/store/wishlistSlice.ts`.
- [ ] T008 [P] Add route tests for unauthenticated, validation, success, and error paths in `__tests__/app/api/wishlist/route.test.ts`.
- [ ] T009 [P] Add route tests for unauthenticated, success, and error paths in `__tests__/app/api/wishlist/[productId]/route.test.ts`.
- [ ] T010 [P] Add wishlist reducer/thunk tests in `__tests__/lib/features/wishlist/wishlistSlice.test.ts`.

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel.

---

## Phase 3: User Story 1 - Save and Unsave Products (Priority: P1) 🎯 MVP

**Goal**: Authenticated users can toggle wishlist state from product cards and mobile product detail actions.

**Independent Test**: Sign in, click a product heart, confirm selected state and add API call; click again and confirm unselected state and remove API call.

### Tests for User Story 1

- [ ] T011 [P] [US1] Add `WishlistButton` tests for accessible labels, `aria-pressed`, authenticated fetch, guest no-op, add toggle, remove toggle, custom class, and SVG rendering in `__tests__/features/wishlist/components/WishlistButton.test.tsx`.
- [ ] T012 [P] [US1] Ensure product detail sticky action bar tests account for the wishlist control in `__tests__/app/products/[id]/StickyMobileActionBar.test.tsx`.

### Implementation for User Story 1

- [ ] T013 [US1] Implement reusable heart control in `src/features/wishlist/components/WishlistButton.tsx` with session detection, Redux selectors, optimistic toggle, and add/remove thunk dispatches.
- [ ] T014 [US1] Add `WishlistButton` to product card image areas in `src/features/product/components/ProductGrid.tsx`.
- [ ] T015 [US1] Add `WishlistButton` to the mobile product detail sticky action bar in `src/app/[locale]/(public)/products/[id]/components/StickyMobileActionBar.tsx`.

**Checkpoint**: User Story 1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - View and Manage Saved Items (Priority: P2)

**Goal**: Authenticated users can view saved products on `/wishlist`, navigate to products, remove items, and see empty/loading/error states.

**Independent Test**: Sign in with saved products, open `/wishlist`, verify cards and formatted prices, remove an item, and confirm it disappears.

### Tests for User Story 2

- [ ] T016 [P] [US2] Add loading page coverage for `src/app/[locale]/(public)/wishlist/loading.tsx` in `__tests__/app/loading-pages.test.tsx`.
- [ ] T017 [P] [US2] Add wishlist page interaction coverage for authenticated products, empty state, auth-required state, and removal behavior in `__tests__/app/wishlist/page.test.tsx`.

### Implementation for User Story 2

- [ ] T018 [US2] Implement wishlist page UI in `src/app/[locale]/(public)/wishlist/page.tsx` with `fetchWishlist`, product grid, `EmptyState`, `AuthRequiredState`, `AlertBanner`, `LoadingSpinner`, `Footer`, and remove action.
- [ ] T019 [US2] Implement loading skeleton route in `src/app/[locale]/(public)/wishlist/loading.tsx`.
- [ ] T020 [US2] Implement page-level error recovery UI in `src/app/[locale]/(public)/wishlist/error.tsx`.

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Account Persistence and Access Control (Priority: P3)

**Goal**: Wishlist data is authenticated-account scoped, persists across sessions/devices, and exposes navigation only through signed-in account UI.

**Independent Test**: Save a product as user A, fetch it in another authenticated session for user A, verify unauthenticated API calls fail with 401, and verify the user menu links to localized `/wishlist`.

### Tests for User Story 3

- [ ] T021 [P] [US3] Extend header/user-menu tests to assert the localized wishlist link exists in `__tests__/components/layout/Header.test.tsx`.
- [ ] T022 [P] [US3] Verify unauthenticated API behavior remains covered in `__tests__/app/api/wishlist/route.test.ts` and `__tests__/app/api/wishlist/[productId]/route.test.ts`.

### Implementation for User Story 3

- [ ] T023 [US3] Add signed-in user menu navigation to localized `/wishlist` in `src/components/layout/header/UserMenu.tsx`.
- [ ] T024 [US3] Ensure `GET /api/wishlist` scopes product results to `session.user.id` in `src/app/api/wishlist/route.ts`.
- [ ] T025 [US3] Ensure add/remove DB helpers use `userId` and `productId` together for writes in `src/lib/db-queries.ts`.

**Checkpoint**: All user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements and validation that affect multiple user stories.

- [ ] T026 [P] Confirm wishlist controls meet accessibility expectations (`aria-label`, `aria-pressed`, decorative SVG `aria-hidden`) in `src/features/wishlist/components/WishlistButton.tsx`.
- [ ] T027 [P] Confirm API error logging contexts (`wishlist_get`, `wishlist_add`, `wishlist_remove`) are present in wishlist route handlers.
- [ ] T028 Run `npm run lint` and fix any wishlist-related lint issues.
- [ ] T029 Run `npx tsc --noEmit` and fix any wishlist-related type issues.
- [ ] T030 Run `npm test` and fix any wishlist-related test failures.
- [ ] T031 Run `npm run build` and fix any wishlist-related build failures.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories.
- **User Stories (Phase 3+)**: All depend on Foundational phase completion.
  - User stories can then proceed in priority order (P1 → P2 → P3) or in parallel if staffed.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - no dependency on other stories.
- **User Story 2 (P2)**: Can start after Foundational - uses the same API/state foundation as US1 but can be tested independently through `/wishlist`.
- **User Story 3 (P3)**: Can start after Foundational - validates account scoping and navigation around the core feature.

### Within Each User Story

- Tests should be written before or alongside implementation and fail before the relevant behavior exists.
- Schema before DB helpers.
- DB helpers before API handlers.
- API handlers before Redux thunks.
- Redux state before interactive UI.
- Core implementation before navigation polish.

### Parallel Opportunities

- T004, T008, T009, T010 can be written in parallel after their target contracts are known.
- T011 and T012 touch different test files and can run in parallel.
- T016 and T017 touch different page test areas and can run in parallel.
- T021 and T022 are independent account/access tests.
- T026 and T027 are independent review tasks.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational API/state contracts.
3. Complete Phase 3: User Story 1 toggle controls.
4. **STOP and VALIDATE**: Test product-card and mobile PDP add/remove flows independently.

### Incremental Delivery

1. Setup + Foundational → authenticated persistence and Redux contracts ready.
2. Add User Story 1 → product-surface save/unsave MVP.
3. Add User Story 2 → full wishlist destination and management UI.
4. Add User Story 3 → account navigation and access-control validation.
5. Finish with lint, typecheck, tests, and build validation.

### Parallel Team Strategy

With multiple developers:

1. Team completes schema, DB helpers, API routes, and Redux slice together.
2. Developer A implements product-surface `WishlistButton` integration.
3. Developer B implements `/wishlist` page states and removal UI.
4. Developer C completes account navigation, route/security tests, and validation.

---

## Notes

- [P] tasks = different files, no direct dependency conflicts.
- [Story] labels map tasks to specific user stories for traceability.
- This task list reflects the shipped implementation and intentionally excludes unimplemented ideas such as guest-local wishlists or login modals on heart click.
- The broader `specs/005-enhanced-account-personalization` spec mentions wishlist persistence; this task list scopes only the concrete wishlist feature.
