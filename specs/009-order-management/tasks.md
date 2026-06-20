# Tasks: Order Management

**Input**: Design documents from `/specs/009-order-management/`  
**Prerequisites**: `spec.md`, `plan.md`

**Tests**: Include tests for route handlers, services, Redux state, and customer UI because this feature is checkout- and account-critical.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each customer-visible slice.

## Phase 1: Foundation (Schema, Types, and Queue Contracts)

**Purpose**: Establish the shared order entities and durable checkout contract that all user stories depend on.

- [ ] T001 Define `OrderStatus` and `CheckoutRequestStatus` enums plus `CheckoutRequest`, `Order`, and `OrderItem` tables/relations in `src/lib/schema.ts`.
- [ ] T002 Add generated short ID helpers for checkout and `ORD`-prefixed order IDs in `src/lib/short-id.ts`.
- [ ] T003 [P] Add order, order item, checkout response, and status TypeScript contracts in `src/lib/types.ts`.
- [ ] T004 [P] Add Zod validation for structured addresses, checkout items, checkout queue messages, and order status updates in `src/features/cart/validations.ts` and `src/features/orders/validations.ts`.
- [ ] T005 Add queue callback plumbing for checkout order processing in `src/app/api/queue/checkout-orders/route.ts`.

**Checkpoint**: Database schema, IDs, validation, and queue contract are ready for order placement.

---

## Phase 2: User Story 1 - Place an authenticated order (Priority: P1) 🎯 MVP

**Goal**: A signed-in shopper can submit checkout, receive a checkout request, and end with a created pending order.

**Independent Test**: Submit valid checkout from the review page, poll the checkout request to completion, and verify the order is created exactly once.

### Tests for User Story 1

- [ ] T006 [P] [US1] Add route tests for unauthenticated, invalid, queued, and failed checkout requests in `__tests__/app/api/checkout/route.test.ts`.
- [ ] T007 [P] [US1] Add checkout status ownership and status response tests in `__tests__/app/api/checkout/[id]/route.test.ts`.
- [ ] T008 [P] [US1] Add service tests for checkout idempotency, queue retry exhaustion recovery, product/variant validation, and stock failure paths in `__tests__/features/cart/services/checkout-service.test.ts`.
- [ ] T009 [P] [US1] Add order creation service tests for transaction persistence, captured item prices, customization notes, stock decrement, and cache invalidation in `__tests__/features/orders/services/order-service.test.ts`.

### Implementation for User Story 1

- [ ] T010 [US1] Implement authenticated checkout enqueueing in `src/app/api/checkout/route.ts` and `src/app/api/orders/route.ts` compatibility path.
- [ ] T011 [US1] Implement `enqueueCheckoutForUser`, `processCheckoutRequestById`, `getCheckoutRequestStatusForUser`, and retry recovery in `src/features/cart/services/checkout-service.ts`.
- [ ] T012 [US1] Implement primary-database order creation, stock validation/decrement, and `checkoutRequestId` idempotency in `src/features/orders/services/order-service.ts`.
- [ ] T013 [US1] Implement checkout review submission, polling, cart clearing, toast feedback, retry state, and confirmation redirect in `src/app/[locale]/(public)/checkout/review/page.tsx`.
- [ ] T014 [US1] Queue `order.created` email events and direct fallback confirmation emails through `src/app/api/services/email/route.ts` and `src/lib/email/index.ts`.

**Checkpoint**: User Story 1 creates pending orders reliably and is testable without order history/detail UI.

---

## Phase 3: User Story 2 - View and search order history (Priority: P2)

**Goal**: A signed-in customer can browse, search, and paginate only their own orders.

**Independent Test**: Visit `/orders` as an authenticated customer, search by ID/status/product, paginate results, and verify cross-user orders are absent.

### Tests for User Story 2

- [ ] T015 [P] [US2] Add `/api/orders` list tests for auth, pagination, search, empty results, and total count in `__tests__/app/api/orders/route.test.ts`.
- [ ] T016 [P] [US2] Add Redis Search and database fallback tests for `searchOrderIds` in `__tests__/features/orders/services/order-search.test.ts`.
- [ ] T017 [P] [US2] Add order list UI tests for empty state, search form, loading/error states, and rendered card metadata in `__tests__/app/orders/OrdersClient.test.tsx` and `__tests__/features/orders/components/OrderListCard.test.tsx`.

### Implementation for User Story 2

- [ ] T018 [US2] Implement authenticated order list retrieval with cursor/offset pagination and cached totals in `src/features/orders/services/order-service.ts`.
- [ ] T019 [US2] Implement Redis order hash/set writes and Redis Search index schema/backfill in `src/features/orders/actions/orders.ts` and `src/features/orders/services/orders-search-index.ts`.
- [ ] T020 [US2] Implement database search fallback by customer/order/product/status fields in `src/features/orders/services/order-search.ts`.
- [ ] T021 [US2] Implement authenticated `/orders` server gate and client list/search/pagination UI in `src/app/[locale]/(public)/orders/page.tsx` and `OrdersClient.tsx`.
- [ ] T022 [US2] Implement accessible order cards and search form in `src/features/orders/components/OrderListCard.tsx` and `OrdersSearchForm.tsx`.

**Checkpoint**: User Stories 1 and 2 provide a complete place-order plus order-history loop.

---

## Phase 4: User Story 3 - Inspect order detail and status lifecycle (Priority: P3)

**Goal**: Customers can inspect a single owned order, see lifecycle/tracking details, and cancel only pending orders.

**Independent Test**: Open an owned order detail page, cancel a pending order, and verify non-owned/non-pending paths fail safely.

### Tests for User Story 3

- [ ] T023 [P] [US3] Add `/api/orders/[id]` tests for auth, ownership, serialization, pending cancellation, and non-pending cancellation rejection in `__tests__/app/api/orders/[id]/route.test.ts`.
- [ ] T024 [P] [US3] Add Redux thunk/slice tests for fetch detail and cancellation state in `__tests__/features/orders/store/ordersSlice.test.ts`.
- [ ] T025 [P] [US3] Add order detail UI tests for timeline, cancellation dialog, tracking section, variants, customizations, and shipping address in `__tests__/app/orders/[id]/page.test.tsx`.
- [ ] T026 [P] [US3] Add admin status update email/cache tests in `__tests__/app/api/admin/orders/[id]/route.test.ts`.

### Implementation for User Story 3

- [ ] T027 [US3] Implement owned order detail GET with cached DB fetch and serialization in `src/app/api/orders/[id]/route.ts`.
- [ ] T028 [US3] Implement customer pending-order cancellation, cache invalidation, and Redis status update in `src/app/api/orders/[id]/route.ts`.
- [ ] T029 [US3] Implement order detail Redux thunks/selectors and cancellation state in `src/features/orders/store/ordersSlice.ts`.
- [ ] T030 [US3] Implement order detail page timeline, item rows, cancellation dialog, tracking section, and shipping address in `src/app/[locale]/(public)/orders/[id]/page.tsx`.
- [ ] T031 [US3] Implement admin lifecycle status/tracking update emails, Redis update, and cache invalidation in `src/app/api/admin/orders/[id]/route.ts`.

**Checkpoint**: All three customer user stories are independently functional and integrated.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Reliability, observability, policy alignment, and final validation across all stories.

- [ ] T032 [P] Ensure `serializeOrder` includes ISO dates, product records, variants, and variant option values in `src/lib/serializers.ts`.
- [ ] T033 [P] Ensure order summary helpers handle missing product data, variant labels, item counts, and checkout pricing in `src/features/orders/services/order-summary.ts`.
- [ ] T034 [P] Ensure order confirmation/status templates support locale labels, tracking details, escaped HTML, and text fallbacks in `src/lib/email/templates.ts`.
- [ ] T035 [P] Confirm policy acknowledgment remains covered by `specs/003-order-policy-dialog` and that order management only references, not duplicates, that policy scope.
- [ ] T036 Run `npm run lint`, `npx tsc --noEmit`, `npm test`, and `npm run build` before PR updates that touch implementation files.
- [ ] T037 Run Playwright checkout/order-history/order-detail smoke coverage if customer UI changes are made.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundation (Phase 1)**: No dependencies; blocks all user stories.
- **User Story 1 (Phase 2)**: Depends on Foundation; required before history/detail have useful data.
- **User Story 2 (Phase 3)**: Depends on Foundation and benefits from User Story 1-created orders; can use seeded data for independent testing.
- **User Story 3 (Phase 4)**: Depends on Foundation and existing orders; can be tested with seeded orders independently of checkout UI.
- **Polish (Phase 5)**: Depends on selected user stories being complete.

### User Story Dependencies

- **US1**: Must start after Foundation; no dependency on US2 or US3.
- **US2**: Must start after Foundation; can be developed against seeded `Order`/`OrderItem` data.
- **US3**: Must start after Foundation; can be developed against seeded pending/non-pending orders.

### Parallel Opportunities

- T003, T004 can run in parallel after schema direction is known.
- Tests within each user story marked [P] can run in parallel before implementation.
- Redis search/index work (T019-T020) can run in parallel with list UI work (T021-T022) after API response shape is stable.
- Detail UI (T030), Redux state (T029), and admin lifecycle emails (T031) can run in parallel after `/api/orders/[id]` contracts are stable.
