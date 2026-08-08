---
description: 'Task list for holding variant stock from checkout acceptance until the durable order pipeline commits or abandons it'
---

# Tasks: Inventory Reservation

**Input**: Design documents from `/specs/016-inventory-reservation/`  
**Prerequisites**: `plan.md` (required), `spec.md` (user stories)

**Tests**: Included and mandatory. The whole feature is a concurrency guarantee, so a test that cannot observe the losing writer proves nothing — the reservation suites drive the real conditional updates rather than mocking their outcome. `src/features/**/services/**` carries an 85% line/function coverage threshold (`vitest.config.mts`), which is the automatic gate for SC-007.

**Organization**: Tasks are grouped by user story. US1 (grant) and US2 (expiry) are both P1 and both required for a coherent MVP — a hold with no release converts overselling into under-selling — so US2 follows US1 immediately.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Every task names the exact file it changes

---

## Phase 1: Setup (Baseline)

**Purpose**: Record the "before" state so every later claim about correctness and latency is comparable.

- [ ] T001 Confirm the tree is green on all five gates (`npm run lint`, `npx tsc --noEmit -p tsconfig.check.json`, `npm test`, `npm run build`, `npm run docs:check`) so any later failure is attributable to this feature.
- [ ] T002 [P] Record the current checkout latency reference: capture the `checkout-latency-ms` and `stock-conflict` score behaviour described in `plan.md` R2, and note the pre-change p95 source in the PR description. The grant adds writes to this path and must be shown not to regress it (SC-008).
- [ ] T003 [P] Write a reproduction of the defect as a failing test in `__tests__/features/cart/services/checkout-service.reservation.test.ts`: two concurrent enqueues for a variant with `stock = 1` both succeed today. It must fail on `main` behaviour and pass after Phase 3 (US1 Independent Test).

**Checkpoint**: the defect is reproducible and the gates are green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, migration, and the single module that owns every reservation transition. Nothing in Phases 3–6 can start until this lands.

⚠️ **CRITICAL**: no user story work begins before this checkpoint.

- [ ] T004 Add `stockReservationStatusEnum` (`HELD`, `CONSUMED`, `RELEASED`, `EXPIRED`) and the `stockReservations` table to `src/lib/schema.ts` exactly as specified in the `plan.md` Data model section: `varchar(7)` id via `generateShortId()`, FKs to `CheckoutRequest` and `ProductVariant` with `ON DELETE CASCADE`, `quantity` with a positive check, `expiresAt`, `settledAt`, `UNIQUE (checkoutRequestId, variantId)`, and indexes on `(status, expiresAt)` and `(variantId, status)` (FR-015).
- [ ] T005 Add `reservedStock` (`integer NOT NULL DEFAULT 0`, non-negative check) to `productVariants` in `src/lib/schema.ts` (plan D1).
- [ ] T006 Add `stockReservationsRelations` and the `checkoutRequests` / `productVariants` back-relations in `src/lib/schema.ts`, following the existing relation blocks.
- [ ] T007 Generate the migration with `npm run db:generate`, review the emitted SQL in `drizzle/0015_stock_reservations.sql` by hand, and confirm it creates the enum, table, column, checks, and all three indexes with no destructive statement (FR-015).
- [ ] T008 Apply the migration with `npm run db:migrate` and confirm it applies cleanly to an empty database (constitution workflow gate 6).
- [ ] T009 Create `src/features/orders/services/stock-reservation.ts` with the module contract and no callers yet: `RESERVATION_TTL_MINUTES` (default 30, plan D5), `reserveForCheckoutRequest`, `consumeForCheckoutRequest`, `releaseForCheckoutRequest`, `expireDueReservations`, and `getReservationsForCheckoutRequests`. Every mutation is a conditional update returning claimed rows; `reservedStock` changes only here (plan D3).
- [ ] T010 [P] Implement the grant in `stock-reservation.ts`: one transaction, line items sorted by variant id (plan D2), per item `UPDATE "ProductVariant" SET "reservedStock" = "reservedStock" + q WHERE id = ? AND "deletedAt" IS NULL AND stock - "reservedStock" >= q RETURNING id`, insert the ledger row with `expiresAt = now() + interval`, and roll the whole transaction back on any zero-row result, returning the unavailable variant ids (FR-001, FR-002, FR-003, D6).
- [ ] T011 [P] Implement idempotent re-grant in `stock-reservation.ts`: on `UNIQUE (checkoutRequestId, variantId)` conflict, reuse the existing `HELD` row and hold no additional units (FR-009, US3 acceptance 1).
- [ ] T012 [P] Implement `releaseForCheckoutRequest` and `expireDueReservations` in `stock-reservation.ts` as claim-then-decrement pairs (`WHERE status = 'HELD' RETURNING …`), with `expireDueReservations` bounded by an explicit `limit` and comparing `expiresAt` to the database `now()` rather than a JavaScript date (FR-006, R6).
- [ ] T013 Implement `consumeForCheckoutRequest` in `stock-reservation.ts` taking a transaction handle (the `OrderTransaction` type already exported by `src/features/orders/services/order-restock.ts`) so it can run inside the order transaction (FR-008).
- [ ] T014 Add reservation counters to `src/lib/metrics.ts` — granted, denied, expired, consumed, released — with a `recordStockReservationMetric` writer, rendering in `renderPrometheusMetrics`, and a reset in `resetMetrics` (FR-014).
- [ ] T015 Write `__tests__/features/orders/services/stock-reservation.test.ts` covering: grant success, grant denial naming the item, all-or-nothing rollback on a multi-item request, idempotent re-grant, consume/release/expire each claiming once and being a no-op on replay, and the non-negative `reservedStock` clamp (SC-004, SC-007).

**Checkpoint**: the ledger, the counter, and every transition exist and are tested in isolation. User story work can begin.

---

## Phase 3: User Story 1 — The last unit is sold exactly once (Priority: P1) 🎯 MVP

**Goal**: Two concurrent checkouts for the last unit produce exactly one order, and the loser is told before any payment is captured.

**Independent Test**: Drive two concurrent checkout submissions for a variant with `stock = 1`; assert exactly one order, one rejection, and final `stock = 0`, `reservedStock = 0`.

### Implementation for User Story 1

- [ ] T016 [US1] Call `reserveForCheckoutRequest` from `enqueueCheckoutForUser` in `src/features/cart/services/checkout-service.ts`, after the `CheckoutRequest` row is created and before `dispatchCheckoutProcessing`, so a denial never reaches the queue (FR-001).
- [ ] T017 [US1] Convert a denial into a `CheckoutRequestError` with status 409 whose message names the unavailable items, mark the request `FAILED` with that reason, and return it through the existing `isCheckoutRequestError` branch of `src/app/api/checkout/route.ts` (FR-002, US1 acceptance 2).
- [ ] T018 [US1] Consume the reservations inside the order transaction in `src/lib/db-queries.ts` `db.orders.createWithItems`, in the same transaction as the existing `stock >= quantity` decrement, and decrement `reservedStock` by the consumed quantity so on-hand and held move together exactly once (FR-008, FR-010, US1 acceptance 4).
- [ ] T019 [US1] Make availability reservation-aware in `src/lib/db-queries.ts`: subtract `reservedStock` in `deriveMinimalProduct`, `findFirstForCart`, `findManyWithVariantsForOrderValidation`, and `findVariantStock`, so the cart cap and pre-checkout validation see available rather than on-hand units (FR-004, R8).
- [ ] T020 [US1] Verify `priceAndValidateStock` in `src/features/orders/services/create-order-service.ts` now compares against available stock, and keep its 409 as the belt-and-braces second line — the reservation is the authority, this remains the safety net (R2).
- [ ] T021 [US1] Add `logBusinessEvent` calls for grant and denial in `checkout-service.ts` and wire `recordStockReservationMetric` at both sites (FR-014, VI).
- [ ] T022 [US1] Make T003's reproduction pass and extend it: exactly one order, one 409, `stock = 0`, `reservedStock = 0`, and no captured payment on the denied path (SC-001, SC-002).
- [ ] T023 [US1] Add a regression test in `__tests__/lib/db-queries.test.ts` (or the nearest existing suite) asserting that a variant with `stock = 5, reservedStock = 2` reports availability 3 to cart and validation reads, while `stock` itself is unchanged (FR-004, FR-010).

**Checkpoint**: the oversell window is closed. US1 is independently demonstrable, but stock held by an abandoned checkout is not yet returned — do not ship without Phase 4.

---

## Phase 4: User Story 2 — Abandoned reservations return to sale automatically (Priority: P1)

**Goal**: Held units become purchasable again without operator action.

**Independent Test**: Create a reservation, advance past its lifetime, run the expiry job, and confirm the units are available again and a second run changes nothing.

### Implementation for User Story 2

- [ ] T024 [US2] Create `src/lib/inngest/functions/stock-reservations.ts` with `expireStockReservationsFunction`: a `cron('*/5 * * * *')` trigger, a `step.run` calling `expireDueReservations` with a batch limit of 500, and a structured log of the swept count — modelled on `scanAbandonedCartsFunction` (FR-006, R7, D5).
- [ ] T025 [US2] Register `expireStockReservationsFunction` in `src/lib/inngest/registry.ts` (an unregistered function is silently dead).
- [ ] T026 [US2] Add a `reservationExpirySweepClean` score name to `src/lib/inngest/scores.ts` and emit it from the sweep so an abnormal expiry rate is visible next to the existing `stock-conflict` score (FR-014, US4 acceptance 4).
- [ ] T027 [US2] Release immediately on failure: call `releaseForCheckoutRequest` from `recordCheckoutProcessingFailure` in `src/features/cart/services/checkout-service.ts` whenever the request transitions to `FAILED`, including the terminal/non-retriable branch and `recoverCheckoutRequestAfterRetryExhaustion` (FR-007, US2 acceptance 2).
- [ ] T028 [US2] Confirm the soft-deleted-variant path: a variant soft-deleted while held fails its checkout request with a named reason and the release in T027 returns the units (D6, spec edge case 1). Add the case to the reservation suite.
- [ ] T029 [US2] Write `__tests__/lib/inngest/functions/stock-reservations.test.ts` covering: an expired reservation released and its units returned, the batch limit honoured, a second run over already-expired rows changing nothing, and expiry evaluated against the database clock (FR-006, US2 acceptances 1 and 4, SC-003).

**Checkpoint**: the hold is bounded in both directions. This is the shippable MVP — US1 and US2 together.

---

## Phase 5: User Story 3 — Retries and duplicate submissions stay safe (Priority: P1)

**Goal**: Inngest retries, duplicate submissions, and webhook redeliveries never reserve or decrement twice.

**Independent Test**: Replay the reservation and commit steps for one checkout request and assert stock changes exactly once.

### Implementation for User Story 3

- [ ] T030 [US3] Replay the whole durable pipeline against the fake `CheckoutStepRunner` already used by `__tests__/features/cart/inngest/checkout.test.ts` and assert `stock`, `reservedStock`, and the reservation status are unchanged by the second run (FR-009, US3 acceptance 2, SC-004).
- [ ] T031 [US3] Assert a duplicate submission carrying the same `checkoutRequestId` resolves to the same reservation rows and the same order, exercising the `UNIQUE (checkoutRequestId, variantId)` path rather than an application-side check (US3 acceptances 1 and 3, R5).
- [ ] T032 [US3] Prove the database decides the winner: a test that issues concurrent grants for the same units and asserts the loser is decided by the zero-row result of the conditional update — not by a value read beforehand (FR-003, US3 acceptance 4).
- [ ] T033 [US3] Verify the restock path in `src/features/orders/services/order-restock.ts` is still correct after a consumed reservation: cancel and then refund one order and assert `stock` is credited exactly once and `reservedStock` is untouched (FR-016, spec edge case 3). Add the case to `__tests__/features/orders/services/order-restock.test.ts`.
- [ ] T034 [US3] Confirm the Cash on Delivery path consumes at order commit rather than at payment confirmation, since a COD order stays `PENDING` with no capture (spec edge case 5).

**Checkpoint**: at-least-once delivery can no longer cost inventory.

---

## Phase 6: User Story 4 — Operators can see and act on held stock (Priority: P2)

**Goal**: An admin can see what is held, for which request, until when, and can release it.

**Independent Test**: Create reservations, open the admin checkout-requests view, confirm state and expiry are visible, release one, and confirm the units return and the action is audited.

### Implementation for User Story 4

- [ ] T035 [US4] Extend `getRecentCheckoutRequests` in `src/features/cart/services/checkout-service.ts` to include each request's reservation state and earliest expiry, using `getReservationsForCheckoutRequests` in one batched query rather than per-row lookups (FR-011).
- [ ] T036 [US4] Render reservation state and expiry per request in `src/app/admin/checkout-requests/page.tsx`, following the existing `STATUS_STYLES` badge pattern and the `dateFormatter` already defined there (FR-011).
- [ ] T037 [P] [US4] Show on-hand, reserved, and available as three distinct values on the admin variant surfaces — `src/features/admin/components/VariantList.tsx` and the variant form's stock field — with `aria` labelling consistent with the existing table semantics (FR-012).
- [ ] T038 [US4] Add the release payload schema to `src/features/orders/validations.ts` and create `src/app/api/admin/checkout-requests/[id]/reservations/release/route.ts` using `checkAdminAuth('orders:update')`, `handleApiError`, and `withApiLogging` — no inline auth check (FR-013, constitution V).
- [ ] T039 [US4] Write an `adminAuditLogs` row from the release route via `recordAdminAuditLog` (`entity: 'StockReservation'`, the checkout request id, the released quantities in `diff`) (FR-013, US4 acceptance 3).
- [ ] T040 [US4] Add the release control to the admin checkout-requests view, disabled when the request holds no live reservation, with a confirmation step reusing `DeleteConfirmModal`'s pattern.
- [ ] T041 [US4] Reject an admin stock edit that would drop `stock` below the variant's current `reservedStock`, returning a 409 naming the held quantity, in the variant update route under `src/app/api/admin/variants/` (plan D7, spec edge case 2).
- [ ] T042 [P] [US4] Write `__tests__/app/api/admin/checkout-requests/release.test.ts` covering: 401 unauthenticated, 403 without `orders:update`, successful release returning units, audit row written, and a second release being a no-op (FR-013).

**Checkpoint**: held stock is explainable and recoverable by an operator.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T043 [P] Document the reservation lifecycle and its interaction with the checkout pipeline in `docs/architecture.md`, including the plan's lifecycle diagram and the cached-catalog boundary (FR-017, plan D4).
- [ ] T044 [P] Add the customer-facing behaviour to `docs/features.md`: stock is held at checkout submission, for how long, and what an out-of-stock denial looks like (FR-017).
- [ ] T045 [P] Add a retention note and a follow-up issue for pruning `CONSUMED`/`RELEASED`/`EXPIRED` ledger rows; the table grows once per checkout line item and needs a retention policy before it is large (spec edge case 8). Do not implement pruning in this feature.
- [ ] T046 Confirm the coverage gate: `npm run test:coverage` shows `src/features/**/services/**` at or above 85% lines and functions with the new module included (SC-007).
- [ ] T047 Measure the checkout latency delta against the T002 reference and record it in the PR description; a regression beyond the existing SLO is a blocker (SC-008).
- [ ] T048 Verify the admin surfaces with Playwright against a dev server — reservation badges, the three-value stock display, and the release flow — and attach screenshots to the PR (constitution III).
- [ ] T049 Update `specs/README.md`: move 016 from "Proposed; not planned" to planned, and update the status line listing which directories carry a `plan.md` and `tasks.md`.
- [ ] T050 Run all five gates — `npm run lint`, `npx tsc --noEmit -p tsconfig.check.json`, `npm test`, `npm run build`, `npm run docs:check` — and confirm each passes (SC-008).

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup. **Blocks every user story.**
- **US1 (Phase 3)**: depends on Phase 2.
- **US2 (Phase 4)**: depends on Phase 2; T027 additionally depends on T017 (the `FAILED` path it hooks).
- **US3 (Phase 5)**: depends on US1 and US2 — it verifies their idempotency, so it cannot precede them.
- **US4 (Phase 6)**: depends on Phase 2 only for the data, and on US1 for a reservation to display; can proceed in parallel with US3.
- **Polish (Phase 7)**: depends on all shipped stories.

### Within each story

- Schema before service; service before caller; caller before UI.
- Tests are written against the real conditional updates; a test that mocks the losing writer does not satisfy its task.

### Parallel opportunities

- T002, T003 in Setup.
- T010, T011, T012 in Foundational — different functions in the same module, so serialise the final edit if worked concurrently.
- T037 and T042 in US4.
- T043, T044, T045 in Polish.
- US3 and US4 can be worked by different people once US1 and US2 are in.

---

## Implementation Strategy

### MVP

Phases 1 → 2 → 3 → 4. US1 without US2 is not shippable: it converts an overselling defect into an under-selling one, which the spec calls out as equally damaging and harder to notice.

### Incremental delivery

1. Foundational schema + service — no behaviour change, revertable alone.
2. - US1 → the oversell window closes.
3. - US2 → holds expire; **ship**.
4. - US3 → idempotency proven under replay.
5. - US4 → operators can see and act.

---

## Notes

- `[P]` marks different files with no ordering dependency.
- Every reservation mutation goes through `src/features/orders/services/stock-reservation.ts`; a conditional update written anywhere else is a review blocker (plan D3).
- On-hand `ProductVariant.stock` changes only at order commit and restock. Any task that decrements it at reservation time is wrong (FR-010).
- Commit per task or per logical group; the schema migration and its bootstrap refresh belong in the same commit.
