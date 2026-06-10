# Feature Specification: Shopping Cart and Checkout

**Feature Branch**: `007-shopping-cart-and-checkout`  
**Created**: 2026-06-09  
**Status**: Draft  
**Input**: User description: "Document the existing shopping cart and checkout hand-off feature by reverse-engineering shipped code."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Maintain a Stock-Aware Cart (Priority: P1)

A shopper can add a specific product variant to a cart, see the cart contents with product imagery, variant labeling, quantities, and localized prices, then update or remove individual lines before checkout.

**Why this priority**: Cart creation and line-item management are the core commerce capability required before any checkout step can succeed.

**Independent Test**: Sign in, add a product variant from a product detail page, open `/cart`, update quantity, remove the item, and verify totals and empty-cart states update correctly.

**Acceptance Scenarios**:

1. **Given** an authenticated shopper selects an in-stock variant, **When** they add it to cart, **Then** the API creates or reuses their cart and returns the updated cart with the item.
2. **Given** the same product and variant are already in the cart, **When** the shopper adds more quantity, **Then** the existing line quantity increases rather than creating a duplicate line.
3. **Given** a shopper requests more than available stock, **When** the item is added, **Then** the quantity is capped to stock and a warning plus adjusted quantity are returned when possible.
4. **Given** a cart line is displayed, **When** the shopper changes quantity from the cart page, **Then** the server validates stock and persists the new quantity.
5. **Given** a cart line is displayed, **When** the shopper removes it, **Then** the line is deleted and cart totals refresh.

---

### User Story 2 - Preserve Guest Intent Through Sign-In (Priority: P2)

A guest shopper can express cart intent before authentication, and the system preserves that intent through the login redirect by merging pending or guest-session cart data into the authenticated cart.

**Why this priority**: Guest-to-auth continuity reduces cart loss and is needed because cart and checkout pages require an authenticated user.

**Independent Test**: While signed out, add a product from a product detail page, sign in, open `/cart`, and verify the pending line appears in the authenticated cart.

**Acceptance Scenarios**:

1. **Given** a guest adds a valid product/variant/quantity from product detail, **When** they are not authenticated, **Then** the pending item is stored in browser localStorage under the pending cart key.
2. **Given** pending localStorage items exist, **When** the authenticated cart page loads, **Then** Redux dispatches add-to-cart calls for those items and clears the pending list afterward.
3. **Given** a signed `cart_session` cookie identifies a guest cart, **When** the user authenticates and calls cart GET or POST, **Then** the guest cart is merged into the user cart and the guest session cookie is rotated.
4. **Given** guest and user carts contain the same variant, **When** they merge, **Then** quantities are summed and capped to live variant stock.
5. **Given** guest cart variants are out of stock or soft-deleted during merge, **When** the merge runs, **Then** those quantities are reduced or dropped rather than exceeding inventory.

---

### User Story 3 - Hand Cart Off to Checkout (Priority: P3)

An authenticated shopper can proceed from cart to shipping, review address and policy terms, enqueue checkout processing, poll for completion, and land on an order confirmation after the order is created.

**Why this priority**: Checkout hand-off completes the purchasing journey while keeping order creation durable and idempotent.

**Independent Test**: With an authenticated cart, continue to shipping, enter a valid structured address, review policies, confirm, and verify a checkout request is queued, polled, converted to an order, and the cart is cleared.

**Acceptance Scenarios**:

1. **Given** an authenticated shopper has cart items, **When** they open `/checkout/shipping`, **Then** they can enter or select a saved structured address and see the same pricing summary as the cart.
2. **Given** a valid shipping address is submitted, **When** the form saves pending checkout data, **Then** the user is routed to `/checkout/review` with address and customization notes in sessionStorage.
3. **Given** review data and cart items exist, **When** the shopper acknowledges policies and confirms, **Then** `/api/checkout` creates a checkout request and returns a 202 response with request ID and status.
4. **Given** a checkout request is queued, **When** the queue consumer processes it, **Then** order creation runs once for that checkout request and status becomes COMPLETED.
5. **Given** checkout completes with an order ID, **When** the review page observes completion, **Then** the cart is cleared and the shopper is sent to `/checkout/confirmation?orderId=...`.

---

### Edge Cases

- Invalid JSON or malformed product/variant IDs return validation errors instead of mutating the cart.
- Missing product, missing variant, deleted product, deleted variant, or zero stock prevents add/update with user-facing errors.
- Quantity values must be positive integers; values below one are ignored in the cart UI and rejected by API validation.
- Quantity selector options are capped to the lesser of live stock and 10 visible choices.
- Invalid or tampered `cart_session` cookies are ignored and deleted from responses when detected.
- If an authenticated session user does not exist in the database, cart creation falls back to a guest cart and logs the invalid session user.
- Redis misses, stale entries, or unavailable Redis clients degrade to PostgreSQL-backed cart reads.
- Concurrent cart creation relies on unique constraints and insert-or-ignore behavior to avoid duplicate carts.
- Guest merge handles concurrent user-cart creation by refetching and merging rather than dropping guest lines.
- Cart pages require authentication; signed-out users see an auth-required state and sign-in callback.
- Checkout review redirects to cart when pending checkout session data is missing or invalid.
- Checkout queue publish failure falls back to inline background processing via `waitUntil`.
- Checkout polling times out after configured attempts and tells the user to check orders shortly.
- Retry-exhausted queue processing marks checkout requests FAILED unless an order was already created.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST validate add-to-cart input with short product ID, short variant ID, and positive integer quantity.
- **FR-002**: System MUST validate cart item quantity updates with a positive integer quantity.
- **FR-003**: System MUST create cart IDs and cart item IDs as 7-character short IDs persisted in PostgreSQL.
- **FR-004**: System MUST support exactly one persisted cart per authenticated user and one cart per guest session ID.
- **FR-005**: System MUST use a signed, HTTP-only `cart_session` cookie for guest cart identity when server-side guest carts are used.
- **FR-006**: System MUST reject add-to-cart requests for missing, deleted, variant-mismatched, or out-of-stock products.
- **FR-007**: System MUST merge duplicate product/variant lines by increasing quantity instead of storing duplicate rows.
- **FR-008**: System MUST cap added or merged quantities to available variant stock and report add-time stock adjustments when applicable.
- **FR-009**: System MUST allow owned cart item quantities to be updated and owned cart items to be removed.
- **FR-010**: System MUST hide unauthorized cart item access by returning not-found semantics for non-owned items.
- **FR-011**: System MUST clear a cart by deleting the persisted cart for the active user or guest session and invalidating related cache entries.
- **FR-012**: System MUST cache cart reads through Redis and application cache while falling back safely to database reads.
- **FR-013**: System MUST serialize cart responses with product, variant, option, variant label, quantity, timestamps, and pricing data needed by UI.
- **FR-014**: System MUST display cart totals using the active currency formatter from CurrencyContext.
- **FR-015**: System MUST persist unauthenticated product-page add intent in localStorage and sync it after authentication.
- **FR-016**: System MUST merge signed guest-session carts into authenticated carts on cart fetch or add.
- **FR-017**: System MUST require authentication to view cart and checkout pages in the public route flow.
- **FR-018**: System MUST collect structured shipping address fields before checkout review.
- **FR-019**: System MUST support optional item customization notes up to 500 characters through cart-to-checkout hand-off.
- **FR-020**: System MUST enqueue checkout requests with status tracking and idempotent queue message keys.
- **FR-021**: System MUST allow authenticated users to poll only their own checkout request status.
- **FR-022**: System MUST process checkout requests through the checkout-orders queue and create orders via the order service.
- **FR-023**: System MUST mark checkout requests PROCESSING, COMPLETED, FAILED, or PENDING according to processing outcome.
- **FR-024**: System MUST clear the cart only after checkout status reports completion with an order ID.

### Key Entities

- **Cart**: Short-ID cart owned by either a user ID or guest session ID, with created and updated timestamps.
- **CartItem**: Short-ID line item linking a cart, product, variant, quantity, and timestamps; unique per cart/product/variant.
- **GuestCartSession**: HMAC-signed cookie value containing a generated `guest_` session ID and versioned signature.
- **PendingCartItem**: Browser-local pending add intent containing product ID, variant ID, and quantity for pre-login preservation.
- **ProductVariant**: Purchasable product option with stock, SKU, price, image, and soft-delete state used for validation and display.
- **CheckoutRequest**: Short-ID queued checkout record for an authenticated user, structured address, item snapshot, status, and error message.
- **CheckoutRequestItem**: Product/variant/quantity/customization snapshot included in checkout request JSON.
- **Order**: Final order created by checkout processing and linked back to a checkout request for idempotency.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Authenticated shoppers can add, view, update, remove, and clear cart lines without duplicate product/variant rows.
- **SC-002**: Cart mutations never persist quantities above current available stock in add, update, or guest-merge flows.
- **SC-003**: Guest pending cart items survive sign-in and are synchronized into the user cart on authenticated cart load.
- **SC-004**: Invalid or unauthorized cart item operations return validation/not-found errors without changing another user's cart.
- **SC-005**: Cart pricing summary displays item count, subtotal, free shipping, and total in the selected display currency.
- **SC-006**: Authenticated checkout creates a queued checkout request, polls status, creates one order, clears cart, and routes to confirmation.
- **SC-007**: Queue retry exhaustion leaves a visible FAILED checkout status unless an order already exists for the request.
- **SC-008**: Redis/cache outages do not block cart retrieval from PostgreSQL or cart mutation correctness.
