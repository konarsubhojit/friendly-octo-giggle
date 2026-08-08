# Phase 1 Data Model: Customer Self-Service Returns

**Feature**: `018-self-service-returns` | **Date**: 2026-08-08
**Source of truth**: `src/lib/schema.ts` → generated migration `drizzle/0017_self_service_returns.sql`

All new tables follow the repository conventions verified in `src/lib/schema.ts`: PascalCase
physical table names, camelCase quoted columns, `varchar(7)` Base62 primary keys from
`generateShortId()`, `money(...)` for monetary columns (`numeric(12,2)`), and
`timestamp(..., { mode: 'date' })` for temporal columns.

---

## New Enum

### `ReturnStatus`

```ts
export const returnStatusEnum = pgEnum('ReturnStatus', [
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'RECEIVED',
  'REFUNDED',
])
```

Transition rules live in `src/features/orders/services/return-state-machine.ts`; see
[research.md](./research.md) R12, which is the **authoritative** definition. `RECEIVED` and
`REFUNDED` are distinct states reached by distinct actions — the enum stores state, the
transition table enforces reachability.

### `ReturnReason`

```ts
export const returnReasonEnum = pgEnum('ReturnReason', [
  'DAMAGED', // damaged in transit
  'DEFECTIVE', // faulty on arrival
  'WRONG_ITEM', // not the item that was ordered
])
```

Scoped to damage categories by the **Option B** decision ([research.md](./research.md) R1).
`CHANGED_MIND`, `SIZE_OR_FIT`, and `NOT_AS_DESCRIBED` are deliberately absent — the published
policy permits returns only for items received in damaged condition.

> Adding a non-damage reason later is a `ALTER TYPE ... ADD VALUE` migration plus a policy
> amendment. The enum is the enforcement point, so widening it without the amendment would
> silently put the product back out of line with the accepted terms.

---

## New Tables

### `ReturnRequest`

One customer-initiated request against exactly one order.

| Column            | Type           | Constraints                                             | Notes                                             |
| ----------------- | -------------- | ------------------------------------------------------- | ------------------------------------------------- |
| `id`              | `varchar(7)`   | PK, `$defaultFn(generateShortId)`                       |                                                   |
| `orderId`         | `varchar(10)`  | NOT NULL, FK → `Order.id` `ON DELETE CASCADE`           | Order IDs are `varchar(10)`, not 7                |
| `userId`          | `text`         | NOT NULL, FK → `User.id` `ON DELETE CASCADE`            | Denormalised for the ownership check (FR-005)     |
| `status`          | `ReturnStatus` | NOT NULL, DEFAULT `'REQUESTED'`                         |                                                   |
| `reason`          | `ReturnReason` | NOT NULL                                                | Customer-selected, from the defined set (FR-002)  |
| `customerNote`    | `text`         | NULL                                                    | Free text, max 1000 chars enforced by Zod         |
| `decisionReason`  | `text`         | NULL                                                    | Required on approve and reject (FR-008)           |
| `decidedById`     | `text`         | NULL, FK → `User.id` `ON DELETE SET NULL`               | Acting administrator                              |
| `decidedAt`       | `timestamp`    | NULL                                                    |                                                   |
| `receivedById`    | `text`         | NULL, FK → `User.id` `ON DELETE SET NULL`               |                                                   |
| `receivedAt`      | `timestamp`    | NULL                                                    |                                                   |
| `stockRestoredAt` | `timestamp`    | NULL                                                    | **Idempotency claim for restock** (R8)            |
| `refundId`        | `varchar(7)`   | NULL, **UNIQUE**, FK → `Refund.id` `ON DELETE SET NULL` | **Idempotency claim for refund** (R9)             |
| `refundAmount`    | `money`        | NOT NULL, DEFAULT `0`                                   | Frozen total, sum of item amounts + shipping (D3) |
| `createdAt`       | `timestamp`    | NOT NULL, DEFAULT `now()`                               |                                                   |
| `updatedAt`       | `timestamp`    | NOT NULL, DEFAULT `now()`                               |                                                   |

**Indexes** (FR-016):

- `ReturnRequest_orderId_idx` on (`orderId`)
- `ReturnRequest_userId_idx` on (`userId`)
- `ReturnRequest_status_idx` on (`status`)
- `ReturnRequest_status_createdAt_idx` on (`status`, `createdAt`) — the queue's default sort
- `ReturnRequest_refundId_key` UNIQUE on (`refundId`)

**Checks**:

- `ReturnRequest_refundAmount_non_negative`: `"refundAmount" >= 0`

**Why `userId` is denormalised**: FR-005 requires an ownership check on every read and mutation.
Joining through `Order` on every request would make the hot path a two-table read; carrying the
owner directly lets the ownership predicate be a single indexed equality. It is written once at
creation from `orders.userId` and never updated.

---

### `ReturnItem`

A requested quantity of exactly one order item.

| Column             | Type         | Constraints                                           | Notes                                              |
| ------------------ | ------------ | ----------------------------------------------------- | -------------------------------------------------- |
| `id`               | `varchar(7)` | PK, `$defaultFn(generateShortId)`                     |                                                    |
| `returnRequestId`  | `varchar(7)` | NOT NULL, FK → `ReturnRequest.id` `ON DELETE CASCADE` |                                                    |
| `orderItemId`      | `varchar(7)` | NOT NULL, FK → `OrderItem.id` `ON DELETE CASCADE`     |                                                    |
| `variantId`        | `varchar(7)` | NOT NULL, FK → `ProductVariant.id`                    | Snapshotted so restock never re-resolves (R7)      |
| `quantity`         | `integer`    | NOT NULL                                              |                                                    |
| `refundableAmount` | `money`      | NOT NULL                                              | Frozen at request time, net of discount share (D3) |

**Indexes**:

- `ReturnItem_returnRequestId_idx` on (`returnRequestId`)
- `ReturnItem_orderItemId_idx` on (`orderItemId`)

**Uniques**:

- `ReturnItem_returnRequestId_orderItemId_key` UNIQUE on (`returnRequestId`, `orderItemId`) —
  one line per order item per return, so quantity is unambiguous

**Checks**:

- `ReturnItem_quantity_positive`: `quantity > 0`
- `ReturnItem_refundableAmount_non_negative`: `"refundableAmount" >= 0`

**Why `variantId` is snapshotted**: restock must credit the variant that was actually sold.
Re-reading `OrderItem.variantId` at receive time would be equivalent today, but snapshotting
makes `restockReturnItems` a pure function of the return's own rows and removes a join from the
transaction that holds the restock claim.

---

### `ReturnEvidence`

An uploaded image, initially orphaned and later attached to a return request.

| Column            | Type          | Constraints                                           | Notes                                        |
| ----------------- | ------------- | ----------------------------------------------------- | -------------------------------------------- |
| `id`              | `varchar(7)`  | PK, `$defaultFn(generateShortId)`                     |                                              |
| `returnRequestId` | `varchar(7)`  | **NULL**, FK → `ReturnRequest.id` `ON DELETE CASCADE` | Null until the return is created — see below |
| `userId`          | `text`        | NOT NULL, FK → `User.id` `ON DELETE CASCADE`          | Owner of the orphaned upload                 |
| `orderId`         | `varchar(10)` | NOT NULL, FK → `Order.id` `ON DELETE CASCADE`         | Scopes the per-order upload cap              |
| `url`             | `text`        | NOT NULL                                              | Blob-provider origin, never the app origin   |
| `pathname`        | `text`        | NOT NULL                                              | Provider-relative path                       |
| `contentType`     | `text`        | NULL                                                  | As returned by `uploadImage`                 |
| `provider`        | `text`        | NOT NULL                                              | `'vercel'` or `'azure'`                      |
| `createdAt`       | `timestamp`   | NOT NULL, DEFAULT `now()`                             |                                              |

**Indexes**:

- `ReturnEvidence_returnRequestId_idx` on (`returnRequestId`)
- `ReturnEvidence_userId_orderId_idx` on (`userId`, `orderId`) — serves the orphan cap query

**Why `returnRequestId` is nullable**: evidence is uploaded **before** the return exists.
The customer uploads images, receives their ids, and passes those ids as `evidenceIds` when
submitting the return. A `NOT NULL` foreign key would make that sequence impossible — the row
could not be inserted because its parent does not yet exist. `userId` and `orderId` carry
ownership and scope during the orphaned window, which is also what makes the 5-upload cap
queryable without a parent to join through.

**Attachment**: `createReturnRequest` sets `returnRequestId` on exactly those rows whose `id`
is in `evidenceIds` **and** whose `userId` and `orderId` match the caller and the order. An id
belonging to another customer is silently ignored rather than erroring, so the endpoint cannot
be used to probe for valid identifiers.

**Cap**: at most 5 rows per (`userId`, `orderId`) with `returnRequestId IS NULL`, enforced in
the service layer (R11).

**Orphan cleanup**: rows still null after 24 hours are abandoned uploads. Cleanup is **out of
scope** for this feature — the volume is negligible and a sweeper is speculative work
(Principle VII). Recorded here so the growth is a known, accepted cost rather than a surprise.

---

## Modifications to Existing Tables

### M1 — `Order.deliveredAt` (new column)

```ts
deliveredAt: timestamp('deliveredAt', { mode: 'date' }),
```

**Why**: The return window is measured from delivery, not order creation (spec Edge Cases).
`orders` currently records only `status` and `updatedAt`; `updatedAt` shifts on any later
mutation and cannot serve as a delivery date.

**Set by**: `PATCH /api/admin/orders/[id]` when the status transition target is `DELIVERED`,
in the same statement that writes `status`.

**Backfill**: The migration sets `deliveredAt = "updatedAt"` for rows already at
`status = 'DELIVERED'`. This is an approximation and must be stated in a migration comment —
for historical orders the window is computed from the last mutation rather than true delivery.

**Index**: `Order_deliveredAt_idx` on (`deliveredAt`) — supports window-expiry reporting.

---

### M2 — `Refund.returnRequestId` (new column)

```ts
returnRequestId: varchar('returnRequestId', { length: 7 })
  .references(() => returnRequests.id, { onDelete: 'set null' }),
```

**Why**: FR-010 requires the refund to be linked to the return that caused it. The link is
recorded on both sides — `Refund.returnRequestId` for refund-side reporting and reconciliation,
`ReturnRequest.refundId` (UNIQUE) as the idempotency guard. The unique constraint lives on the
return side because that is the side being guarded against double-issue.

**Index**: `Refund_returnRequestId_idx` on (`returnRequestId`)

**Nullable**: admin-initiated refunds unrelated to a return keep this `NULL`, which is the
existing and unchanged behaviour.

---

### M3 — `Refund.reason` semantics (no schema change)

COD manual settlements write `reason` with a `MANUAL_SETTLEMENT:` prefix so they are
distinguishable in reporting without a new column. Documented here because the convention is
load-bearing for R5.

---

### M4 — `Refund.paymentTransactionId` becomes nullable

```diff
- paymentTransactionId: text('paymentTransactionId').notNull(),
+ paymentTransactionId: text('paymentTransactionId'),
```

**Why**: COD orders have no captured gateway transaction, and `codGateway.refund()` throws by
design ([research.md](./research.md) R5). The column is read only when reconciling gateway
webhooks, which never fire for COD, so relaxing it is safe.

**Migration safety**: Dropping `NOT NULL` is a metadata-only operation in PostgreSQL — no table
rewrite, no lock escalation, zero-downtime. No existing row is affected. Readers must be audited
for unguarded access; `refund-service.ts` is the only current consumer.

---

### M5 — `orderStatusEnum` unchanged

No new order status. A return is a lifecycle attached to a `DELIVERED` order, not an order
state. `DELIVERED` remains terminal, which is what makes the double-refund scenario impossible
([research.md](./research.md) R13).

---

## Drizzle Relations

```ts
export const returnRequestsRelations = relations(
  returnRequests,
  ({ one, many }) => ({
    order: one(orders, {
      fields: [returnRequests.orderId],
      references: [orders.id],
    }),
    user: one(users, {
      fields: [returnRequests.userId],
      references: [users.id],
    }),
    refund: one(refunds, {
      fields: [returnRequests.refundId],
      references: [refunds.id],
    }),
    items: many(returnItems),
    evidence: many(returnEvidence),
  })
)
```

`returnItems` and `returnEvidence` declare the inverse `one(returnRequests, ...)`.
`ordersRelations` gains `returns: many(returnRequests)`.

---

## Derived Values (never persisted)

| Value               | Derivation                                                                                                        | Where                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Returnable quantity | `orderItem.quantity − Σ ReturnItem.quantity` for the same `orderItemId` where the parent return is not `REJECTED` | `return-service.ts`           |
| Window expiry       | `order.deliveredAt + windowDays(categoryName)` from `returnsConfig` — see below                                   | `return-service.ts`           |
| Is returnable       | `order.status === 'DELIVERED' && now ≤ windowExpiry && returnableQuantity > 0`                                    | `return-service.ts`           |
| Refundable amount   | `allocateMoney` split — see [research.md](./research.md) R4                                                       | `return-refund-calculator.ts` |
| Available stock     | `productVariants.stock − productVariants.reservedStock`                                                           | existing reservation service  |

**The window is keyed by category _name_, not id.** `products.category` is
`text('category').notNull()` with a `Product_category_idx` index and **no foreign key** to the
`Category` table — the category is a denormalised name, not a relation. Keying `returnsConfig`
by `categoryId` would therefore never match anything, and every product would silently fall
through to the default window while appearing configured. `categoryWindowDays` and
`nonReturnableCategoryNames` are keyed by the same string stored in `products.category`, with
lookup performed case-insensitively to survive casing drift in that free-text column.

**Per-order window**: an order may span categories with different windows. The order's window
is the **shortest** applicable window across its items, evaluated per item, so an item in a
non-returnable category is excluded individually rather than disqualifying the whole order.

**`REJECTED` returns release their held quantity.** A rejected return's items become
requestable again, which is why the returnable-quantity predicate excludes only `REJECTED`.
`REQUESTED`, `APPROVED`, `RECEIVED`, and `REFUNDED` all hold quantity, satisfying FR-003's
"already returned **or pending return**".

---

## Validation Rules (Zod, `src/features/orders/validations.ts`)

```ts
export const CreateReturnRequestSchema = z.object({
  reason: z.enum(RETURN_REASONS),
  customerNote: z.string().trim().max(1000).optional(),
  items: z
    .array(
      z.object({
        orderItemId: z.string().length(7),
        quantity: z.number().int().positive(),
      })
    )
    .min(1)
    .max(50),
  // Option B: the published policy requires photographic evidence before any
  // damage claim is reviewed, so at least one image is mandatory.
  evidenceIds: z.array(z.string().length(7)).min(1).max(5),
})

export const DecideReturnSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    decisionReason: z.string().trim().min(1).max(500),
  }),
  z.object({
    action: z.literal('reject'),
    decisionReason: z.string().trim().min(1).max(500),
  }),
  z.object({ action: z.literal('receive') }),
  z.object({ action: z.literal('refund') }),
  z.object({ action: z.literal('settle') }),
])
```

`refund` is a distinct action from `receive`. `receive` acknowledges the goods and restocks;
`refund` issues the money. Separating them is what makes a failed gateway call recoverable —
see [research.md](./research.md) R12.

Server-side invariants enforced beyond the schema, because they need database state:

1. Order is `DELIVERED` and owned by the caller.
2. `now ≤ deliveredAt + windowDays`, evaluated per item against the item's category **name**,
   and the category is not in `nonReturnableCategoryNames`.
3. Every `orderItemId` belongs to the named order.
4. Each `quantity ≤ returnableQuantity` for that order item.
5. Computed `refundAmount ≤` the order's remaining refundable balance (the spec's "refund
   exceeds captured amount must be rejected" edge case).
6. `decisionReason` is mandatory on both `approve` and `reject` (FR-008 requires a recorded
   reason for **both** decisions, not only rejection).
7. Every `evidenceId` must be an orphaned row owned by the caller and scoped to the same order;
   non-matching ids are ignored rather than rejected. **After filtering, at least one must
   remain** — otherwise the request is rejected, since a client could otherwise satisfy the Zod
   `min(1)` with ids it does not own.

---

## Migration Notes

Generated by `npm run db:generate` as `drizzle/0017_self_service_returns.sql`, reviewed before
`npm run db:migrate`.

> Constitution workflow step 6 also requires refreshing
> `scripts/sql/bootstrap-drizzle-initial.sql` via `npm run db:bootstrap`. **Neither the file nor
> the script exists** — `scripts/sql/` contains only `catalog-data.sql`, and `package.json`
> defines only `db:generate`, `db:migrate`, `db:push`, and `db:studio`. That clause is stale
> constitution content and is not actionable here; it is recorded so the omission is deliberate
> rather than an oversight.

Ordered contents:

1. `CREATE TYPE "ReturnStatus"`, `CREATE TYPE "ReturnReason"`
2. `ALTER TABLE "Order" ADD COLUMN "deliveredAt" timestamp`
3. `UPDATE "Order" SET "deliveredAt" = "updatedAt" WHERE status = 'DELIVERED'` — with a comment
   recording that this is an approximation for historical rows
4. `CREATE TABLE "ReturnRequest"`, `"ReturnItem"`, `"ReturnEvidence"` with their constraints.
   `ReturnEvidence.returnRequestId` is **nullable**; `userId` and `orderId` are not.
5. `ALTER TABLE "Refund" ADD COLUMN "returnRequestId" varchar(7)` + FK + index
6. `ALTER TABLE "Refund" ALTER COLUMN "paymentTransactionId" DROP NOT NULL`
7. All indexes created `CONCURRENTLY` where the target table is non-empty (`Order`, `Refund`)

**Zero-downtime**: every step is additive or a constraint relaxation. No column is dropped, no
type narrowed, no existing value rewritten except the additive `deliveredAt` backfill. Code
deployed before the migration continues to function; code deployed after finds the columns
present.
