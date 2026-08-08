# Contract: Admin Returns API

**Feature**: `018-self-service-returns` | **Audience**: staff with `orders:returns`

Every route calls `checkAdminAuth` from `src/features/admin/services/admin-auth.ts` — inline
auth checks are prohibited by constitution Principle V. The result discriminates 401
(unauthenticated) from 403 (authenticated but unpermitted), and the route returns that status
verbatim.

**Cache-Control**: `private, no-store`.

---

## `GET /api/admin/returns`

The triage queue.

### Authorization

`checkAdminAuth('orders:returns')`

### Query parameters

| Param    | Type            | Default     | Notes                                    |
| -------- | --------------- | ----------- | ---------------------------------------- |
| `status` | `ReturnStatus`  | `REQUESTED` | Repeatable; omit for all                 |
| `search` | `string`        | —           | Matches order id, customer email or name |
| `cursor` | `string`        | —           | Opaque; matches existing pagination      |
| `limit`  | `integer` 1–100 | `20`        |                                          |

Backed by the `ReturnRequest_status_createdAt_idx` composite index, which is why the default
sort is `status` then `createdAt DESC`.

### Response `200`

```jsonc
{
  "success": true,
  "data": {
    "returns": [
      {
        "id": "r7N8p9Q",
        "orderId": "ORD1234567",
        "status": "REQUESTED",
        "reason": "DAMAGED",
        "customerNote": "Handle arrived cracked.",
        "customerName": "A. Sharma",
        "customerEmail": "a.sharma@example.com",
        "paymentProvider": "RAZORPAY",
        "refundAmount": 449.1,
        "createdAt": "2026-08-09T10:00:00.000Z",
        "items": [
          {
            "orderItemId": "a1B2c3D",
            "variantId": "v4K5l6M",
            "name": "Ceramic Mug — Large",
            "quantity": 1,
            "refundableAmount": 449.1,
          },
        ],
        "evidence": [
          { "id": "e1F2g3H", "url": "https://<blob-host>/returns/e1F2g3H.jpg" },
        ],
        "refund": null,
      },
    ],
    "nextCursor": "…",
  },
}
```

`paymentProvider` is included because it determines which settlement path the UI must offer:
`COD` returns show "mark settled", everything else shows the gateway refund flow.

### Errors

| Status | Condition                                |
| ------ | ---------------------------------------- |
| `401`  | Not authenticated                        |
| `403`  | Authenticated but lacks `orders:returns` |

---

## `PATCH /api/admin/returns/{returnId}`

Advance a return through its lifecycle. One endpoint, discriminated by `action`, because every
variant shares the same lock, transition check, audit write, and notification dispatch.

### Authorization

| Action                           | Permission       | Rationale                     |
| -------------------------------- | ---------------- | ----------------------------- |
| `approve`, `reject`, `receive`   | `orders:returns` | Triage and inventory movement |
| `refund`                         | `orders:refund`  | Moves money                   |
| `settle` (COD manual settlement) | `orders:refund`  | Moves money                   |

`refund` and `settle` are gated more strictly than triage because they move money, matching the
existing `orders:refund` grant on admin refunds. `receive` moves inventory only.

### Request

```jsonc
{ "action": "approve", "decisionReason": "Damage confirmed from photos." }
```

```jsonc
{ "action": "reject", "decisionReason": "Item shows use beyond inspection." }
```

```jsonc
{ "action": "receive" }
```

```jsonc
{ "action": "refund" }
```

```jsonc
{ "action": "settle" }
```

Schema: `DecideReturnSchema` (discriminated union) — see [data-model.md](../data-model.md).
`decisionReason` is **required on both approve and reject** (FR-008).

### Transition matrix

Restates [research.md](../research.md) R12, which is authoritative.

| Action    | Required current state  | Resulting state                              | Side effects                                         |
| --------- | ----------------------- | -------------------------------------------- | ---------------------------------------------------- |
| `approve` | `REQUESTED`             | `APPROVED`                                   | Audit, notification                                  |
| `reject`  | `REQUESTED`, `APPROVED` | `REJECTED`                                   | Audit, notification, held quantity released          |
| `receive` | `APPROVED`              | `RECEIVED`                                   | **Restock**, audit, notification                     |
| `refund`  | `RECEIVED`              | `REFUNDED`, or `RECEIVED` on gateway failure | **Refund**, audit, notification                      |
| `settle`  | `REFUNDED` (COD only)   | `REFUNDED`                                   | Flips the linked refund `PENDING → PROCESSED`, audit |

Any other combination returns `409` with the current state in the payload, which is what
serialises two administrators clicking simultaneously.

**`receive` and `refund` are deliberately separate.** Collapsing them would leave a
gateway-rejected return stranded at `RECEIVED` with no action accepting that state as input.
The split gives the failure a retry path and aligns the permission boundary with the money
boundary.

### `receive` behaviour

Executed in one transaction that re-reads the return row `FOR UPDATE`:

1. Assert the transition is legal.
2. `restockReturnItems(tx, returnRequest)` — claims `stockRestoredAt` with a guarded update and
   increments `ProductVariant.stock` per item. Returns `false` and skips if already claimed.
   `reservedStock` is never touched.
3. Set `receivedAt`, `receivedById`, status `RECEIVED`.
4. `recordAdminAuditLog({ entity: 'return', entityId, action: 'receive', diff: { restocked } })`.
5. Publish `order/return.status.changed`.
6. `invalidateAdminOrderCaches(orderId, userId)` and `invalidateUserOrderCaches(userId)`.

No money moves. The refund is a separate, separately-permissioned action.

### `refund` behaviour

Executed in one transaction that re-reads the return row `FOR UPDATE`:

1. Assert the current state is `RECEIVED`.
2. If `refundId IS NOT NULL`, return `200` unchanged — the refund already exists and the UNIQUE
   constraint means it cannot be reissued.
3. Issue the refund, branching on `order.paymentProvider`:
   - **Gateway providers**: `refundOrder({ orderId, amount: refundAmount, reason, actor, auditAction: 'return_refund', returnRequestId })`, then set `ReturnRequest.refundId`.
   - **COD**: insert a refund row directly with `status: 'PENDING'`, `paymentTransactionId: null`, `gatewayRefundId: null`, reason prefixed `MANUAL_SETTLEMENT:`. The gateway is **not** called — `codGateway.refund()` throws by design.
4. Set status `REFUNDED`.
5. Audit, notify, invalidate caches as above.

**Restock and refund are independently idempotent** (FR-012): the restock claim is
`stockRestoredAt`, the refund claim is the UNIQUE `refundId`. A retry resumes at the first
unclaimed step rather than repeating a completed one.

**Gateway rejection**: `refundOrder` throws `RefundRequestError` (502). The status change rolls
back, but the `FAILED` refund row persists by design in `refundOrder`'s own inner transaction.
The return stays at `RECEIVED` with `refundId` unset, `Refund.errorMessage` surfaces to admins,
and the administrator re-issues `refund` once the gateway problem is resolved (spec User Story
3, scenario 4).

### Response `200`

```jsonc
{
  "success": true,
  "data": {
    "id": "r7N8p9Q",
    "status": "REFUNDED",
    "restocked": true,
    "refund": { "id": "f3R4s5T", "amount": 449.1, "status": "PROCESSED" },
  },
}
```

### Errors

| Status | Condition                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------ |
| `400`  | Zod failure; `decisionReason` missing on approve or reject                                       |
| `401`  | Not authenticated                                                                                |
| `403`  | Lacks the permission required for the action — `orders:refund` for refund/settle                 |
| `404`  | Return does not exist                                                                            |
| `409`  | Illegal transition for the current state; `settle` on a non-COD order                            |
| `502`  | Payment gateway rejected the refund — the return stays at `RECEIVED` and `refund` may be retried |

---

## `GET /api/admin/export/returns`

CSV export (FR-017), built with `streamCsvResponse` and `batchedCsvRows` from
`src/features/admin/services/admin-csv.ts` so the response streams rather than buffering.

### Authorization

`checkAdminAuth('orders:returns')`

### Columns

```text
id, orderId, customerEmail, status, reason, decisionReason,
itemCount, totalQuantity, refundAmount, refundStatus,
createdAt, decidedAt, receivedAt
```

Column order is fixed. New columns append to the end so existing downstream consumers do not
break — the same contract the orders export already honours.

### Response `200`

`text/csv; charset=utf-8` with
`Content-Disposition: attachment; filename="returns-<ISO date>.csv"`.

---

## Inngest Event

### `order/return.status.changed`

Declared in `src/features/orders/inngest/events.ts` with `eventType(...)`, matching the existing
`orderStatusChanged` pattern.

```ts
export const returnStatusChanged = eventType('order/return.status.changed', {
  schema: z.object({
    returnId: z.string(),
    orderId: z.string(),
    userId: z.string(),
    customerEmail: z.string(),
    status: z.enum(RETURN_STATUSES),
    decisionReason: z.string().nullable(),
    refundAmount: z.number().nullable(),
  }),
})
```

Consumed by `sendReturnStatusEmailFunction`, added to
**`src/features/orders/inngest/emails.ts`** alongside the three existing order email functions,
and registered in `src/lib/inngest/registry.ts`:

- `idempotency: 'event.data.returnId + "-" + event.data.status'` — a replayed event for the
  same state cannot double-send.
- `retries: EMAIL_FUNCTION_RETRIES`, `onFailure: recordEmailFailure` — matching
  `sendOrderStatusEmailFunction`. Both symbols are **module-private** to `emails.ts`, which is
  why the function belongs in that file rather than in `src/lib/inngest/functions/`.
- Delivery via `deliverReturnStatusNotification`, which resolves preferences through
  `resolveNotificationRecipient` and gates each channel on
  `isChannelEnabled(preferences, 'transactional', channel)`, satisfying FR-014 and SC-006.

Published through `dispatchWorkflowEvent` with an inline `fallback`, so notification still
reaches the customer when Inngest is unconfigured — the same degradation the refund
notification already relies on.
