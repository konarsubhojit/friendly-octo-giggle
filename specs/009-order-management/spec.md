# Feature Specification: Order Management

**Feature Branch**: `009-order-management`  
**Created**: 2026-06-09  
**Status**: Draft  
**Input**: User description: "Document the existing customer order management feature: placing orders, order history, order detail, and status lifecycle."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Place an authenticated order (Priority: P1)

A signed-in shopper can review cart items, acknowledge the checkout policy, submit checkout, and receive an order reference after queued order creation completes.

**Why this priority**: Order placement is the core commerce path; history and detail pages only have value after reliable order creation.

**Independent Test**: Sign in, proceed through checkout review with valid shipping details and cart items, acknowledge the policy, confirm the order, and verify a completed checkout response returns an order ID and redirects to confirmation.

**Acceptance Scenarios**:

1. **Given** a signed-in shopper with valid cart items and shipping details, **When** they acknowledge the order policy and confirm checkout, **Then** the system creates a checkout request and eventually returns the created order ID.
2. **Given** checkout processing succeeds, **When** the order is created, **Then** it is stored with status `PENDING`, structured shipping address fields, total amount, item rows, and a generated `ORD` short ID.
3. **Given** an order is created, **When** post-processing runs, **Then** product variant stock is decremented, order caches/search hashes are updated, and an order confirmation email is queued or sent by fallback.
4. **Given** checkout is still processing, **When** the review page polls checkout status, **Then** the user sees processing feedback until status becomes `COMPLETED` or `FAILED`.

---

### User Story 2 - View and search order history (Priority: P2)

A signed-in customer can open My Orders to see only their own order history, search by order fields, and paginate through results.

**Why this priority**: Customers need visibility into past purchases immediately after ordering, and access must remain scoped to the authenticated user.

**Independent Test**: Seed multiple orders for a signed-in user, visit `/orders`, search by order ID or status, page through results, and verify other users' orders never appear.

**Acceptance Scenarios**:

1. **Given** an unauthenticated visitor opens `/orders`, **When** the page renders, **Then** it displays an authentication-required state instead of order data.
2. **Given** an authenticated customer has orders, **When** they open `/orders`, **Then** order cards show status badge, date, order number, product summary, item count, thumbnails, and formatted total.
3. **Given** a customer searches their orders, **When** Redis Search is available, **Then** matching order IDs come from the Redis index; otherwise database search with caching is used.
4. **Given** search returns no matches, **When** the list renders, **Then** an empty state explains that no matching orders were found.

---

### User Story 3 - Inspect order detail and status lifecycle (Priority: P3)

A customer can inspect an order detail page with item, variant, customization, shipping, tracking, and lifecycle information, and can cancel only while the order is pending.

**Why this priority**: Detail and lifecycle visibility reduce support burden after checkout and expose the real fulfillment state to the customer.

**Independent Test**: Open a customer's own order detail page, verify the timeline and item/shipping sections, cancel a pending order, and verify non-pending orders cannot be cancelled through the customer API.

**Acceptance Scenarios**:

1. **Given** an authenticated customer opens one of their own order detail URLs, **When** data loads, **Then** the page shows order number, date, total, status timeline, items, variants, customizations, and shipping address.
2. **Given** an order has `trackingNumber` or `shippingProvider`, **When** the detail page renders, **Then** a shipping and tracking section is shown.
3. **Given** an order status is `PENDING`, **When** the customer confirms cancellation, **Then** the status changes to `CANCELLED` and order/admin caches plus Redis status are invalidated or updated.
4. **Given** an order status is not `PENDING`, **When** the customer attempts cancellation, **Then** the API rejects the request with the message that only pending orders can be cancelled.
5. **Given** an admin changes status to `PROCESSING`, `SHIPPED`, `DELIVERED`, or `CANCELLED`, **When** the update succeeds, **Then** the customer can see the new state and a status-update email is queued or sent by fallback.

---

### Edge Cases

- If a user is not authenticated, order creation, checkout status, order list, and order detail APIs return authentication errors and UI shows sign-in prompts.
- If checkout JSON is malformed or validation fails, the API returns the parser/validation error instead of creating a checkout request.
- If checkout has no items, missing email, or missing shipping address, the request fails before an order is created.
- If a product, variant, or active non-deleted product record cannot be found, checkout fails with a not-found error.
- If requested quantity exceeds variant stock, checkout fails and records an insufficient-stock business event.
- If the checkout queue publish fails, processing falls back to an inline `waitUntil` job; if queue delivery repeatedly fails, the checkout request is marked `FAILED` unless an order already exists.
- If checkout completes without an order ID or polling times out, the review page shows an error and leaves the user able to retry.
- If Redis is unavailable for order history/search, the system falls back to database reads and cached database search results.
- If an order hash is missing from Redis but its ID is in the user's Redis order set, the system hydrates the missing order from PostgreSQL and rewrites Redis asynchronously.
- If a customer requests another user's order ID, ownership checks return `Order not found` instead of exposing data.
- If policy content or line items are unavailable on checkout review, confirmation is disabled; the broader policy dialog behavior is documented separately in `specs/003-order-policy-dialog`.
- Returns/refunds are not implemented as customer order-management actions; the shipped customer action is pending-order cancellation, with policy disclosure handled by feature 003.
- If QStash email publishing fails, order confirmation and status emails fall back to direct `sendWithRetry`; non-retriable failures are saved as failed email records.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST require an authenticated session before creating checkout requests or customer orders.
- **FR-002**: System MUST validate checkout customer name, email, structured address, pin code, and at least one line item before queueing checkout.
- **FR-003**: System MUST persist each checkout submission as a `CheckoutRequest` with `PENDING`, `PROCESSING`, `COMPLETED`, or `FAILED` status.
- **FR-004**: System MUST process checkout requests idempotently by linking at most one `Order` to a checkout request.
- **FR-005**: System MUST create orders with generated `ORD`-prefixed short IDs, authenticated user ID, customer contact, structured address fields, total amount, and initial `PENDING` status.
- **FR-006**: System MUST persist one `OrderItem` per submitted line item with product ID, variant ID, quantity, captured price, and optional customization note.
- **FR-007**: System MUST validate active products and variants and decrement variant stock transactionally when an order is created.
- **FR-008**: System MUST expose checkout status polling by checkout request ID and restrict status visibility to the owning user.
- **FR-009**: System MUST queue or send order confirmation email containing order ID, items, total, shipping address, locale, and user currency preference.
- **FR-010**: System MUST expose authenticated order history at `/api/orders` with pagination, total count, optional search, and user scoping.
- **FR-011**: System MUST render `/orders` as an authenticated customer order list with status, date, product summary, item count, thumbnails, and currency-formatted total.
- **FR-012**: System MUST support order search through Redis Search when configured and database search fallback when Redis is unavailable.
- **FR-013**: System MUST expose authenticated order detail at `/api/orders/[id]` with products and variants and MUST enforce ownership before returning data.
- **FR-014**: System MUST render `/orders/[id]` with lifecycle timeline, item rows, variant labels, customization notes, tracking details, and structured shipping address.
- **FR-015**: System MUST allow customers to cancel only `PENDING` orders and update status to `CANCELLED`.
- **FR-016**: System MUST support admin status updates across `PENDING`, `PROCESSING`, `SHIPPED`, `DELIVERED`, and `CANCELLED`, including optional tracking number and shipping provider.
- **FR-017**: System MUST invalidate order, admin, product, and bestseller caches affected by order creation or cancellation/status change.
- **FR-018**: System MUST update Redis order hashes/search data for created orders and status changes when Redis is configured.
- **FR-019**: System MUST log business events for checkout queueing, order creation, failures, status changes, and email queue/sending outcomes.

### Key Entities

- **CheckoutRequest**: Durable queue-facing checkout submission containing user, customer details, structured address, requested items, processing status, error message, and timestamps.
- **Order**: Customer purchase record with `ORD` short ID, optional checkout request link, user ownership, customer/shipping fields, total amount, lifecycle status, tracking fields, and timestamps.
- **OrderItem**: Captured purchased line item linked to an order, product, and variant, including quantity, captured price, and optional customization note.
- **OrderStatus**: Lifecycle enum with `PENDING`, `PROCESSING`, `SHIPPED`, `DELIVERED`, and `CANCELLED` values used by customer UI, admin updates, Redis search, and email templates.
- **Order Search Index**: Redis hash/search representation keyed by `order:{id}` plus `user:orders:{userId}` membership for fast customer/admin order lookup.
- **Order Email Event**: QStash or fallback email payload for `order.created` and `order.status_changed` notifications.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Authenticated checkout with valid stock reaches `COMPLETED` status and produces an order ID in integration tests without creating duplicate orders for one checkout request.
- **SC-002**: 100% of customer order list/detail requests are scoped to the authenticated user and return not-found/unauthorized responses for invalid ownership or missing auth.
- **SC-003**: Order history search returns matching customer orders by ID/status/customer/product fields with Redis enabled and still returns valid results through database fallback when Redis is unavailable.
- **SC-004**: Pending-order cancellation updates customer UI, persisted order status, Redis status, and related caches while non-pending cancellation attempts fail with a 400 response.
- **SC-005**: Status lifecycle display consistently maps `PENDING → PROCESSING → SHIPPED → DELIVERED`, with `CANCELLED` shown as a terminal cancellation state.
- **SC-006**: Order confirmation and status-update email paths are exercised through QStash and direct fallback, with non-retriable failures recorded for admin review.
- **SC-007**: Customer-facing order totals and line item prices render through the currency context instead of raw numeric formatting.
