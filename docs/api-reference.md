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

**Public Endpoints**: No authentication required
- `/api/products` (GET)
- `/api/products/[id]` (GET)
- `/api/cart` (GET, POST, DELETE)
- `/api/cart/items/[id]` (PATCH, DELETE)
- `/api/orders` (POST)

**Protected Endpoints**: Require ADMIN role
- `/api/admin/*` (all methods)
- `/api/upload` (POST)

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
        "id": "clx1234567890",
        "name": "Product Name",
        "description": "Product description",
        "price": 29.99,
        "image": "https://blob.vercel-storage.com/image.jpg",
        "stock": 100,
        "category": "Electronics",
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z",
        "variations": [
          {
            "id": "clv1234567890",
            "name": "Red",
            "designName": "red-variant",
            "image": "https://blob.vercel-storage.com/red.jpg",
            "priceModifier": 5.00,
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
const response = await fetch('/api/products');
const { data } = await response.json();
console.log(data.products);
```

#### GET /api/products/[id]
Retrieve single product by ID.

**Parameters**:
- `id` (path): Product CUID

**Response**: Same structure as single product above

**Errors**:
- `404`: Product not found

---

### Cart

#### GET /api/cart
Get cart for current user/session. Returns null if no cart exists.

**Authentication**: Optional (uses session for logged-in users, cookie for guests)

**Response**:
```json
{
  "cart": {
    "id": "clc1234567890",
    "userId": "clu1234567890",
    "sessionId": null,
    "items": [
      {
        "id": "cli1234567890",
        "productId": "clp1234567890",
        "variationId": "clv1234567890",
        "quantity": 2,
        "product": {
          "id": "clp1234567890",
          "name": "Product Name",
          "price": 29.99,
          "image": "https://...",
          "stock": 100
        },
        "variation": {
          "id": "clv1234567890",
          "name": "Red",
          "priceModifier": 5.00,
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
  "productId": "clp1234567890",
  "variationId": "clv1234567890",
  "quantity": 2
}
```

**Response**: Returns updated cart (same structure as GET)

**Status**: `201 Created`

**Cookies**: Sets `cart_session` cookie for guest users (30-day expiry)

**Errors**:
- `400`: Invalid input, insufficient stock
- `404`: Product or variation not found

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
- `id` (path): Cart item CUID

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
- `id` (path): Cart item CUID

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
      "productId": "clp1234567890",
      "variationId": "clv1234567890",
      "quantity": 2
    }
  ]
}
```

**Response**:
```json
{
  "order": {
    "id": "clo1234567890",
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "customerAddress": "123 Main St, City, State 12345",
    "totalAmount": 69.98,
    "status": "PENDING",
    "items": [
      {
        "id": "cloi1234567890",
        "productId": "clp1234567890",
        "variationId": "clv1234567890",
        "quantity": 2,
        "price": 34.99,
        "product": { /* full product object */ }
      }
    ],
    "createdAt": "2024-01-15T10:40:00.000Z",
    "updatedAt": "2024-01-15T10:40:00.000Z"
  }
}
```

**Status**: `201 Created`

**Business Logic**:
- Validates all products/variations exist
- Checks stock availability
- Calculates total with variation price modifiers
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
    "items": [{"productId": "clp123", "quantity": 2}]
  }'
```

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
    "product": { /* created product */ }
  }
}
```

**Status**: `201 Created`

**Cache Invalidation**: `products:*`

#### PUT /api/admin/products/[id]
Update existing product.

**Authentication**: Required (ADMIN)

**Parameters**:
- `id` (path): Product CUID

**Request Body**: Same as POST (all fields required)

**Cache Invalidation**: `products:*`, `product:{id}`

#### DELETE /api/admin/products/[id]
Delete product.

**Authentication**: Required (ADMIN)

**Parameters**:
- `id` (path): Product CUID

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
        "id": "clo1234567890",
        "customerName": "John Doe",
        "customerEmail": "john@example.com",
        "totalAmount": 69.98,
        "status": "PENDING",
        "items": [ /* order items with products */ ],
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
- `id` (path): Order CUID

**Cache**: 30s TTL

**Errors**:
- `404`: Order not found

#### PATCH /api/admin/orders/[id]
Update order status.

**Authentication**: Required (ADMIN)

**Parameters**:
- `id` (path): Order CUID

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
        "id": "clu1234567890",
        "email": "user@example.com",
        "name": "User Name",
        "role": "USER",
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
- `id` (path): User CUID

**Errors**:
- `404`: User not found

#### PATCH /api/admin/users/[id]
Update user role.

**Authentication**: Required (ADMIN)

**Parameters**:
- `id` (path): User CUID

**Request Body**:
```json
{
  "role": "ADMIN"
}
```

**Valid Roles**: `USER`, `ADMIN`

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
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData,
});
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
  "data": { /* endpoint-specific data */ }
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

| Endpoint | TTL | Stale Time | HTTP Cache-Control |
|----------|-----|------------|-------------------|
| `GET /api/products` | 60s | 10s | `s-maxage=60, stale-while-revalidate=120` |
| `GET /api/admin/orders` | 60s | 10s | None |
| `GET /api/admin/orders/[id]` | 30s | 5s | None |
| `GET /api/admin/users` | 120s | 20s | None |

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
const response = await fetch('/api/products');
const { data } = await response.json();

// With error handling
try {
  const response = await fetch('/api/products');
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }
  const { data } = await response.json();
  console.log(data.products);
} catch (error) {
  console.error('Failed to fetch products:', error);
}
```

### Add to Cart (JavaScript)
```javascript
const response = await fetch('/api/cart', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    productId: 'clp1234567890',
    variationId: 'clv1234567890',
    quantity: 2
  })
});

const { cart } = await response.json();
console.log('Cart updated:', cart);
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
        "productId": "clp1234567890",
        "variationId": "clv1234567890",
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
    category: 'Gadgets'
  })
});

if (response.status === 401) {
  console.error('Not authenticated');
} else if (!response.ok) {
  const error = await response.json();
  console.error('Error:', error);
} else {
  const { data } = await response.json();
  console.log('Product created:', data.product);
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
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('/api/upload', {
  method: 'POST',
  credentials: 'include',
  body: formData
});

const { data } = await response.json();
console.log('Image uploaded:', data.url);
```

---

## Additional Notes

### TypeScript Support
All types are defined in `/lib/types.ts`:
- `Product`, `ProductVariation`
- `Order`, `OrderItem`, `OrderStatus`
- `Cart`, `CartItem`
- `CreateOrderInput`, `AddToCartInput`

### Logging
All endpoints use structured logging:
- Business events: Order creation, status changes
- Errors: Full error context with stack traces
- Request metadata: Path, user, timestamp

### Database Transactions
Critical operations use Prisma transactions:
- Order creation with stock updates
- Concurrent cart modifications
- Admin bulk operations

### Security
- SQL injection: Protected by Prisma ORM
- XSS: No HTML rendering in API responses
- CSRF: Session cookies use SameSite=lax
- File uploads: Type and size validation
- Admin endpoints: Role-based access control
