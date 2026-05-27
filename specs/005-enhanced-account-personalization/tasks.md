# Tasks: Enhanced Account, Wishlist, and Personalization

**Input**: Design documents from `/specs/005-enhanced-account-personalization/`  
**Prerequisites**: `spec.md`, `plan.md`

## Phase 1: Foundation (Schema + Services)

- [ ] T001 Add/extend schema entities for notification subscriptions/events, currency preference, and cart merge decisions in `src/lib/schema.ts`.
- [ ] T002 Add query helpers for persisted wishlist sync and account dashboard aggregates in `src/lib/db-queries.ts`.
- [ ] T003 Add query/service support for notification subscriptions (back-in-stock, price-drop) and delivery status tracking.
- [ ] T004 Add idempotency/deduplication keys for notification events and retries.

## Phase 2: User Story 1 (Persistent Wishlist + Dashboard) — P1

- [ ] T005 [US1] Expand account data API in `src/app/api/account/` to include order history, wishlist summary, and address book payloads.
- [ ] T006 [US1] Update account UI in `src/app/account/` and related components to surface dashboard sections.
- [ ] T007 [US1] Ensure wishlist API/store flows remain synchronized across sessions/devices.
- [ ] T008 [US1] Add/extend tests for account API and wishlist sync behavior.

## Phase 3: User Story 2 (Personalized Homepage) — P2

- [ ] T009 [US2] Add personalization signal service using existing order/wishlist interaction data.
- [ ] T010 [US2] Add personalized homepage modules (recommendations, trends, quick reorder) with safe fallback rendering.
- [ ] T011 [US2] Add tests for logged-in personalization and anonymous/no-signal fallback paths.

## Phase 4: User Story 3 (Multi-Currency Preferences) — P3

- [ ] T012 [US3] Extend account preference APIs/UI to read/write preferred currency.
- [ ] T013 [US3] Ensure storefront/cart/checkout price rendering honors preferred currency with fallback behavior.
- [ ] T014 [US3] Add tests validating consistent currency rendering across core purchasing views.

## Phase 5: User Story 4 (Notifications) — P4

- [ ] T015 [US4] Add in-app notification APIs/UI surfaces for notification feed and read-state controls.
- [ ] T016 [US4] Add email + queue job handlers for order status, sale, back-in-stock, and price-drop events.
- [ ] T017 [US4] Add retry/error telemetry instrumentation and tests for failed delivery recovery.

## Phase 6: User Story 5 (Cart Merge + Stock UX) — P5

- [ ] T018 [US5] Add guest-to-user cart merge prompt UX and merge-resolution service logic.
- [ ] T019 [US5] Improve out-of-stock and backorder state presentation in product/cart flows.
- [ ] T020 [US5] Add tests for merge-choice persistence and backorder eligibility behavior.

## Phase 7: Final Validation

- [ ] T021 Run lint/typecheck/tests/build and verify no regressions.
- [ ] T022 Run accessibility checks on updated account/home/stock UI states.
- [ ] T023 Update docs where needed and close acceptance criteria mapping.
