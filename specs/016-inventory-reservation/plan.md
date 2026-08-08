# Implementation Plan: Inventory Reservation

**Branch**: `016-inventory-reservation` | **Date**: 2026-08-07 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/016-inventory-reservation/spec.md`

## Summary

Close the oversell window between stock _validation_ (at checkout submission, in `priceAndValidateStock`) and stock _decrement_ (later, inside the Inngest checkout pipeline) by introducing an explicit hold that spans it.

The design has four parts, in dependency order:

1. **A reservation ledger plus a denormalised counter.** A new `StockReservation` table records one row per (checkout request, variant) hold; a new `ProductVariant.reservedStock` column carries the summed live holds. Availability is `stock - reservedStock`, readable in O(1) from any query that already selects the variant row.
2. **An atomic grant.** Reserving is a single conditional `UPDATE ProductVariant SET "reservedStock" = "reservedStock" + q WHERE id = ? AND stock - "reservedStock" >= q`. The database — not application code — decides the winner, exactly as the existing coupon `usageCount` guard and the existing `stock >= quantity` decrement guard already do. A grant that affects zero rows is a denial.
3. **A lifecycle with exactly-once transitions.** `HELD → CONSUMED` at order commit (inside the same transaction as the stock decrement), `HELD → RELEASED` when the checkout request fails or an admin intervenes, `HELD → EXPIRED` from a bounded Inngest cron. Every transition is a conditional update on `status = 'HELD'` that returns the claimed rows, so a replay claims nothing and changes nothing — the same idiom as `Order.stockRestoredAt` in `order-restock.ts`.
4. **Operator visibility.** Reservation state and expiry on the admin checkout-requests dashboard, on-hand/reserved/available split on the admin product and variant views, an audited manual release, and Prometheus counters for granted/denied/expired/consumed/released.

On-hand `ProductVariant.stock` keeps its current meaning and continues to change only at order commit and restock (FR-010). Nothing in the existing restock path needs new arithmetic: a consumed reservation has already left `reservedStock`, so a cancellation or refund credits `stock` alone and cannot double-count (FR-016).

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), React 19.2, Next.js 16.3 (App Router, Cache Components)  
**Primary Dependencies**: Drizzle ORM 0.45 (`src/lib/db.ts`, `src/lib/schema.ts`), Inngest 4.13 (`src/lib/inngest/`), Zod 4.4, Pino, Prometheus text rendering in `src/lib/metrics.ts`  
**Storage**: PostgreSQL (Neon serverless). One new table, one new enum, one new column, one reviewed Drizzle migration (next number: `0015`)  
**Testing**: Vitest (`__tests__/` mirroring `src/`), Playwright (`playwright-tests/`). Service-layer coverage threshold for `src/features/**/services/**` is 85% lines/functions (`vitest.config.mts`)  
**Target Platform**: Vercel serverless; Inngest cron for expiry  
**Project Type**: Single Next.js application  
**Performance Goals**: The grant adds one conditional `UPDATE` per line item inside the existing checkout transaction; catalog reads gain no extra query, because availability is derived from two columns of a row already being selected  
**Constraints**: No `"use cache"` scope may serve reservation-derived availability (see Decision D4); the grant must not hold a transaction open across a network call to a payment gateway; the expiry job must be bounded per run  
**Scale/Scope**: 1 new table, 1 new column, 1 migration, 1 new service module, 1 new Inngest function, 1 new admin API route, 3 touched admin surfaces, ~6 touched service modules

## Constitution Check

_GATE: checked before Phase 0 and re-checked after the design below._

| Principle                              | Assessment                                                                                                                                                                                                                                     |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Server-First Rendering              | PASS — all reservation logic is server-side. The one new client interaction (admin release) is a form posting to a route handler; no new provider or store slice.                                                                              |
| II. Type Safety End-to-End             | PASS — the reservation ledger is a Drizzle table with a pgEnum status; the admin release payload is validated with Zod under `src/features/orders/validations.ts`. No raw SQL outside the migration and the Drizzle `sql` template guards.     |
| III. Testing Discipline                | PASS — new service module is under `src/features/**/services/**` and therefore held to the 85% line/function threshold (SC-007). Concurrency is exercised as an integration-style test over the conditional update, not by mocking the winner. |
| IV. Serverless & Caching Architecture  | PASS — expiry is an Inngest cron function registered in `src/lib/inngest/registry.ts`; no `setTimeout`, no in-memory hold. Availability is deliberately kept out of `"use cache"` scopes (Decision D4).                                        |
| V. Security by Default                 | PASS — manual release requires `checkAdminAuth('orders:update')` and writes an `adminAuditLogs` row. Reservation grant is reachable only through the authenticated checkout route.                                                             |
| VI. Observability & Structured Logging | PASS — counters in `src/lib/metrics.ts`, structured `logBusinessEvent` on grant/deny/expire, and an Inngest score for expiry-job outcome alongside the existing `stockConflict` score.                                                         |
| VII. Simplicity & YAGNI                | PASS with one justified denormalisation — `ProductVariant.reservedStock` duplicates a sum that the ledger already implies. See Complexity Tracking.                                                                                            |
| VIII. DRY Shared Utilities             | PASS — one module (`src/features/orders/services/stock-reservation.ts`) owns every transition; callers (checkout service, order creation, expiry job, admin route) call it rather than writing their own updates.                              |

## Phase 0 — Research findings (verified 2026-08-07 against the working tree)

- **R1 — The oversell window is real and its two ends are in different processes.** `priceAndValidateStock` (`src/features/orders/services/create-order-service.ts:401`) compares `ProductVariant.stock` against the requested quantity when the checkout request is accepted. The decrement is a separate conditional update inside `db.orders.createWithItems` (`src/lib/db-queries.ts:939–960`), which runs later, inside `processCheckoutRequestFunction`. Between them sit a row insert, an Inngest publish, and queue latency.
- **R2 — The losing request already fails correctly; it just fails late.** The decrement guard is `gte(productVariants.stock, item.quantity)`; a zero-row result raises `StockConflictError` and the pipeline converts it to a 409, scored as `stock-conflict` (`src/features/cart/inngest/checkout.ts`). Stock therefore never goes negative today. The defect this feature fixes is _when_ the customer learns, not _whether_ the database stays consistent.
- **R3 — No payment is captured before `POST /api/checkout` in the shipped flow.** `src/app/(public)/checkout/payment/page.tsx` posts the cart with no payment fields; `PaymentGateway.createOrder` (`src/lib/payments/gateway.ts:93`) has no caller in `src/app` or `src/features`. Only Cash on Delivery is wired end to end. Reserving at request acceptance therefore satisfies FR-001 and SC-002 as the product stands. **Constraint recorded for whoever wires the online flow**: for a signature provider the reservation must be granted _before_ the gateway order is created, because `POST /api/checkout` already carries a captured `paymentTransactionId` for that path (`enqueueCheckoutForUser`, `src/features/cart/services/checkout-service.ts:379`).
- **R4 — The conditional-update idiom is already the house solution to exactly this race.** Two precedents: the coupon counter (`UPDATE ... WHERE usageCount < usageLimit`, which also takes the row lock that serialises concurrent redemptions) and the restock claim (`UPDATE Order SET stockRestoredAt = now() WHERE stockRestoredAt IS NULL RETURNING id`). Adopting the same shape keeps FR-003 and FR-009 provable by inspection rather than by argument.
- **R5 — Idempotency has a natural key.** Everything downstream is keyed on `checkoutRequestId` (preflight, claim, order creation). A `UNIQUE (checkoutRequestId, variantId)` constraint makes the grant idempotent for free: a replay collides, and the existing row is reused (US3 acceptance 1).
- **R6 — Expiry must be evaluated against the database clock.** The spec's clock-skew edge case is satisfied by comparing `expiresAt` to `now()` in SQL rather than to a JavaScript `Date` computed on the instance. `expiresAt` itself is written as `now() + interval`, so no instance clock enters the comparison at all.
- **R7 — The cron pattern to copy is `scanAbandonedCartsFunction`** (`src/features/cart/inngest/abandoned-cart.ts`): a `cron()` trigger on a function registered in `src/lib/inngest/registry.ts`, with the batch fetched in a `step.run`. There is no `vercel.json`; Inngest owns scheduling.
- **R8 — Availability is currently derived from `stock` in three shapes.** `deriveMinimalProduct` sums variant stock for list views (`src/lib/db-queries.ts:132–145`), `findFirstForCart` reads active variants for cart checks, and `findVariantStock` reads the primary DB for the cart quantity cap. Adding `reservedStock` to the variant row makes all three reservation-aware with a subtraction, and no extra round trip.
- **R9 — Two catalog reads sit inside `"use cache"` scopes.** `src/app/(public)/shop/page.tsx` and `src/app/(public)/products/[id]/page.tsx` cache product data with `cacheLife('catalog')` / `cacheLife('product')`. Reservation churn is far faster than those profiles and cannot drive tag revalidation without destroying the cache. See Decision D4.
- **R10 — Coverage is enforced per-path.** `vitest.config.mts` applies an 85% line/function threshold to `src/features/**/services/**/*.ts`. Placing the new module there is what makes SC-007 an automatic gate rather than a manual promise.

## Design decisions

### D1 — Ledger table plus denormalised counter, not a ledger alone

`StockReservation` rows are the audit trail and the unit of expiry; `ProductVariant.reservedStock` is the aggregate the grant tests against.

Rejected alternative: compute held quantity with `SUM(quantity) WHERE variantId = ? AND status = 'HELD' AND expiresAt > now()` at grant time. It cannot be expressed as a single atomic conditional update against the variant row, so it would need `SELECT ... FOR UPDATE` plus application-side comparison — precisely what FR-003 forbids — and it would put an aggregate subquery on every catalog listing read. The counter's cost is the drift risk handled in D3.

### D2 — Grant is per line item, inside one transaction, all-or-nothing

Each item's conditional update runs inside a single transaction opened by the reservation service. A zero-row result for any item rolls back the transaction, so a partially reserved checkout request cannot exist (FR-002). Items are processed in a deterministic order (variant id ascending) so two concurrent multi-item checkouts touching the same variants cannot deadlock.

### D3 — Every transition is a claim, and the counter moves only for claimed rows

`releaseReservations`, `expireReservations`, and `consumeReservations` all take the shape "conditional `UPDATE ... WHERE status = 'HELD' RETURNING id, variantId, quantity", then decrement `reservedStock`by the returned quantities inside the same transaction". A second run claims nothing and therefore adjusts nothing (FR-006, FR-009, US2 acceptance 4). This is the only place`reservedStock` decreases, which bounds counter drift to a single module and lets the expiry job's own logging surface any mismatch.

### D4 — Reservation-aware availability is a per-request value and never enters a cached scope

Cached catalog pages (R9) continue to render on-hand stock for the coarse "in stock / sold out" presentation, because holds live for minutes while the `catalog` and `product` profiles revalidate on their own schedule, and revalidating a product tag on every reservation would both defeat the cache and put write amplification on the hottest path.

Every decision that can _reject_ a shopper — the cart quantity cap, cart validation, and the checkout grant itself — reads availability per request from the primary database, where it is exact. This is the boundary FR-004 actually needs: no shopper is ever _promised_ a unit that is held, because the promise is made at checkout, not on the product card.

### D5 — Reservation lifetime is configuration with a safe default

`RESERVATION_TTL_MINUTES` defaults to 30 and is read once in the reservation service. Thirty minutes comfortably exceeds the Razorpay checkout completion window and is short enough that an abandoned checkout returns stock within one shopping session (FR-005). The expiry cron runs every five minutes with a bounded batch of 500 rows, so worst-case over-hold is TTL + 5 minutes and a backlog cannot exhaust the function timeout (FR-006).

### D6 — A soft-deleted variant fails its checkout request, it does not strand the hold

Reservations reference `ProductVariant` with `ON DELETE CASCADE` for hard deletion (which the product never performs) and are checked for `deletedAt IS NULL` at grant time. If a variant is soft-deleted while held, order creation already fails the request; `recordCheckoutProcessingFailure` releases the reservation on the `FAILED` transition (FR-007), so the units return to availability with a named reason.

### D7 — Admin stock edits are validated against reserved quantity

The variant update path rejects a `stock` value below the variant's current `reservedStock` with a 409 naming the held quantity, rather than silently creating a negative availability. This is the spec's "prevented" branch of that edge case; the explicit-oversell branch is out of scope and recorded as such.

## Data model

```text
StockReservationStatus  enum: HELD | CONSUMED | RELEASED | EXPIRED

StockReservation
  id                 varchar(7)  PK, Base62 short id
  checkoutRequestId  varchar(7)  FK → CheckoutRequest(id) ON DELETE CASCADE
  variantId          varchar(7)  FK → ProductVariant(id)  ON DELETE CASCADE
  quantity           integer     NOT NULL, CHECK (quantity > 0)
  status             enum        NOT NULL DEFAULT 'HELD'
  expiresAt          timestamp   NOT NULL
  settledAt          timestamp   NULL   -- when it left HELD
  createdAt          timestamp   NOT NULL DEFAULT now()
  updatedAt          timestamp   NOT NULL DEFAULT now()

  UNIQUE (checkoutRequestId, variantId)          -- idempotent grant (R5)
  INDEX  (status, expiresAt)                     -- expiry scan (FR-015)
  INDEX  (variantId, status)                     -- per-variant lookup (FR-015)

ProductVariant
  reservedStock      integer     NOT NULL DEFAULT 0, CHECK (reservedStock >= 0)
```

Available quantity is `stock - reservedStock`, never stored.

## Lifecycle

```text
POST /api/checkout
  └─ enqueueCheckoutForUser
       ├─ create CheckoutRequest (PENDING)
       └─ reserveForCheckoutRequest        ── grant, all-or-nothing ── denial → 409, no request queued
             │
             ▼
  Inngest processCheckoutRequestFunction
       ├─ preflight / claim                (unchanged)
       ├─ createOrderForCheckoutRequest
       │     └─ transaction: decrement stock ∧ consume reservations ∧ create order   (FR-008)
       └─ failure → recordCheckoutProcessingFailure → releaseForCheckoutRequest      (FR-007)

  Inngest expireStockReservationsFunction  (cron */5, batch 500)
       └─ HELD ∧ expiresAt <= now() → EXPIRED, reservedStock -= quantity             (FR-006)

  Admin  POST /api/admin/checkout-requests/[id]/reservations/release
       └─ releaseForCheckoutRequest + adminAuditLogs row                             (FR-013)
```

## Project Structure

### Documentation (this feature)

```text
specs/016-inventory-reservation/
├── spec.md
├── plan.md              # this file
└── tasks.md
```

No `research.md`, `data-model.md`, or `contracts/` directory: this feature adds one table and one internal admin endpoint, both fully described above, and the repository's prior features (012, 014, 015) keep the same three-file shape.

### Source Code (repository root)

```text
src/
├── lib/
│   ├── schema.ts                              # + stockReservations, + reservedStock, + enum, + relations
│   ├── db-queries.ts                          # reservation-aware availability in variant/product reads
│   ├── metrics.ts                             # + reservation counters
│   └── inngest/
│       ├── registry.ts                        # + expireStockReservationsFunction
│       ├── scores.ts                          # + reservationExpirySweepClean
│       └── functions/
│           └── stock-reservations.ts          # new: bounded expiry cron
├── features/
│   ├── orders/
│   │   ├── services/
│   │   │   ├── stock-reservation.ts           # new: grant / consume / release / expire (single owner)
│   │   │   ├── create-order-service.ts        # consume inside the order transaction
│   │   │   └── order-restock.ts               # unchanged; verified against consumed holds
│   │   └── validations.ts                     # + release payload schema
│   ├── cart/services/checkout-service.ts      # grant on enqueue; release on FAILED
│   └── admin/components/…                     # reservation columns + release control
├── app/
│   ├── api/admin/checkout-requests/[id]/reservations/release/route.ts   # new
│   └── admin/checkout-requests/page.tsx       # reservation state + expiry
drizzle/
└── 0015_stock_reservations.sql                # generated, reviewed
scripts/sql/bootstrap-drizzle-initial.sql      # refreshed (workflow gate 6)
__tests__/
├── features/orders/services/stock-reservation.test.ts
├── features/cart/services/checkout-service.reservation.test.ts
├── lib/inngest/functions/stock-reservations.test.ts
└── app/api/admin/…/release.test.ts
```

**Structure Decision**: the reservation service lives in `src/features/orders/services/` rather than `src/lib/` because it is domain logic owned by the order/checkout pipeline, and because that path carries the 85% coverage threshold SC-007 requires. `src/lib/` gains only the schema, the metric counters, and the cron function, matching where the constitution places scheduled jobs.

## Risks

| Risk                                                                                    | Mitigation                                                                                                                                       |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `reservedStock` drifts from the ledger and silently hides inventory                     | Every mutation is confined to one module (D3); the expiry job logs any row it expires whose counter decrement would go negative, and clamps at 0 |
| A reservation outlives a payment window that later grows                                | TTL is a named constant with a documented rationale (D5), not a literal buried in a query                                                        |
| Grant added to the hot checkout path increases latency                                  | One conditional update per line item inside the transaction that already exists; measured against the `checkout-latency-ms` score before/after   |
| Catalog pages showing on-hand while checkout enforces available reads as inconsistent   | Deliberate and documented (D4); the shopper-visible contract is "we only promise at checkout", and the denial message names the item             |
| A deadlock between two multi-item checkouts touching the same variants in reverse order | Deterministic per-transaction ordering by variant id (D2)                                                                                        |

## Complexity Tracking

| Violation                                                   | Why Needed                                                                                                                                   | Simpler Alternative Rejected Because                                                                                                                            |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Denormalised `ProductVariant.reservedStock` (Principle VII) | FR-003 requires the grant to be one atomic conditional update, and FR-004 requires availability on every catalog read without an extra query | Summing the ledger per grant needs `SELECT … FOR UPDATE` plus an application-side comparison (forbidden by FR-003) and an aggregate subquery on every list read |
