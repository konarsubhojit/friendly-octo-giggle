# Tasks: Shopping Cart and Checkout

**Input**: Design documents from `/specs/007-shopping-cart-and-checkout/`  
**Prerequisites**: `spec.md`, `plan.md`

## Phase 1: Foundation (Schema, Contracts, Identity)

- [ ] T001 Define `carts`, `cartItems`, and `checkoutRequests` schema records with short IDs, uniqueness constraints, relations, indexes, and JSON checkout item snapshots in `src/lib/schema.ts`.
- [ ] T002 Add cart and checkout Zod contracts for add, update, checkout item, checkout submission, and queue message payloads in `src/features/cart/validations.ts`.
- [ ] T003 Implement signed guest cart session helpers for `cart_session` cookie creation and verification in `src/features/cart/services/cart-session.ts`.
- [ ] T004 Add cart cache key and invalidation support in `src/lib/cache.ts` and Redis client fallbacks in `src/lib/redis.ts`.

## Phase 2: Cart Persistence and API — P1

- [ ] T005 [US1] Implement cart lookup, serialization, Redis read/backfill, and database fallback in `src/features/cart/services/cart-service.ts`.
- [ ] T006 [US1] Implement add-or-update cart item behavior with product/variant existence checks, stock caps, duplicate-line merging, and stock warnings in `src/features/cart/services/cart-service.ts`.
- [ ] T007 [US1] Implement cart item quantity update and remove routes with owner checks and stock validation in `src/app/api/cart/items/[id]/route.ts`.
- [ ] T008 [US1] Implement cart GET, POST, and DELETE route handlers with auth/session identity, JSON validation, guest cookie cleanup, and cache invalidation in `src/app/api/cart/route.ts`.
- [ ] T009 [US1] Add Redux thunks/selectors for fetch, add, update, remove, clear, stale fetch suppression, and stock warning state in `src/features/cart/store/cartSlice.ts`.
- [ ] T010 [US1] Add route/service tests for add, update, remove, clear, stock limit, invalid input, and unauthorized cart item access in `__tests__/app/api/cart/` and `__tests__/features/cart/`.

## Phase 3: Guest Cart Continuity — P2

- [ ] T011 [US2] Implement browser pending cart utilities for unauthenticated add intent in `src/features/cart/services/pending-cart.ts`.
- [ ] T012 [US2] Wire product detail add-to-cart behavior so unauthenticated users store pending items and authenticated users call the cart thunk in `src/app/[locale]/(public)/products/[id]/ProductClient.tsx`.
- [ ] T013 [US2] Implement pending cart synchronization after authentication through `syncPendingCartItems` in `src/features/cart/store/cartSlice.ts`.
- [ ] T014 [US2] Implement server-side guest cart promotion/merge, stock recapping, guest cart deletion, cache cleanup, and session rotation in `src/features/cart/services/cart-service.ts`.
- [ ] T015 [US2] Add tests for local pending item validation, merge with same variant, merge stock cap, out-of-stock drop, and concurrent user-cart creation fallback.

## Phase 4: Cart UI and Pricing — P1

- [ ] T016 [US1] Build authenticated cart page loading/auth/empty states, grouped item rendering, error banners, and checkout navigation in `src/app/[locale]/(public)/cart/page.tsx`.
- [ ] T017 [US1] Build cart line components for product image, variant label, quantity select, remove action, customization note, and line totals in `src/features/cart/components/CartItemRow.tsx` and `CartProductGroup.tsx`.
- [ ] T018 [US1] Build shared checkout progress and pricing summary components in `src/features/cart/components/CheckoutProgress.tsx` and `CartPricingSummary.tsx`.
- [ ] T019 [US1] Use `useCurrency().formatPrice` and order-summary helpers so cart subtotal, free shipping, and total display in the selected currency.
- [ ] T020 [US1] Add component tests for cart rendering, quantity/remove interactions, grouped variants, empty state, and currency-formatted totals.

## Phase 5: Checkout Shipping and Review — P3

- [ ] T021 [US3] Build shipping page auth/empty states and order summary in `src/app/[locale]/(public)/checkout/shipping/page.tsx`.
- [ ] T022 [US3] Implement `CheckoutForm` with structured address validation, saved address loading/saving, pincode lookup, customization note carry-forward, and pending checkout sessionStorage in `src/features/cart/components/CheckoutForm.tsx`.
- [ ] T023 [US3] Build review page pending-checkout validation, policy acknowledgment, item summary, checkout submit, status polling, retry error display, cart clearing, and confirmation routing in `src/app/[locale]/(public)/checkout/review/page.tsx`.
- [ ] T024 [US3] Build confirmation page order lookup and fallback error display in `src/app/[locale]/(public)/checkout/confirmation/page.tsx`.
- [ ] T025 [US3] Add tests for shipping validation, missing pending checkout redirect, policy acknowledgment gating, checkout polling success, polling failure, and cart clear after completion.

## Phase 6: Checkout API and Queue Processing — P3

- [ ] T026 [US3] Implement `/api/checkout` authenticated POST route with request parsing, logging, and checkout enqueue response in `src/app/api/checkout/route.ts`.
- [ ] T027 [US3] Implement `/api/checkout/[id]` authenticated status route with ownership checks in `src/app/api/checkout/[id]/route.ts`.
- [ ] T028 [US3] Implement checkout request normalization, insertion, queue send with idempotency key, publish fallback, status polling, and admin listing helpers in `src/features/cart/services/checkout-service.ts`.
- [ ] T029 [US3] Implement queue consumer callback, max delivery attempt handling, and retry-exhaustion recovery in `src/app/api/queue/checkout-orders/route.ts`.
- [ ] T030 [US3] Integrate checkout processing with `createOrderForUser` and checkout request/order idempotency in `src/features/orders/services/order-service.ts`.
- [ ] T031 [US3] Add tests for unauthenticated checkout, invalid payloads, status ownership, queue processing completion, retryable failure, retry exhaustion, and existing-order idempotency.

## Phase 7: Final Validation

- [ ] T032 Run `npm run lint` and fix cart/checkout lint regressions.
- [ ] T033 Run `npx tsc --noEmit` and fix route/service/component type regressions.
- [ ] T034 Run `npm test` and verify cart, checkout, queue, and order tests pass.
- [ ] T035 Run `npm run build` to verify Next.js route handlers, dynamic routes, and client/server boundaries.
- [ ] T036 Run Playwright coverage for product add, cart update/remove, shipping, review, confirmation, and signed-out auth-required states.

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** has no dependencies and blocks all persistence, UI, and checkout work.
- **Phase 2** depends on Phase 1 and provides the API/store MVP for User Story 1.
- **Phase 3** depends on Phase 2 because guest sync and merge reuse add-to-cart and cart identity services.
- **Phase 4** depends on Phase 2 for API/store behavior and can proceed alongside Phase 3 after core thunks exist.
- **Phase 5** depends on Phase 4 for cart state and pricing summary components.
- **Phase 6** depends on Phase 1 and Phase 5 contracts, and must be complete before end-to-end checkout can pass.
- **Phase 7** depends on all desired implementation phases.

### User Story Dependencies

- **User Story 1 (P1)**: Requires schema/contracts and cart API/store/UI; independently testable through add/update/remove/clear.
- **User Story 2 (P2)**: Requires User Story 1 add/fetch behavior; independently testable through guest add then authenticated cart load.
- **User Story 3 (P3)**: Requires User Story 1 cart state; independently testable through shipping/review/queue/confirmation checkout hand-off.

### Parallel Opportunities

- T001-T004 can be split across schema, validation, cookie, and cache files.
- T007-T008 can proceed in parallel after service contracts are available.
- T016-T018 can proceed in parallel once store selectors and response shapes are stable.
- T026-T029 can proceed in parallel across route handlers, service orchestration, and queue callback after checkout schemas exist.
- Test tasks can be split by route/service/component ownership once each story checkpoint is ready.

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 foundation.
2. Complete Phase 2 cart persistence/API/store.
3. Complete Phase 4 cart UI and pricing.
4. Validate add, fetch, update, remove, clear, auth state, stock cap, and currency display before checkout work.

### Incremental Delivery

1. Deliver stock-aware authenticated cart MVP.
2. Add guest pending-cart and server guest-session merge continuity.
3. Add shipping/review UI and checkout API queue processing.
4. Complete confirmation and recovery paths.
5. Run full lint/type/test/build and Playwright validation.

### Notes

- [P] markers are omitted except where future task splitting needs explicit parallel execution; each listed task names the owning user story where applicable.
- Do not introduce a manual merge prompt unless behavior changes; the shipped code performs automatic merge/promotion.
- Keep checkout order creation idempotent through checkout request IDs and the order `checkoutRequestId` uniqueness constraint.
