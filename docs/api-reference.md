# API Reference

Complete reference for the E-commerce API with authentication, caching, and error handling.

## Overview

### Design Principles

- **RESTful Architecture**: Standard HTTP methods (GET, POST, PUT, PATCH, DELETE)
- **JSON-First**: All requests and responses use JSON format
- **Stateless**: Each request contains all necessary information
- **Idempotent Operations**: Safe retry of GET, PUT, DELETE operations
- **Type-Safe**: Zod validation on all inputs
- **Performance**: Redis caching with stampede prevention and stale-while-revalidate

### Base URL

```
Production: https://your-domain.com
Development: http://localhost:3000
```

## Authentication

### Session-Based Authentication (NextAuth)

Admin endpoints require authentication via NextAuth session with ADMIN role.

**Authentication Flow**:

- User authenticates via `/api/auth/[...nextauth]`
- Session cookie automatically included in subsequent requests
- Server validates session and checks role

**Unauthenticated or guest-capable endpoints**: No account session required

- `/api/products` (GET)
- `/api/products/[id]` (GET)
- `/api/products/bestsellers` (GET)
- `/api/categories` (GET)
- `/api/cart` (GET, POST, DELETE)
- `/api/cart/items/[id]` (PATCH, DELETE)
- `/api/checkout` (POST)
- `/api/checkout/[id]` (GET)
- `/api/reviews` (GET; writes require a session)
- `/api/search` (GET)
- `/api/search/suggest` (GET)
- `/api/search/click` (POST)
- `/api/pincode/[code]` (GET)
- `/api/share` (POST)
- `/api/exchange-rates` (GET)
- `/api/health` (GET)
- `/api/ai/products/[id]/chat` (POST)

**Account-protected endpoints**: Require an authenticated user session

- `/api/account` (GET, PATCH)
- `/api/account/addresses` (GET, POST)
- `/api/account/addresses/[id]` (PATCH, DELETE)
- `/api/account/notifications` (GET, PATCH)
- `/api/account/push-subscriptions` (POST, DELETE)
- `/api/auth/change-password` (POST)
- `/api/orders` (GET, POST)
- `/api/orders/[id]` (GET)
- `/api/wishlist` (GET, POST)
- `/api/wishlist/[productId]` (DELETE)
- `/api/reviews` (POST)
- `/api/reviews/vote` (POST)

**Admin-protected endpoints**: Require an ADMIN role

- `/api/admin/products` (GET, POST)
- `/api/admin/products/[id]` (PUT, DELETE)
- `/api/admin/products/bulk` (POST)
- `/api/admin/products/[id]/options` and nested option/generation routes
- `/api/admin/products/[id]/variants` and variant reorder routes
- `/api/admin/orders` (GET)
- `/api/admin/orders/[id]` (GET, PATCH)
- `/api/admin/orders/bulk` (POST)
- `/api/admin/users` (GET)
- `/api/admin/users/[id]` (GET, PATCH)
- `/api/admin/categories` (GET, POST)
- `/api/admin/categories/[id]` (PUT, DELETE)
- `/api/admin/categories/reorder` (POST)
- `/api/admin/variants` (GET)
- `/api/admin/variants/[variantId]` (PUT, DELETE)
- `/api/admin/reviews` (GET)
- `/api/admin/reviews/[id]` (PATCH, DELETE)
- `/api/admin/sales` (GET)
- `/api/admin/sales/export` (GET)
- `/api/admin/export/{orders,products,reviews,users}` (GET)
- `/api/admin/import/products` (POST)
- `/api/admin/email-failures` (GET)
- `/api/admin/search/reindex` (POST)
- `/api/upload` (POST)

**Service Endpoints**: Internal use

- `/api/inngest` (GET/POST/PUT) — Inngest serve endpoint for every background
  function (checkout, email, search indexing, cache invalidation, scheduled jobs)
- `/api/payments/webhook` (POST) — Razorpay webhook (legacy path, kept for the registered URL)
- `/api/payments/webhook/[provider]` (POST) — provider-scoped payment webhook, dispatched to the registered gateway
- `/api/metrics` (GET) — Prometheus metrics; restrict at the network layer in production

## Current capability notes

- AI product chat accepts guests using a one-way hashed guest identity. Chat history persistence is authenticated-user-only, and responses intentionally avoid exact stock counts.
- Checkout creation is idempotent and asynchronous: `POST /api/checkout` records a request and an Inngest function creates the order.
- Payment providers sit behind the `PaymentGateway` interface (`src/lib/payments/`). `POST /api/checkout` accepts `payment.provider` values of `RAZORPAY` (with `orderId`, `paymentId` and `signature`) or `COD` (no gateway references — Cash on Delivery orders stay `PENDING` and settle to `PAID` when an admin marks them `DELIVERED`).
- Optional Redis and search integrations fail open to database-backed behavior where supported.
- Order notifications honour the per-user notification preferences on every send path. Web push requires VAPID keys; when they are absent push is skipped and email is unaffected.
- Admin CSV, bulk mutation, category reorder, option generation, variant reorder, sales export, and search reindex endpoints require ADMIN authorization.

## Public APIs

### Products

#### GET /api/products

Retrieve all products with caching.

**Cache**: 60s TTL, 120s stale-while-revalidate

**Response**:

```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "Ab12xYz",
        "name": "Product Name",
        "description": "Product description",
        "price": 29.99,
        "image": "https://blob.vercel-storage.com/image.jpg",
        "stock": 100,
        "category": "Electronics",
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z",
        "variants": [
          {
            "id": "Kd93mNp",
            "name": "Red",
            "designName": "red-variant",
            "image": "https://blob.vercel-storage.com/red.jpg",
            "priceModifier": 5.0,
            "stock": 50,
            "createdAt": "2024-01-15T10:30:00.000Z",
            "updatedAt": "2024-01-15T10:30:00.000Z"
          }
        ]
      }
    ]
  }
}
```

**Example**:

```bash
curl https://your-domain.com/api/products
```

```javascript
const response = await fetch('/api/products')
const { data } = await response.json()
console.log(data.products)
```

#### GET /api/products/[id]

Retrieve single product by ID.

**Parameters**:

- `id` (path): Product ID (7-char base62)

**Response**: Same structure as single product above

**Errors**:

- `404`: Product not found

---

### Cart

### Search

#### GET /api/search

Search products with relevance, faceted filtering, and sort controls.

**Query Parameters**:

- `q` (required): search query
- `category` (optional)
- `minPrice`, `maxPrice` (optional)
- `inStock=true|false` (optional)
- `minRating` (optional, `0-5`)
- `variant` (optional: `all`, `single`, `multiple`)
- `sort` (optional: `relevance`, `price_asc`, `price_desc`, `newest`, `best_selling`, `top_rated`)
- `limit` (optional, default `20`, max `50`)
- `offset` (optional, default `0`)

**Response fields** include `results`, `total`, `facets`, `suggestions`, and `trending` (for zero-result fallbacks).

#### GET /api/search/suggest

Autocomplete suggestions for search-as-you-type.

**Query Parameters**:

- `q` (required): partial query
- `limit` (optional, default `8`, max `10`)

**Caching**: 30s TTL with stale-while-revalidate.

#### GET /api/cart

Get cart for current user/session. Returns null if no cart exists.

**Authentication**: Optional (uses session for logged-in users, cookie for guests)

**Response**:

```json
{
  "cart": {
    "id": "Rt45wQe",
    "userId": "user-uuid-1234",
    "sessionId": null,
    "items": [
      {
        "id": "Gh78jKl",
        "productId": "Mn56oPq",
        "variantId": "Kd93mNp",
        "quantity": 2,
        "product": {
          "id": "Mn56oPq",
          "name": "Product Name",
          "price": 29.99,
          "image": "https://...",
          "stock": 100
        },
        "variant": {
          "id": "Kd93mNp",
          "name": "Red",
          "priceModifier": 5.0,
          "stock": 50
        }
      }
    ],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:35:00.000Z"
  }
}
```

#### POST /api/cart

Add item to cart or update quantity if exists.

**Request Body**:

```json
{
  "productId": "Mn56oPq",
  "variantId": "Kd93mNp",
  "quantity": 2
}
```

**Response**: Returns updated cart (same structure as GET)

**Status**: `201 Created`

**Cookies**: Sets `cart_session` cookie for guest users (30-day expiry)

**Errors**:

- `400`: Invalid input, insufficient stock
- `404`: Product or variant not found

#### DELETE /api/cart

Clear entire cart.

**Response**:

```json
{
  "success": true
}
```

#### PATCH /api/cart/items/[id]

Update cart item quantity.

**Parameters**:

- `id` (path): Cart item ID (7-char base62)

**Request Body**:

```json
{
  "quantity": 3
}
```

**Response**: Returns updated cart item

**Errors**:

- `400`: Insufficient stock
- `404`: Cart item not found

#### DELETE /api/cart/items/[id]

Remove specific item from cart.

**Parameters**:

- `id` (path): Cart item ID (7-char base62)

**Response**:

```json
{
  "success": true
}
```

---

### Orders

#### POST /api/orders

Create new order with stock validation and atomic updates.

**Request Body**:

```json
{
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "customerAddress": "123 Main St, City, State 12345",
  "items": [
    {
      "productId": "Mn56oPq",
      "variantId": "Kd93mNp",
      "quantity": 2
    }
  ]
}
```

**Response**:

```json
{
  "order": {
    "id": "Wx23yZa",
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "customerAddress": "123 Main St, City, State 12345",
    "totalAmount": 69.98,
    "status": "PENDING",
    "items": [
      {
        "id": "Bc34dEf",
        "productId": "Mn56oPq",
        "variantId": "Kd93mNp",
        "quantity": 2,
        "price": 34.99,
        "product": {
          /* full product object */
        }
      }
    ],
    "createdAt": "2024-01-15T10:40:00.000Z",
    "updatedAt": "2024-01-15T10:40:00.000Z"
  }
}
```

**Status**: `201 Created`

**Business Logic**:

- Validates all products/variants exist
- Checks stock availability
- Calculates total with variant price modifiers
- Atomically creates order and decrements stock in transaction
- Invalidates product and order caches

**Errors**:

- `400`: Missing fields, insufficient stock
- `404`: Products not found

**Example**:

```bash
curl -X POST https://your-domain.com/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "customerAddress": "123 Main St, City, State 12345",
    "items": [{"productId": "Mn56oPq", "quantity": 2}]
  }'
```

---

### Notification preferences

#### GET /api/account/notifications

Returns the caller's notification preference centre state plus the public VAPID
key needed to create a browser push subscription.

**Authentication**: required (`401` when signed out)

**Response**:

```json
{
  "success": true,
  "data": {
    "preferences": {
      "transactionalEmail": true,
      "transactionalPush": false,
      "transactionalSms": false,
      "marketingEmail": false,
      "marketingPush": false,
      "marketingSms": false
    },
    "pushEnabled": true,
    "vapidPublicKey": "BEl62i..."
  }
}
```

`pushEnabled` is `false` and `vapidPublicKey` is `null` when the deployment has
no VAPID key pair configured. Users without saved preferences receive the
defaults shown above: transactional email is on, every other channel is opt-in.

#### PATCH /api/account/notifications

Updates one or more channel toggles. At least one field is required.

**Request Body**:

```json
{ "transactionalPush": true, "marketingEmail": false }
```

**Response**: the merged preference object, in the same shape as `GET`.

**Errors**:

- `400`: empty or invalid payload
- `401`: not authenticated

### Push subscriptions

#### POST /api/account/push-subscriptions

Registers (or refreshes) the calling browser's push subscription. Send the
result of `PushSubscription.toJSON()`. Re-posting the same endpoint updates the
stored keys, which is how the service worker recovers from
`pushsubscriptionchange`.

**Request Body**:

```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/abc123",
  "keys": { "p256dh": "BNc...", "auth": "k9d..." }
}
```

**Status**: `201 Created`

**Errors**:

- `400`: malformed payload or a non-HTTPS endpoint
- `401`: not authenticated

#### DELETE /api/account/push-subscriptions

Removes a subscription the user revoked. Scoped to the caller, so one user
cannot delete another user's subscription.

**Request Body**:

```json
{ "endpoint": "https://fcm.googleapis.com/fcm/send/abc123" }
```

**Status**: `200 OK`

Expired subscriptions do not need an explicit delete: endpoints that the push
service reports as `404`/`410` during delivery are pruned automatically.

---

## Admin APIs

All admin endpoints require ADMIN role via NextAuth session.

### Admin Products

#### GET /api/admin/products

Get all products (no caching for admin).

**Authentication**: Required (ADMIN)

**Response**: Same as `/api/products`

#### POST /api/admin/products

Create new product.

**Authentication**: Required (ADMIN)

**Request Body**:

```json
{
  "name": "New Product",
  "description": "Product description (min 1 char, max 2000)",
  "price": 29.99,
  "image": "https://blob.vercel-storage.com/image.jpg",
  "stock": 100,
  "category": "Electronics"
}
```

**Validation** (Zod):

- `name`: 1-200 chars
- `description`: 1-2000 chars
- `price`: Positive number
- `image`: Valid URL
- `stock`: Non-negative integer
- `category`: 1-100 chars

**Response**:

```json
{
  "success": true,
  "data": {
    "product": {
      /* created product */
    }
  }
}
```

**Status**: `201 Created`

**Cache Invalidation**: `products:*`

#### PUT /api/admin/products/[id]

Update existing product.

**Authentication**: Required (ADMIN)

**Parameters**:

- `id` (path): Product ID (7-char base62)

**Request Body**: Same as POST (all fields required)

**Cache Invalidation**: `products:*`, `product:{id}`

#### DELETE /api/admin/products/[id]

Delete product.

**Authentication**: Required (ADMIN)

**Parameters**:

- `id` (path): Product ID (7-char base62)

**Response**:

```json
{
  "success": true,
  "data": { "message": "Product deleted" }
}
```

**Cache Invalidation**: `products:*`, `product:{id}`

---

### Admin Orders

#### GET /api/admin/orders

Get all orders with items and products.

**Authentication**: Required (ADMIN)

**Cache**: 60s TTL (orders change frequently)

**Response**:

```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "Wx23yZa",
        "customerName": "John Doe",
        "customerEmail": "john@example.com",
        "totalAmount": 69.98,
        "status": "PENDING",
        "items": [
          /* order items with products */
        ],
        "createdAt": "2024-01-15T10:40:00.000Z"
      }
    ]
  }
}
```

**Sort**: Descending by `createdAt`

#### GET /api/admin/orders/[id]

Get single order details.

**Authentication**: Required (ADMIN)

**Parameters**:

- `id` (path): Order ID (7-char base62)

**Cache**: 30s TTL

**Errors**:

- `404`: Order not found

#### PATCH /api/admin/orders/[id]

Update order status.

**Authentication**: Required (ADMIN)

**Parameters**:

- `id` (path): Order ID (7-char base62)

**Request Body**:

```json
{
  "status": "PROCESSING"
}
```

**Valid Statuses**:

- `PENDING`
- `PROCESSING`
- `SHIPPED`
- `DELIVERED`
- `CANCELLED`

**Cache Invalidation**: `admin:orders:*`, `admin:order:{id}`

---

### Admin Users

#### GET /api/admin/users

Get all users.

**Authentication**: Required (ADMIN)

**Cache**: 120s TTL

**Response**:

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user-uuid-1234",
        "email": "user@example.com",
        "name": "User Name",
        "role": "CUSTOMER",
        "createdAt": "2024-01-10T08:00:00.000Z"
      }
    ]
  }
}
```

#### GET /api/admin/users/[id]

Get single user details.

**Authentication**: Required (ADMIN)

**Parameters**:

- `id` (path): User ID

**Errors**:

- `404`: User not found

#### PATCH /api/admin/users/[id]

Update user role.

**Authentication**: Required (ADMIN)

**Parameters**:

- `id` (path): User ID

**Request Body**:

```json
{
  "role": "ADMIN"
}
```

**Valid Roles**: `CUSTOMER`, `ADMIN`

**Cache Invalidation**: `admin:users:*`, `admin:user:{id}`

---

### File Upload

#### POST /api/upload

Upload image to Vercel Blob storage.

**Authentication**: Required (ADMIN)

**Content-Type**: `multipart/form-data`

**Request**:

```
Form field: file
```

**Validation**:

- File types: JPEG, PNG, GIF, WebP
- Max size: 5MB

**Response**:

```json
{
  "success": true,
  "data": {
    "url": "https://blob.vercel-storage.com/abc123.jpg",
    "pathname": "abc123.jpg",
    "contentType": "image/jpeg"
  }
}
```

**Example**:

```javascript
const formData = new FormData()
formData.append('file', fileInput.files[0])

const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData,
})
```

**Errors**:

- `400`: No file, invalid type, file too large
- `401`: Not authenticated
- `403`: Not admin

---

## Request/Response Formats

### Standard Success Response

```json
{
  "success": true,
  "data": {
    /* endpoint-specific data */
  }
}
```

### Standard Error Response

```json
{
  "success": false,
  "error": "Error message",
  "details": {
    "field": "Validation error for field"
  }
}
```

### Common HTTP Status Codes

- `200 OK`: Successful GET/PUT/PATCH/DELETE
- `201 Created`: Successful POST
- `400 Bad Request`: Validation error, business logic error
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Authenticated but insufficient permissions
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

---

## Error Handling

### Validation Errors (400)

Zod validation returns detailed field errors:

```json
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "name": "Name is required",
    "price": "Price must be positive",
    "email": "Invalid email address"
  }
}
```

### Authentication Errors

```json
{
  "success": false,
  "error": "Not authenticated"
}
```

**Status**: 401

### Authorization Errors

```json
{
  "success": false,
  "error": "Not authorized - Admin access required"
}
```

**Status**: 401 (admin endpoints)

### Business Logic Errors

```json
{
  "error": "Insufficient stock for Product Name"
}
```

**Status**: 400

---

## Rate Limiting

**Implementation**: Currently not implemented at API level

**Recommendations**:

- Use edge middleware for rate limiting
- Implement per-IP or per-user limits
- Consider tiered limits (public vs authenticated)

**Example Strategy**:

- Public endpoints: 100 req/min per IP
- Admin endpoints: 1000 req/min per user
- Upload endpoint: 10 req/min per user

---

## Caching

### Cache Strategy

**Technology**: Redis with stampede prevention

**Pattern**: Stale-while-revalidate

- Serve cached data within TTL
- Serve stale data while refreshing in background
- Prevent cache stampede on expiry

### Cached Endpoints

| Endpoint                     | TTL  | Stale Time | HTTP Cache-Control                        |
| ---------------------------- | ---- | ---------- | ----------------------------------------- |
| `GET /api/products`          | 60s  | 10s        | `s-maxage=60, stale-while-revalidate=120` |
| `GET /api/admin/orders`      | 60s  | 10s        | None                                      |
| `GET /api/admin/orders/[id]` | 30s  | 5s         | None                                      |
| `GET /api/admin/users`       | 120s | 20s        | None                                      |

### Cache Invalidation

**Products**:

- `POST /api/admin/products`: Invalidates `products:*`
- `PUT /api/admin/products/[id]`: Invalidates `products:*`, `product:{id}`
- `DELETE /api/admin/products/[id]`: Invalidates `products:*`, `product:{id}`
- `POST /api/orders`: Invalidates `products:*`, `product:{id}` for ordered items

**Orders**:

- `POST /api/orders`: Invalidates `admin:orders:*`
- `PATCH /api/admin/orders/[id]`: Invalidates `admin:orders:*`, `admin:order:{id}`

**Pattern**: Wildcard invalidation (`products:*`) clears all matching keys

---

## Examples

### Fetch Products (JavaScript)

```javascript
// Simple fetch
const response = await fetch('/api/products')
const { data } = await response.json()

// With error handling
try {
  const response = await fetch('/api/products')
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error)
  }
  const { data } = await response.json()
  console.log(data.products)
} catch (error) {
  console.error('Failed to fetch products:', error)
}
```

### Add to Cart (JavaScript)

```javascript
const response = await fetch('/api/cart', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    productId: 'Mn56oPq',
    variantId: 'Kd93mNp',
    quantity: 2,
  }),
})

const { cart } = await response.json()
console.log('Cart updated:', cart)
```

### Create Order (curl)

```bash
curl -X POST https://your-domain.com/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Jane Smith",
    "customerEmail": "jane@example.com",
    "customerAddress": "456 Oak Ave, Town, State 54321",
    "items": [
      {
        "productId": "Mn56oPq",
        "variantId": "Kd93mNp",
        "quantity": 1
      }
    ]
  }'
```

### Admin: Create Product (JavaScript)

```javascript
// Requires authentication
const response = await fetch('/api/admin/products', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // Include session cookie
  body: JSON.stringify({
    name: 'New Product',
    description: 'Amazing new product',
    price: 49.99,
    image: 'https://blob.vercel-storage.com/image.jpg',
    stock: 50,
    category: 'Gadgets',
  }),
})

if (response.status === 401) {
  console.error('Not authenticated')
} else if (!response.ok) {
  const error = await response.json()
  console.error('Error:', error)
} else {
  const { data } = await response.json()
  console.log('Product created:', data.product)
}
```

### Admin: Update Order Status (curl)

```bash
# Requires authenticated session cookie
curl -X PATCH https://your-domain.com/api/admin/orders/clo1234567890 \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{"status": "SHIPPED"}'
```

### Upload Image (JavaScript)

```javascript
// Requires admin authentication
const formData = new FormData()
formData.append('file', fileInput.files[0])

const response = await fetch('/api/upload', {
  method: 'POST',
  credentials: 'include',
  body: formData,
})

const { data } = await response.json()
console.log('Image uploaded:', data.url)
```

---

## Additional Notes

### TypeScript Support

All types are defined across multiple files following feature-based organization:

- Core types: `src/lib/types.ts` — `Product`, `ProductVariant`, `Order`, `OrderItem`, `OrderStatus`, `Cart`, `CartItem`
- Validation schemas: `src/lib/validations/` (shared), `src/features/*/validations.ts` (feature-specific)
- API utilities: `src/lib/api-utils.ts` — `apiSuccess`, `apiError`, `handleApiError`
- The `src/lib/validations.ts` file is a backward-compat re-export shim

### Logging

All endpoints use structured logging:

- Business events: Order creation, status changes
- Errors: Full error context with stack traces
- Request metadata: Path, user, timestamp

### Database Transactions

Critical operations use Drizzle transactions:

- Order creation with stock updates
- Concurrent cart modifications
- Admin bulk operations

### Security

- SQL injection: Protected by Drizzle ORM
- XSS: No HTML rendering in API responses
- CSRF: Session cookies use SameSite=lax
- File uploads: Type and size validation
- Admin endpoints: Role-based access control
