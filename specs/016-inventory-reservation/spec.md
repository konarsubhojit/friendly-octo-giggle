# Feature Specification: Inventory Reservation

**Feature Branch**: `016-inventory-reservation`  
**Created**: 2026-08-01  
**Status**: Draft  
**Epic**: Phase 2 — Correctness and commerce depth  
**Input**: Hold variant stock from the moment a checkout request is accepted until the durable order pipeline commits or abandons it, closing the window in which two concurrent shoppers can both be sold the last unit.

## Baseline (verified 2026-08-01)

- Checkout is durable and asynchronous. `POST /api/checkout` validates and persists a `CheckoutRequest` row, then publishes an event consumed by `processCheckoutRequestFunction` (`src/features/cart/inngest/checkout.ts`), which claims the request and creates the order.
- Stock is validated in `priceAndValidateStock` (`src/features/orders/services/create-order-service.ts`) by comparing `ProductVariant.stock` against the requested quantity, and it is decremented only later, when the order is created inside the Inngest pipeline.
- **The gap**: validation and decrement are separated by request persistence, event publication, and queue latency. Two requests for the last unit can both validate successfully and only one can be fulfilled, so the second fails after the customer has already been told checkout is under way — and, for online payments, after money has been captured.
- The pipeline already recognizes this failure mode: it emits a `stockConflict` Inngest score, which measures the defect without preventing it.
- Existing building blocks this feature reuses: idempotency keyed on `checkoutRequestId`, the `CheckoutRequest` status lifecycle (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`), restock logic in `src/features/orders/services/order-restock.ts`, the admin checkout-requests dashboard, Prometheus metrics in `src/lib/metrics.ts`, and the Inngest cron pattern established by `scanAbandonedCartsFunction`.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - The last unit is sold exactly once (Priority: P1)

When two shoppers submit checkout for the last available unit at the same moment, exactly one succeeds and the other is told immediately, before payment is captured.

**Why this priority**: This is the defect. Overselling produces a captured payment with no fulfillable order, forcing a manual refund and destroying trust at the highest-intent moment in the funnel.

**Independent Test**: Drive two concurrent checkout submissions for a variant with `stock = 1` and assert exactly one order is created, one is rejected, and the final stock is zero.

**Acceptance Scenarios**:

1. **Given** a variant with one unit remaining, **When** two checkout requests are submitted concurrently, **Then** exactly one reservation is granted and exactly one order is created.
2. **Given** a checkout request that loses the race, **When** reservation fails, **Then** the customer receives an out-of-stock outcome naming the affected item, and no payment is captured for it.
3. **Given** reservations exist for a variant, **When** available stock is computed for any shopper, **Then** it excludes units held by other shoppers' live reservations.
4. **Given** a granted reservation, **When** the order is committed, **Then** stock is decremented exactly once and the reservation is consumed.

---

### User Story 2 - Abandoned reservations return to sale automatically (Priority: P1)

Stock held by a checkout that was never completed becomes purchasable again without operator intervention.

**Why this priority**: A reservation system without expiry converts an overselling defect into an under-selling defect, which is equally damaging and harder to notice.

**Independent Test**: Create a reservation, let its lifetime elapse without completing checkout, and confirm the held units become available again.

**Acceptance Scenarios**:

1. **Given** a reservation whose lifetime has elapsed, **When** the expiry job runs, **Then** the reservation is released and its units return to availability.
2. **Given** a checkout request that fails, **When** the failure is recorded, **Then** its reservation is released immediately rather than waiting for expiry.
3. **Given** a customer abandons an online payment, **When** the payment is not confirmed within the reservation lifetime, **Then** the reservation is released.
4. **Given** the expiry job runs repeatedly, **When** it processes an already-released reservation, **Then** it makes no further change.

---

### User Story 3 - Retries and duplicate submissions stay safe (Priority: P1)

Inngest retries, duplicate browser submissions, and webhook redeliveries never reserve or decrement stock twice.

**Why this priority**: The pipeline is at-least-once by design. A reservation step that is not idempotent would turn every retry into silent inventory loss.

**Independent Test**: Execute the reservation and commit steps repeatedly for the same checkout request and assert stock changes only once.

**Acceptance Scenarios**:

1. **Given** a checkout request that already holds a reservation, **When** the reservation step runs again, **Then** the existing reservation is reused and no additional units are held.
2. **Given** an order already committed for a checkout request, **When** the pipeline is retried, **Then** no further stock decrement occurs.
3. **Given** a duplicate submission carrying the same idempotency key, **When** it is processed, **Then** it resolves to the same reservation and the same order.
4. **Given** concurrent attempts to reserve the same units, **When** they execute, **Then** the database constraint or atomic conditional update — not application-level checking — decides the winner.

---

### User Story 4 - Operators can see and act on held stock (Priority: P2)

An administrator can see which units are reserved, for which checkout request, and until when, and can release a stuck reservation.

**Why this priority**: Reservations make inventory temporarily invisible. Without operator visibility, "stock exists but nobody can buy it" becomes an unexplainable support case.

**Independent Test**: Create reservations, open the admin checkout-requests view, confirm reservation state and expiry are visible, and release one.

**Acceptance Scenarios**:

1. **Given** live reservations, **When** an admin opens the checkout-requests dashboard, **Then** each request shows its reservation state and expiry.
2. **Given** a product with reserved units, **When** an admin views its inventory, **Then** on-hand, reserved, and available quantities are distinguished.
3. **Given** a stuck reservation, **When** an authorized admin releases it, **Then** the units return to availability and the action is written to the admin audit log.
4. **Given** reservation expiry events, **When** they occur, **Then** a metric is emitted so abnormal rates are observable.

---

### Edge Cases

- A variant soft-deleted while units are reserved must not silently strand the reservation; the checkout request must fail with a clear reason and the reservation must be released.
- An admin reducing `stock` below the currently reserved quantity must be prevented or must be explicitly recorded as an oversell decision.
- A cancelled or refunded order must restock through the existing restock path without double-counting a reservation that was already consumed.
- Reservation lifetime must exceed the worst-case online-payment completion time, or paying customers will lose their held stock mid-payment.
- Cash on Delivery leaves the order `PENDING` without capture; the reservation must be consumed at order commit, not at payment confirmation.
- Clock skew between application instances must not cause premature expiry; expiry must be evaluated against the database clock.
- The expiry job must be bounded per run so a large backlog cannot exhaust the function timeout.
- Reservation records must not accumulate without limit; released and consumed rows need a retention policy.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST create a stock reservation for every requested variant and quantity at the time a checkout request is accepted, before any payment is captured.
- **FR-002**: A checkout request MUST be rejected when a reservation cannot be granted for every one of its items, and the response MUST identify the unavailable items.
- **FR-003**: Reservation grant MUST be atomic against concurrent grants, enforced by a database constraint or an atomic conditional update rather than a read-then-write in application code.
- **FR-004**: Available quantity presented to shoppers MUST be on-hand stock minus live reservations held by other checkout requests.
- **FR-005**: Every reservation MUST carry an expiry timestamp, and the lifetime MUST exceed the maximum supported online-payment completion window.
- **FR-006**: A scheduled job MUST release expired reservations, MUST process a bounded batch per run, and MUST be idempotent across runs.
- **FR-007**: Reservations MUST be released immediately when their checkout request reaches `FAILED`.
- **FR-008**: Reservations MUST be consumed exactly once when their order is committed, in the same database transaction as the stock decrement and order creation.
- **FR-009**: Reservation operations MUST be idempotent under Inngest retries, keyed consistently with the existing `checkoutRequestId` idempotency.
- **FR-010**: The system MUST NOT decrement on-hand stock at reservation time; on-hand stock changes only at order commit.
- **FR-011**: Reservation state and expiry MUST be visible in the admin checkout-requests dashboard.
- **FR-012**: Product and variant inventory views MUST distinguish on-hand, reserved, and available quantities.
- **FR-013**: An authorized admin MUST be able to release a reservation manually, and the action MUST be written to the admin audit log.
- **FR-014**: The system MUST emit metrics for reservations granted, denied, expired, consumed, and manually released.
- **FR-015**: Schema changes MUST ship as a reviewed Drizzle migration with indexes supporting expiry scans and per-variant reservation lookups.
- **FR-016**: Cancellation and refund restock paths MUST remain correct and MUST NOT double-count consumed reservations.
- **FR-017**: `docs/architecture.md` and `docs/features.md` MUST document the reservation lifecycle and its interaction with the checkout pipeline.

### Key Entities

- **StockReservation**: A hold on a quantity of one product variant for one checkout request, with a status lifecycle (held, consumed, released, expired) and an expiry timestamp.
- **ProductVariant**: The inventory owner; its `stock` column continues to represent on-hand units, unchanged until order commit.
- **CheckoutRequest**: The existing durable checkout record that owns the reservations for its items.
- **Available Quantity**: The derived value — on-hand minus live reservations — that all shopper-facing stock decisions use.
- **Reservation Expiry Job**: The scheduled Inngest function that releases lapsed reservations in bounded batches.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Concurrent checkout submissions for the last unit produce exactly one order and never a negative or double-decremented stock value.
- **SC-002**: No payment is captured for an item whose reservation was denied.
- **SC-003**: An abandoned checkout returns its held units to availability within the configured lifetime without operator action.
- **SC-004**: Replaying the reservation and commit steps for one checkout request changes stock exactly once.
- **SC-005**: The `stockConflict` score rate for completed checkouts falls to zero for conflicts detectable at reservation time.
- **SC-006**: Admins can identify every reserved unit and the checkout request holding it.
- **SC-007**: Service-layer test coverage for reservation code meets the repository's 85% line and function threshold for `src/features/**/services/**`.
- **SC-008**: All four mandatory gates pass and the end-to-end checkout suites remain green.

## Out of Scope

- Reserving stock when an item is added to the cart; reservations begin at checkout submission.
- Backorders, pre-orders, or overselling with fulfillment delay.
- Multi-warehouse or per-location inventory.
- Changing the payment gateway abstraction.

## Dependencies

- Builds on the shipped durable checkout pipeline and its idempotency guarantees.
- Should land before `019-stock-and-price-alerts`, which reads availability and must observe the reservation-aware value.
