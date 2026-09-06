# Contract: Customer Returns API

**Feature**: `018-self-service-returns` | **Audience**: authenticated customers

All routes are wrapped with `withApiLogging` from `src/lib/api-middleware.ts`, respond through
`apiSuccess` / `apiError` from `src/lib/api-utils.ts`, and route errors through
`handleApiError`. Request bodies are validated with Zod and rejected via
`handleValidationError`.

**Ownership is enforced server-side on every route** (FR-005, SC-005). The predicate is
`ReturnRequest.userId === session.user.id`, never a client-supplied identifier. A return
belonging to another customer returns **404**, not 403, so the endpoint does not confirm that
the identifier exists.

**Cache-Control**: `private, no-store` on every route in this file. These responses are
user-specific and must never be shared.

---

## `GET /api/orders/{orderId}/returns`

List the caller's returns for one order, plus the per-item returnable quantities needed to
render the request form.

### Authorization

`auth()` → 401 if absent. Order must be owned by the caller → 404 otherwise.

### Response `200`

```jsonc
{
  "success": true,
  "data": {
    "eligibility": {
      "isReturnable": true,
      "reason": null, // "NOT_DELIVERED" | "WINDOW_EXPIRED" | "FULLY_RETURNED" | "CATEGORY_EXCLUDED"
      "windowExpiresAt": "2026-08-15T00:00:00.000Z",
      "deliveredAt": "2026-08-08T00:00:00.000Z",
    },
    "items": [
      {
        "orderItemId": "a1B2c3D",
        "productId": "p9X8y7Z",
        "variantId": "v4K5l6M",
        "name": "Ceramic Mug — Large",
        "orderedQuantity": 3,
        "returnedQuantity": 1, // held by any non-REJECTED return
        "returnableQuantity": 2,
        "unitPrice": 499.0,
        "estimatedRefundPerUnit": 449.1, // net of allocated discount share
      },
    ],
    "returns": [
      {
        "id": "r7N8p9Q",
        "status": "REQUESTED",
        "reason": "DAMAGED",
        "refundAmount": 449.1,
        "decisionReason": null,
        "createdAt": "2026-08-09T10:00:00.000Z",
        "refund": null,
      },
    ],
  },
}
```

### Errors

| Status | Condition                                      |
| ------ | ---------------------------------------------- |
| `401`  | No session                                     |
| `404`  | Order does not exist or is not owned by caller |

---

## `POST /api/orders/{orderId}/returns`

Create a return request. **Idempotency is not implied** — a customer may hold several returns
against one order, each covering different quantities.

### Authorization

`auth()` → 401 if absent. Order must be owned by the caller → 404 otherwise.

### Request

```jsonc
{
  "reason": "DAMAGED", // DAMAGED | DEFECTIVE | WRONG_ITEM — damage categories only
  "customerNote": "Handle arrived cracked.",
  "items": [{ "orderItemId": "a1B2c3D", "quantity": 1 }],
  "evidenceIds": ["e1F2g3H"], // REQUIRED — at least one, at most five
}
```

Schema: `CreateReturnRequestSchema` — see [data-model.md](../data-model.md).

### Behaviour

Executed in a single transaction that locks the order row `FOR UPDATE`, so two concurrent
submissions cannot both consume the last returnable unit:

1. Re-read the order and its items under the lock.
2. Assert `status === 'DELIVERED'`, within window, category not excluded.
3. Assert each requested quantity ≤ returnable quantity **computed under the lock**.
4. Compute `refundableAmount` per item via `return-refund-calculator.ts`.
5. Assert the total ≤ the order's remaining refundable balance.
6. Insert `ReturnRequest` + `ReturnItem` rows, then set `returnRequestId` on the
   `ReturnEvidence` rows whose `id` is in `evidenceIds` **and** whose `userId` and `orderId`
   match the caller and the order. Non-matching ids are silently ignored, never rejected, so
   the endpoint cannot be used to probe for valid identifiers. **If no id survives that filter,
   the whole request is rejected with `400`** — evidence is mandatory and a caller must not be
   able to satisfy the requirement with ids it does not own.
7. Publish `order/return.status.changed` with `status: 'REQUESTED'`.
8. Invalidate `invalidateUserOrderCaches(userId)` and `invalidateAdminOrderCaches(orderId)`.

### Response `201`

```jsonc
{
  "success": true,
  "data": {
    "id": "r7N8p9Q",
    "status": "REQUESTED",
    "refundAmount": 449.1,
    "createdAt": "2026-08-09T10:00:00.000Z",
  },
}
```

The client renders the Instagram video prompt from this response (FR-019): the `id` is the
correlation key the customer must quote, and the destination URL is a build-time constant from
`src/lib/constants/store.ts`. **The URL is not returned by the API** — it is not per-request
data, and shipping it in every response would invite treating it as server-controlled when it is
not.

Whether the prompt renders at all is gated on the `returnVideoViaInstagram` Edge Config flag,
read server-side and passed down as a prop. When it is off the customer is directed to email the
video to `SUPPORT_EMAIL` instead, so the video instruction is never simply missing.

### Errors

| Status | Condition                                                                                                                     |
| ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `400`  | Zod validation failure; item not on this order; no evidence supplied, or none of the supplied ids is owned by the caller      |
| `401`  | No session                                                                                                                    |
| `404`  | Order does not exist or is not owned by caller                                                                                |
| `409`  | Order not `DELIVERED`; window expired; requested quantity exceeds returnable; refund total exceeds remaining captured balance |
| `413`  | Body exceeds `MAX_FORM_DATA_BODY_SIZE`                                                                                        |

`409` carries a machine-readable discriminator so the client can render the precise reason:

```jsonc
{
  "success": false,
  "error": "Return window has expired",
  "code": "WINDOW_EXPIRED",
}
```

---

## `POST /api/orders/{orderId}/returns/evidence`

Upload one evidence **image** and receive an identifier to attach to a subsequent return
request. Uploading is separated from creation so the customer can add images progressively
without holding an open transaction.

**Images only.** This endpoint does not accept video. The policy-mandated video is sent over
Instagram direct message and never touches this route — see [research.md](../research.md) R15.
A video upload attempt is rejected at the magic-byte check like any other disallowed type; the
client is responsible for turning that rejection into a "send it on Instagram instead" message
rather than a bare type error (spec US1 scenario 7).

**The uploaded row is created orphaned** — `ReturnEvidence.returnRequestId` is `NULL` until
`POST …/returns` attaches it. `userId` and `orderId` are set at upload time and carry ownership
and scope during that window; they are what make the per-order cap queryable without a parent
row to join through. See [data-model.md](../data-model.md) `ReturnEvidence`.

### Authorization

`auth()` → 401 if absent. Order must be owned by the caller → 404 otherwise.

### Request

`multipart/form-data` with a single `file` field.

### Validation (shared with `/api/upload` via `src/lib/upload-validation.ts`)

- `Content-Length` ≤ `MAX_FORM_DATA_BODY_SIZE` — currently a private const in
  `src/app/api/upload/route.ts`, moved to `src/lib/upload-constants.ts` as part of the extraction
- File size ≤ `MAX_FILE_SIZE` → `413`
- **Magic-byte** MIME detection restricted to JPEG, PNG, GIF, WebP → `400`. The declared
  `Content-Type` is never trusted. Video containers (MP4, MOV, WebM) are **not** in this list and
  are rejected here by design.
- At most 5 orphaned rows per (`userId`, `orderId`) → `409`

### Response `201`

```jsonc
{
  "success": true,
  "data": {
    "id": "e1F2g3H",
    "url": "https://<blob-host>/returns/e1F2g3H.jpg",
    "contentType": "image/jpeg",
    "provider": "vercel",
  },
}
```

The `url` always points at the blob provider's origin, never the application origin, so a
stored file cannot execute as same-origin script.

### Errors

| Status | Condition                                              |
| ------ | ------------------------------------------------------ |
| `400`  | Missing file; disallowed type by magic-byte inspection |
| `401`  | No session                                             |
| `404`  | Order not owned by caller                              |
| `409`  | Evidence count limit reached                           |
| `413`  | File or body too large                                 |

---

## `GET /api/returns/{returnId}`

Fetch one return with full detail.

### Authorization

`auth()` → 401 if absent. `ReturnRequest.userId === session.user.id` → 404 otherwise.

### Response `200`

```jsonc
{
  "success": true,
  "data": {
    "id": "r7N8p9Q",
    "orderId": "ORD1234567",
    "status": "REFUNDED",
    "reason": "DAMAGED",
    "customerNote": "Handle arrived cracked.",
    "decisionReason": "Damage confirmed from photos.",
    "refundAmount": 449.1,
    "createdAt": "2026-08-09T10:00:00.000Z",
    "decidedAt": "2026-08-09T14:00:00.000Z",
    "receivedAt": "2026-08-12T09:00:00.000Z",
    "items": [
      {
        "orderItemId": "a1B2c3D",
        "name": "Ceramic Mug — Large",
        "quantity": 1,
        "refundableAmount": 449.1,
      },
    ],
    "evidence": [
      { "id": "e1F2g3H", "url": "https://<blob-host>/returns/e1F2g3H.jpg" },
    ],
    "refund": {
      "amount": 449.1,
      "status": "PROCESSED",
      "processedAt": "2026-08-12T09:00:05.000Z",
    },
  },
}
```

`decisionReason` is exposed to the customer for rejected returns (FR-015, User Story 4). It is
admin-authored copy intended for the customer and must be written accordingly.

`refund` is `null` until a refund exists. `refund.status` of `FAILED` is **not** surfaced to
the customer as a failure — it renders as "processing" — because a gateway retry is an internal
operational concern and the customer's entitlement is unchanged.

### Errors

| Status | Condition                                           |
| ------ | --------------------------------------------------- |
| `401`  | No session                                          |
| `404`  | Return does not exist or is not owned by the caller |

---

## Fields Never Exposed

The customer serializer must omit these, which the admin serializer includes:

- `decidedById`, `receivedById` — internal staff identity
- `stockRestoredAt` — inventory operations
- `refundId`, `Refund.gatewayRefundId`, `Refund.errorMessage`, `Refund.paymentTransactionId`
- `ProductVariant.stock`, `ProductVariant.reservedStock`

Serialization goes through a dedicated `serializeCustomerReturn` in
`src/lib/serializers.ts` rather than spreading the row, so a future column addition cannot leak
by default.
