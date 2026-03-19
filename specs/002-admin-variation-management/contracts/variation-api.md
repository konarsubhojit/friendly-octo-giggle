# API Contract: Variation Management

**Feature**: 002-admin-variation-management  
**Base Path**: `/api/admin/products/[id]/variations`  
**Authentication**: All endpoints require authenticated admin session (`role === "ADMIN"`)

---

## POST `/api/admin/products/[id]/variations`

**Purpose**: Create a new variation for a product

### Request

```json
{
  "name": "Red - Large",
  "designName": "Classic Logo",
  "priceModifier": 2.5,
  "stock": 100,
  "image": "https://blob.vercel-storage.com/variation-primary.jpg",
  "images": [
    "https://blob.vercel-storage.com/variation-angle1.jpg",
    "https://blob.vercel-storage.com/variation-angle2.jpg"
  ]
}
```

| Field           | Type     | Required | Constraints                             |
| --------------- | -------- | -------- | --------------------------------------- |
| `name`          | string   | YES      | 1–100 chars                             |
| `designName`    | string   | YES      | 1–100 chars                             |
| `priceModifier` | number   | YES      | Any number; effective price must be > 0 |
| `stock`         | integer  | YES      | ≥ 0                                     |
| `image`         | string   | NO       | Valid URL                               |
| `images`        | string[] | NO       | Valid URLs, max 10                      |

### Response — 201 Created

```json
{
  "success": true,
  "data": {
    "variation": {
      "id": "aBc1234",
      "productId": "xYz5678",
      "name": "Red - Large",
      "designName": "Classic Logo",
      "image": "https://blob.vercel-storage.com/variation-primary.jpg",
      "images": ["https://..."],
      "priceModifier": 2.5,
      "stock": 100,
      "createdAt": "2026-03-19T10:00:00.000Z",
      "updatedAt": "2026-03-19T10:00:00.000Z"
    }
  }
}
```

### Error Responses

| Status | Condition                 | Body                                                                                           |
| ------ | ------------------------- | ---------------------------------------------------------------------------------------------- |
| 400    | Validation error          | `{ "success": false, "error": "Validation failed", "details": [...] }`                         |
| 400    | Effective price ≤ 0       | `{ "success": false, "error": "Effective price (base + modifier) must be greater than zero" }` |
| 400    | Max 25 variations reached | `{ "success": false, "error": "Maximum of 25 variations per product reached" }`                |
| 401    | Not authenticated         | `{ "success": false, "error": "Authentication required" }`                                     |
| 403    | Not admin                 | `{ "success": false, "error": "Admin access required" }`                                       |
| 404    | Product not found         | `{ "success": false, "error": "Product not found" }`                                           |
| 409    | Duplicate name            | `{ "success": false, "error": "A variation with this name already exists for this product" }`  |

---

## GET `/api/admin/products/[id]/variations`

**Purpose**: List all active (non-deleted) variations for a product

### Request

No body. Optional query params:

| Param            | Type | Default | Description                        |
| ---------------- | ---- | ------- | ---------------------------------- |
| (none currently) | —    | —       | May add pagination later if needed |

### Response — 200 OK

```json
{
  "success": true,
  "data": {
    "variations": [
      {
        "id": "aBc1234",
        "productId": "xYz5678",
        "name": "Red - Large",
        "designName": "Classic Logo",
        "image": "https://...",
        "images": ["https://..."],
        "priceModifier": 2.5,
        "stock": 100,
        "createdAt": "2026-03-19T10:00:00.000Z",
        "updatedAt": "2026-03-19T10:00:00.000Z"
      }
    ],
    "count": 1
  }
}
```

### Error Responses

| Status | Condition         | Body                                                       |
| ------ | ----------------- | ---------------------------------------------------------- |
| 401    | Not authenticated | `{ "success": false, "error": "Authentication required" }` |
| 403    | Not admin         | `{ "success": false, "error": "Admin access required" }`   |
| 404    | Product not found | `{ "success": false, "error": "Product not found" }`       |

---

## PUT `/api/admin/products/[id]/variations/[variationId]`

**Purpose**: Update an existing variation

### Request

All fields optional (partial update):

```json
{
  "name": "Blue - Medium",
  "stock": 50
}
```

| Field           | Type           | Required | Constraints                 |
| --------------- | -------------- | -------- | --------------------------- |
| `name`          | string         | NO       | 1–100 chars                 |
| `designName`    | string         | NO       | 1–100 chars                 |
| `priceModifier` | number         | NO       | Effective price must be > 0 |
| `stock`         | integer        | NO       | ≥ 0                         |
| `image`         | string \| null | NO       | Valid URL or null to clear  |
| `images`        | string[]       | NO       | Valid URLs, max 10          |

### Response — 200 OK

```json
{
  "success": true,
  "data": {
    "variation": {
      "id": "aBc1234",
      "productId": "xYz5678",
      "name": "Blue - Medium",
      "designName": "Classic Logo",
      "image": "https://...",
      "images": ["https://..."],
      "priceModifier": 2.5,
      "stock": 50,
      "createdAt": "2026-03-19T10:00:00.000Z",
      "updatedAt": "2026-03-19T10:30:00.000Z"
    }
  }
}
```

### Error Responses

| Status | Condition           | Body                                                                                           |
| ------ | ------------------- | ---------------------------------------------------------------------------------------------- |
| 400    | Validation error    | `{ "success": false, "error": "Validation failed", "details": [...] }`                         |
| 400    | Effective price ≤ 0 | `{ "success": false, "error": "Effective price (base + modifier) must be greater than zero" }` |
| 401    | Not authenticated   | `{ "success": false, "error": "Authentication required" }`                                     |
| 403    | Not admin           | `{ "success": false, "error": "Admin access required" }`                                       |
| 404    | Product not found   | `{ "success": false, "error": "Product not found" }`                                           |
| 404    | Variation not found | `{ "success": false, "error": "Variation not found" }`                                         |
| 409    | Duplicate name      | `{ "success": false, "error": "A variation with this name already exists for this product" }`  |

---

## DELETE `/api/admin/products/[id]/variations/[variationId]`

**Purpose**: Soft-delete a variation (sets `deletedAt` timestamp)

### Request

No body.

### Response — 200 OK

```json
{
  "success": true,
  "data": {
    "message": "Variation soft-deleted successfully",
    "id": "aBc1234"
  }
}
```

### Error Responses

| Status | Condition           | Body                                                       |
| ------ | ------------------- | ---------------------------------------------------------- |
| 401    | Not authenticated   | `{ "success": false, "error": "Authentication required" }` |
| 403    | Not admin           | `{ "success": false, "error": "Admin access required" }`   |
| 404    | Product not found   | `{ "success": false, "error": "Product not found" }`       |
| 404    | Variation not found | `{ "success": false, "error": "Variation not found" }`     |

---

## Shared Response Shape

All endpoints follow the existing project convention from `lib/api-utils.ts`:

**Success**: `apiSuccess({ variation })` or `apiSuccess({ variations, count })`  
**Error**: `apiError("message", statusCode)` or `handleApiError(error)`  
**Validation**: `handleValidationError(zodError)`

## Image Upload

Variation images are not uploaded through the variation endpoints. Images are uploaded separately via the existing `POST /api/upload` endpoint (which returns a URL), and the URL is then passed in the variation create/update request body.
