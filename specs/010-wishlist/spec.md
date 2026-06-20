# Feature Specification: Wishlist

**Feature Branch**: `010-wishlist`  
**Created**: 2026-06-09  
**Status**: Draft  
**Input**: User description: "Document the shipped wishlist feature by reverse-engineering the implementation"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Save and Unsave Products (Priority: P1)

A signed-in shopper can mark products they like from product listing cards and from the mobile product-detail action bar, with the heart state updating immediately in the UI and persisting to their account.

**Why this priority**: Saving products is the core wishlist value. Without reliable add/remove behavior, the wishlist page and cross-device persistence have no useful data.

**Independent Test**: Sign in, open a product grid, click a product heart, verify the heart becomes selected, refresh or fetch the wishlist API, and verify the product id is saved. Click the same heart again and verify it is removed.

**Acceptance Scenarios**:

1. **Given** a signed-in user views a product card that is not in their wishlist, **When** they click the heart button, **Then** the UI immediately shows the product as wishlisted and `POST /api/wishlist` persists the product id.
2. **Given** a signed-in user views a product card that is already in their wishlist, **When** they click the heart button, **Then** the UI immediately clears the selected state and `DELETE /api/wishlist/{productId}` removes the record.
3. **Given** a signed-in user opens a product detail page on mobile, **When** they use the sticky action-bar heart, **Then** the same wishlist toggle behavior is available without leaving the page.
4. **Given** a wishlist API operation fails after an optimistic toggle, **When** the thunk rejects, **Then** the wishlist slice stores the returned error message for display by wishlist surfaces.

---

### User Story 2 - View and Manage Saved Items (Priority: P2)

A signed-in shopper can open the wishlist page, see their saved products in a responsive grid with images, descriptions, and localized currency prices, then remove saved products from that page.

**Why this priority**: The saved-items page turns individual heart clicks into a manageable shopping flow and provides the main destination linked from the account menu.

**Independent Test**: Sign in with saved wishlist products, open `/wishlist`, verify all saved products render with product links and prices, remove one item, and verify the card disappears and the API receives the delete request.

**Acceptance Scenarios**:

1. **Given** a signed-in user has saved products, **When** they open `/wishlist`, **Then** the page fetches `/api/wishlist` and renders one card per returned product.
2. **Given** a product appears on the wishlist page, **When** the user clicks the product card, **Then** they navigate to that product detail page.
3. **Given** a product appears on the wishlist page, **When** the user clicks Remove, **Then** the product is optimistically removed from Redux state and `DELETE /api/wishlist/{productId}` is dispatched.
4. **Given** the wishlist is empty, **When** the page loads, **Then** an empty state explains how to save items and links to `/shop`.

---

### User Story 3 - Account Persistence and Access Control (Priority: P3)

Wishlist contents are tied to authenticated user accounts so saved products persist across sessions and devices, while guests and other users cannot access or mutate another account's wishlist.

**Why this priority**: Persistence and authorization make the feature safe and useful beyond a single page view. This also provides the concrete wishlist behavior referenced at a high level by `specs/005-enhanced-account-personalization`.

**Independent Test**: Add a product while signed in, fetch `/api/wishlist` in a separate authenticated session for the same user, and verify the product is returned. Fetch or mutate the API without a session and verify `401 Unauthorized`.

**Acceptance Scenarios**:

1. **Given** a signed-in user saves products, **When** they sign in from another browser or device, **Then** `GET /api/wishlist` returns the same saved products for that user.
2. **Given** a guest opens `/wishlist`, **When** authentication state resolves, **Then** the page shows an auth-required state with callback URL `/wishlist`.
3. **Given** a guest clicks a product heart, **When** no authenticated session exists, **Then** the click does not dispatch add/remove actions and does not create guest-local wishlist data.
4. **Given** a guest or expired session calls a wishlist API route, **When** the request is handled, **Then** the response is `401 Unauthorized`.

---

### Edge Cases

- Duplicate add requests for the same user and product are idempotent because the database has a unique `(userId, productId)` constraint and inserts use conflict-do-nothing.
- Deleted products and null product relations are filtered out before wishlist products are returned to the client.
- Deleted product variants are excluded from returned product data before prices are derived in the wishlist page.
- A missing `productId` in `POST /api/wishlist` fails validation and returns a client error.
- A missing route `productId` in `DELETE /api/wishlist/{productId}` returns a client error.
- Unauthenticated `fetchWishlist` calls in the Redux thunk normalize `401` into empty product and id arrays instead of surfacing an error.
- Add/remove thunk failures preserve the API or fallback error message in wishlist state; optimistic state is not automatically rolled back by the slice.
- Concurrent duplicate saves do not create duplicate rows, but concurrent UI toggles may rely on subsequent fetches to converge with server state.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST maintain wishlist state in the storefront Redux store with `productIds`, full `products`, `loading`, and `error` fields.
- **FR-002**: System MUST fetch the authenticated user's wishlist from `GET /api/wishlist` and store both returned products and product ids.
- **FR-003**: System MUST let authenticated users add products through `POST /api/wishlist` with a JSON body containing a non-empty `productId`.
- **FR-004**: System MUST let authenticated users remove products through `DELETE /api/wishlist/{productId}`.
- **FR-005**: System MUST protect all wishlist API operations with session authentication and return `401 Unauthorized` when no user id is present.
- **FR-006**: System MUST persist wishlist rows per user and product in the `Wishlist` table, related to `User` and `Product` records.
- **FR-007**: System MUST enforce one wishlist row per user/product pair with a database uniqueness constraint.
- **FR-008**: System MUST use writer database access for add/remove operations and read access for wishlist queries through existing DB query helpers.
- **FR-009**: System MUST return wishlist products with active product variants and exclude deleted products from the product list.
- **FR-010**: System MUST expose a reusable `WishlistButton` that renders selected/unselected heart states using `aria-pressed` and product-specific aria labels.
- **FR-011**: System MUST provide optimistic UI updates when a signed-in user toggles a wishlist item from product cards, mobile product detail actions, or the wishlist page.
- **FR-012**: System MUST do nothing for guest heart clicks; the shipped implementation does not create a local guest wishlist or open a login prompt.
- **FR-013**: System MUST display an authentication-required state on the wishlist page for unauthenticated visitors with callback URL `/wishlist`.
- **FR-014**: System MUST display wishlist products in a responsive grid with product image, name, description, and formatted minimum variant price.
- **FR-015**: System MUST display a clear empty state with a `/shop` call to action when a signed-in user's wishlist has no products.
- **FR-016**: System MUST show loading and error states for wishlist page loading failures and page-level runtime errors.
- **FR-017**: System MUST link the signed-in user menu to the localized wishlist route.
- **FR-018**: System MUST log wishlist API errors with contextual operation names before delegating to shared API error handling.

### Key Entities

- **WishlistItem**: A saved relationship between one user and one product, represented by a 7-character id, `userId`, `productId`, and creation timestamp.
- **User**: Authenticated account that owns wishlist items; deleting a user cascades deletion of their wishlist rows.
- **Product**: Saved catalog item referenced by wishlist rows; deleting a product cascades deletion of related wishlist rows.
- **ProductVariant**: Active, non-deleted variant data included with returned wishlist products so UI can compute the minimum displayed price.
- **WishlistState**: Client-side Redux state containing saved product ids, full product objects for the wishlist page, loading status, and the latest error.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A signed-in user can add and remove a product from wishlist controls without navigating away from the current product listing or mobile detail view.
- **SC-002**: `GET /api/wishlist` returns the same saved product ids for the same signed-in account across sessions/devices.
- **SC-003**: Duplicate add attempts for the same user/product result in at most one persisted wishlist row.
- **SC-004**: Guests cannot read, add, or remove persisted wishlist data through API routes and receive `401` responses.
- **SC-005**: The wishlist page renders saved products, an empty state, an auth-required state, and loading/error states without runtime crashes.
- **SC-006**: Removing an item from the wishlist page updates the visible list immediately and dispatches the persisted removal request.
- **SC-007**: Product card heart controls expose accurate accessible names and `aria-pressed` state for selected and unselected products.
- **SC-008**: Deleted products are absent from wishlist API product results even if stale wishlist rows exist.
