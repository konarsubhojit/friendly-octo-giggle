# Feature Specification: Customer Self-Service Returns

**Feature Branch**: `018-self-service-returns`  
**Created**: 2026-08-01  
**Status**: Draft  
**Epic**: Phase 2 — Correctness and commerce depth  
**Input**: Let customers request a return for delivered order items, give administrators an approval queue, and connect approved returns to the existing refund and restock machinery.

## Baseline (verified 2026-08-01)

- Refunds already exist as an admin-initiated capability. The `Refund` table records provider, `paymentTransactionId`, `gatewayRefundId`, amount, status (`PENDING`, `PROCESSED`, `FAILED`), reason, `initiatedById`, and `processedAt`, and is served by `src/features/orders/services/refund-service.ts`.
- Pre-shipment cancellation is shipped (PR #427) and restocks through `src/features/orders/services/order-restock.ts` with status-transition enforcement.
- **The gap**: once an order reaches `DELIVERED`, a customer has no in-product path to start a return. Every post-delivery return is an out-of-band support request that an admin must translate into a manual refund.
- The published policy in `src/lib/constants/checkout-policies.ts` and `specs/003-order-policy-dialog` already governs cancellation, returns, and refunds, and it is acknowledged by the customer at checkout — so return terms are a shipped promise without a shipped mechanism.
- Supporting infrastructure exists: order status enum ending at `DELIVERED`/`CANCELLED`, image upload through Vercel Blob and Azure Blob (`src/lib/image-storage.ts`), the notification preference centre and email/push channels, `adminAuditLogs`, and granular admin permissions in `src/lib/constants/roles.ts`.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Request a return for a delivered item (Priority: P1)

A customer can open a delivered order, select the items and quantities to return, choose a reason, and submit a request without contacting support.

**Why this priority**: This is the missing customer-facing capability. Everything else in this specification exists to process what this story creates.

**Independent Test**: Sign in as a customer with a delivered order, submit a return for one item, and confirm the request is persisted and visible in order history.

**Acceptance Scenarios**:

1. **Given** a delivered order inside the return window, **When** the customer opens it, **Then** a return action is available for eligible items.
2. **Given** the return form, **When** the customer selects items, quantities, and a reason, **Then** the request is persisted and acknowledged on screen.
3. **Given** an order outside the return window or not yet delivered, **When** the customer views it, **Then** no return action is offered and the reason is explained.
4. **Given** an item already fully returned, **When** the customer requests again, **Then** the already-returned quantity is excluded from the selectable amount.
5. **Given** a return request is submitted, **When** it is accepted, **Then** the customer receives a confirmation through their preferred, permitted channel.

---

### User Story 2 - Administrators triage the return queue (Priority: P1)

An administrator can review pending returns with order context and evidence, then approve or reject each with a recorded reason.

**Why this priority**: A request that nobody can action has no value. The queue is the operational half of Story 1.

**Independent Test**: Submit return requests as a customer, open the admin returns queue, and approve one and reject another with reasons.

**Acceptance Scenarios**:

1. **Given** pending return requests, **When** an authorized admin opens the returns queue, **Then** each request shows its order, items, quantities, reason, and evidence.
2. **Given** a pending request, **When** an admin approves it, **Then** its status advances and the customer is notified.
3. **Given** a pending request, **When** an admin rejects it, **Then** a reason is required, recorded, and communicated to the customer.
4. **Given** any approval or rejection, **When** it is recorded, **Then** an entry is written to the admin audit log identifying the actor.
5. **Given** an admin without the returns permission, **When** they attempt to access the queue, **Then** access is refused by the existing role gate.

---

### User Story 3 - Approved returns restock and refund correctly (Priority: P1)

When returned goods are received, the units re-enter inventory and the customer is refunded through the existing refund pipeline.

**Why this priority**: This is where money and inventory move. An error here is a direct financial or inventory loss, so it must be as rigorous as the refund path it extends.

**Independent Test**: Approve a return, mark it received, and confirm variant stock increases by the returned quantity and a linked refund record is created for the correct amount.

**Acceptance Scenarios**:

1. **Given** an approved return, **When** it is marked received, **Then** each returned unit is restocked to its originating variant.
2. **Given** a received return, **When** the refund is issued, **Then** a `Refund` record is created and linked to the return.
3. **Given** a partial return, **When** the refund amount is computed, **Then** it reflects the returned items' paid price including their share of any applied discount, and follows the documented shipping-refund rule.
4. **Given** a refund that the gateway rejects, **When** the failure is recorded, **Then** the return remains actionable and the failure reason is visible to admins.
5. **Given** a return processed more than once, **When** the duplicate is attempted, **Then** neither the restock nor the refund is applied twice.
6. **Given** an order paid by Cash on Delivery, **When** a return is approved, **Then** the documented settlement path for non-captured payments is followed rather than a gateway refund.

---

### User Story 4 - Return status is transparent to the customer (Priority: P2)

A customer can see where their return stands and what happens next, without contacting support.

**Why this priority**: Return status opacity is a leading driver of support contact, but it depends on the lifecycle established by the preceding stories.

**Independent Test**: Submit a return and confirm its status is visible in order history and updates as the admin progresses it.

**Acceptance Scenarios**:

1. **Given** a submitted return, **When** the customer opens the order, **Then** the current return status and next step are shown.
2. **Given** a return status change, **When** it occurs, **Then** the customer is notified through channels permitted by their notification preferences.
3. **Given** a rejected return, **When** the customer views it, **Then** the recorded reason is shown.
4. **Given** a refunded return, **When** the customer views it, **Then** the refunded amount and its issue date are shown.

---

### Edge Cases

- The return window must be evaluated against delivery date, not order date, and must be configurable per category.
- Uploaded evidence is untrusted input: type, size, and count must be validated, and files must never be executed or served from an application origin that could enable script execution.
- A return whose refund exceeds the amount actually captured for those items must be rejected.
- Restocking a soft-deleted variant must be handled explicitly rather than silently discarded.
- A return request for an order that is subsequently cancelled must not double-refund.
- Concurrent admin actions on the same return must not produce conflicting states.
- Returns must not restock items the customer never sent back; restock happens at received, not at approved.
- If `016-inventory-reservation` has shipped, restocked units must re-enter on-hand stock without disturbing live reservations.
- Customers must only ever see and act on their own returns; ownership must be enforced server-side on every operation.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Customers MUST be able to request a return for items in a `DELIVERED` order within a configurable return window measured from delivery.
- **FR-002**: The return request MUST capture per-item quantities and a reason from a defined reason set.
- **FR-003**: Requestable quantity MUST exclude quantities already returned or pending return for the same order item.
- **FR-004**: Customers MUST be able to attach evidence images, validated for type, size, and count and stored through the existing image-storage abstraction.
- **FR-005**: Every return operation MUST enforce ownership server-side; a customer MUST NOT read or mutate another customer's return.
- **FR-006**: The return lifecycle MUST be an explicit state machine with enforced transitions, and invalid transitions MUST be rejected.
- **FR-007**: Administrators MUST have a returns queue guarded by a granular admin permission consistent with `src/lib/constants/roles.ts`.
- **FR-008**: Approval and rejection MUST require a recorded reason and MUST write to the admin audit log.
- **FR-009**: Marking a return received MUST restock each returned unit to its originating variant, using a return-scoped restock claim so that partial and repeated returns against one order each restock exactly once. The existing order-level restock service MUST NOT be reused for this, because its single order-level guard cannot express partial restock (see plan D1).
- **FR-010**: Refunds for received returns MUST be created through the existing refund service and linked to the return record — except for Cash on Delivery orders, which follow FR-013's manual settlement path because the COD gateway has no refund capability.
- **FR-011**: Partial-return refund amounts MUST reflect the items' paid price including their proportional share of applied discounts, following a documented shipping-refund rule.
- **FR-012**: Restock and refund MUST each be idempotent; repeated processing of one return MUST NOT apply either twice.
- **FR-013**: Cash on Delivery orders MUST follow a documented settlement path rather than a gateway refund.
- **FR-014**: Customers MUST be notified of return status changes through channels permitted by their notification preferences.
- **FR-015**: Return status, reason, and refunded amount MUST be visible to the customer in order history and order detail.
- **FR-016**: Schema changes MUST ship as a reviewed Drizzle migration with indexes for order, user, and status lookups.
- **FR-017**: Returns MUST be included in the existing admin CSV export capability.
- **FR-018**: `docs/features.md` and `specs/003-order-policy-dialog` MUST be updated so the published policy and the implemented mechanism agree.

### Key Entities

- **ReturnRequest**: A customer-initiated request against one order, with status, reason, timestamps, and the acting administrator for each decision.
- **ReturnItem**: A requested quantity of one order item, carrying the computed refundable amount for that quantity.
- **ReturnEvidence**: An uploaded image attached to a return request, validated and stored through the image-storage abstraction.
- **Refund**: The existing refund record, extended with a link to the return that caused it.
- **Return Window**: The configurable, category-aware period after delivery during which a return may be requested. Not a database entity — it is runtime configuration held in Edge Config with a hardcoded fallback, keyed by category name (see plan research R2).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A customer can complete a return request for a delivered order without contacting support.
- **SC-002**: Every return decision is attributable to a specific administrator through the audit log.
- **SC-003**: Restocked quantities exactly equal received quantities, with no double-counting under repeated processing.
- **SC-004**: Refund amounts for partial returns reconcile against the amount originally captured for those items.
- **SC-005**: No customer can read or modify another customer's return request.
- **SC-006**: Return status changes reach customers only through channels their notification preferences permit.
- **SC-007**: Uploaded evidence outside the permitted type, size, or count is rejected.
- **SC-008**: Service-layer coverage for return processing meets the 85% threshold for `src/features/**/services/**`.

## Out of Scope

- Carrier integration, return shipping labels, and pickup scheduling.
- Exchanges for a different product or variant; this specification covers returns and refunds only.
- Automated fraud scoring of return requests.
- Warehouse inspection or grading workflows beyond a received or not-received decision.

## Dependencies

- Extends the shipped refund and cancellation work from PR #427 and the restock service.
- Interacts with `016-inventory-reservation`; if that ships first, restock must respect reservation-aware availability.
- Pairs naturally with `022-loyalty-and-store-credit`, which can offer store credit as a refund alternative.
