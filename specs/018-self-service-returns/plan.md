# Implementation Plan: Customer Self-Service Returns

**Branch**: `018-self-service-returns` | **Date**: 2026-08-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/018-self-service-returns/spec.md`

## Summary

Add a customer-initiated return lifecycle on top of the shipped refund and restock
machinery. Three new tables (`ReturnRequest`, `ReturnItem`, `ReturnEvidence`) carry an
explicit state machine — `REQUESTED → APPROVED → RECEIVED → REFUNDED`, with `REJECTED`
as a terminal branch. Customers request returns against `DELIVERED` orders from order
detail; administrators triage them behind a new `orders:returns` permission; marking a
return received restocks the units and issues a refund through the existing
`refundOrder` pipeline, linked back to the return.

The design's centre of gravity is **idempotency and money correctness**, because this is
the first place in the codebase where inventory and money move on a _partial_, _repeatable_
basis. Two existing mechanisms do not survive contact with that requirement and are
extended rather than reused blindly:

1. `restockOrderItems` guards on `orders.stockRestoredAt`, a single order-level timestamp.
   It is all-or-nothing per order and therefore cannot express "restock 2 of 5 units, twice,
   for two different returns". A sibling `restockReturnItems` guards on
   `ReturnRequest.stockRestoredAt` instead.
2. `refunds.paymentTransactionId` is `NOT NULL` and `refundOrder` always calls the gateway.
   Cash on Delivery orders have no captured payment and `codGateway.refund()` throws by
   design, so COD returns take a documented manual-settlement path rather than a gateway call.

**A blocking policy conflict must be resolved before implementation begins.** The published
policy in `src/lib/constants/checkout-policies.ts` states _"Refunds are not issued for orders"_
and _"Orders cannot be returned unless the product is received in damaged condition"_. The spec
assumes the policy already promises returns. It does not — it promises the opposite. See
[research.md](./research.md) R1.

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), Node 22 serverless runtime
**Primary Dependencies**: Next.js 16.3 (App Router, Cache Components), React 19.2, Drizzle ORM 0.45, Zod 4.4, NextAuth v5, Inngest 4.13, Redux Toolkit 2.12
**Storage**: PostgreSQL (Neon Serverless) via Drizzle; evidence images via `src/lib/image-storage.ts` (Vercel Blob / Azure Blob)
**Testing**: Vitest 4.1 + jsdom + React Testing Library; Playwright 1.62 for UI verification
**Target Platform**: Serverless on-demand functions (Vercel)
**Project Type**: Web application — Next.js App Router monolith under `src/`
**Performance Goals**: Returns queue list p95 < 400 ms at 10k returns; return submission p95 < 800 ms including evidence upload
**Constraints**: No route segment config (`dynamic`/`revalidate`/`runtime`) — Cache Components is enabled; no Redis read inside a `"use cache"` scope; all money arithmetic through `src/lib/money.ts` minor-unit helpers
**Scale/Scope**: 3 new tables, 2 enums, 7 API routes, 1 admin page, 2 customer UI surfaces, 1 Inngest event + function, 1 CSV export route

**Resolved unknowns** (detail in [research.md](./research.md)):

| Unknown                                | Resolution                                                             |
| -------------------------------------- | ---------------------------------------------------------------------- |
| Return window length & configurability | Edge Config `returnsConfig`, keyed by category **name**, 7-day default |
| Shipping refund rule                   | Shipping refunded only on a full-order return; never on partial        |
| Discount allocation on partial return  | New `allocateMoney` largest-remainder helper in `src/lib/money.ts`     |
| COD settlement path                    | Manual-settlement refund row + admin "mark settled" action, no gateway |
| Permission name                        | `orders:returns`, granted to `ADMIN` and `SUPPORT`                     |
| Reservation interaction                | Restock increments `stock` only; `reservedStock` untouched             |

**Open — requires a business decision before Phase 3**:

- **R1 (BLOCKING)**: The published checkout policy forbids returns and refunds outright. Building
  this feature without amending that copy ships a product whose behaviour contradicts the terms
  the customer accepted at checkout. This is a legal/commercial decision, not a technical one.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design._

| Principle                              | Assessment                                                                                                                                                                                                                                          | Status |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| I. Server-First Rendering              | Admin returns queue is a Server Component calling `requireAdminPermission`; `'use client'` confined to the return request form, evidence uploader, and queue action buttons. Customer return status renders server-side inside order detail.        | PASS   |
| II. Type Safety End-to-End             | All boundaries validated with Zod under `src/features/orders/validations.ts`; no raw SQL outside the generated migration; return status modelled as a `pgEnum` plus a derived TS union.                                                             | PASS   |
| III. Testing Discipline                | Service-layer tests target the 85% `src/features/**/services/**` threshold; Playwright specs cover request → approve → receive → refund. State-machine and allocation logic are pure functions, tested exhaustively.                                | PASS   |
| IV. Serverless & Caching Architecture  | Return status notification via Inngest (`order/return.status.changed`) with inline fallback, registered in `registry.ts`. Redis invalidation via `invalidateUserOrderCaches` / `invalidateAdminOrderCaches`. No new `"use cache"` scope introduced. | PASS   |
| V. Security by Default                 | Ownership enforced server-side on every customer operation; admin routes use `checkAdminAuth('orders:returns')`; evidence upload reuses magic-byte and size validation and is served from blob storage, never an app origin.                        | PASS   |
| VI. Observability & Structured Logging | All routes wrapped with `withApiLogging`; errors through `handleApiError` (which already calls `unstable_rethrow`); business events logged for `return_requested`, `return_decided`, `return_received`, `return_refunded`.                          | PASS   |
| VII. Simplicity & YAGNI                | Five states, no customer-withdraw state, no grading workflow, no carrier integration, no orphaned-evidence sweeper. One new money helper, added because proportional discount allocation is otherwise impossible to do correctly.                   | PASS   |
| VIII. DRY Shared Utilities             | Refund creation delegates to the existing `refundOrder`; audit via `recordAdminAuditLog`; CSV via `streamCsvResponse` and `batchedCsvRows`; upload via `uploadImage`. Only genuinely new logic is written.                                          | PASS   |

**Post-Phase-1 re-check**: PASS. The design added no route segment config, no nested
Redis-in-cache-scope, and no new heavy import chains. `restockReturnItems` is a new module
rather than a parameterised overload of `restockOrderItems`, which keeps the order-level
guard semantics of the existing function intact for its existing callers.

## Project Structure

### Documentation (this feature)

```text
specs/018-self-service-returns/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── customer-returns.md
│   └── admin-returns.md
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (public)/orders/[id]/
│   │   └── page.tsx                          # MODIFY — surface return action + status
│   ├── admin/returns/
│   │   ├── page.tsx                          # NEW — Server Component, requireAdminPermission
│   │   └── error.tsx                         # NEW
│   └── api/
│       ├── orders/[id]/returns/route.ts      # NEW — POST create, GET list (customer)
│       ├── returns/[id]/route.ts             # NEW — GET one (customer, ownership-gated)
│       └── admin/
│           ├── returns/route.ts              # NEW — GET queue
│           ├── returns/[id]/route.ts         # NEW — PATCH decide / receive / settle
│           └── export/returns/route.ts       # NEW — CSV export
├── features/orders/
│   ├── components/
│   │   ├── ReturnRequestForm.tsx             # NEW — 'use client'
│   │   ├── ReturnEvidenceUploader.tsx        # NEW — 'use client'
│   │   └── ReturnStatusPanel.tsx             # NEW — Server Component
│   ├── services/
│   │   ├── return-service.ts                 # NEW — create, decide, receive, settle
│   │   ├── return-state-machine.ts           # NEW — pure transition table
│   │   ├── return-refund-calculator.ts       # NEW — pure allocation logic
│   │   ├── return-restock.ts                 # NEW — idempotent partial restock
│   │   ├── refund-service.ts                 # MODIFY — accept + persist returnRequestId
│   │   └── order-restock.ts                  # UNCHANGED
│   ├── inngest/
│   │   ├── events.ts                     # MODIFY — add returnStatusChanged
│   │   └── emails.ts                     # MODIFY — add sendReturnStatusEmailFunction
│   ├── store/returnsSlice.ts                 # NEW — admin queue state
│   └── validations.ts                        # MODIFY — return Zod schemas
├── features/admin/components/
│   └── AdminReturnCard.tsx                   # NEW — 'use client'
├── lib/
│   ├── schema.ts                             # MODIFY — 3 tables, 2 enums, refunds.returnRequestId
│   ├── money.ts                              # MODIFY — add allocateMoney
│   ├── edge-config.ts                        # MODIFY — add returnsConfig
│   ├── upload-constants.ts                   # MODIFY — hoist MAX_FORM_DATA_BODY_SIZE
│   ├── upload-validation.ts                  # NEW — shared magic-byte validator
│   ├── constants/roles.ts                    # MODIFY — add 'orders:returns'
│   ├── constants/returns.ts                  # NEW — status/reason tuples
│   ├── constants/checkout-policies.ts        # MODIFY — reconcile published policy (R1)
│   ├── inngest/registry.ts                   # MODIFY — register return function
│   ├── email/templates.ts                    # MODIFY — returnStatusUpdateTemplate
│   └── notifications/order-notifications.ts  # MODIFY — deliverReturnStatusNotification
└── ...

drizzle/
└── 0017_self_service_returns.sql             # NEW — generated, reviewed

scripts/sql/
└── bootstrap-drizzle-initial.sql             # MODIFY — refreshed per constitution step 6

__tests__/features/orders/services/
├── return-state-machine.test.ts              # NEW
├── return-refund-calculator.test.ts          # NEW
├── return-restock.test.ts                    # NEW
└── return-service.test.ts                    # NEW

__tests__/lib/money.test.ts                   # MODIFY — allocateMoney cases

playwright-tests/
└── returns.spec.ts                           # NEW — full lifecycle + a11y

docs/
└── features.md                               # MODIFY — FR-018
```

**Structure Decision**: The feature lives in the existing `orders` domain module rather than a
new `returns` module. A return is a post-delivery state of an order, it shares the order's
ownership check, restock service, refund service, cache invalidation, and Inngest event
namespace, and splitting it out would force `returns` to import most of `orders` — violating
Principle VIII's rule against duplicated cross-module import chains. Admin presentation
components sit in `src/features/admin/components/` to match `AdminOrderCard`.

## Key Design Decisions

### D1 — Separate restock guard, not a reused one

`restockOrderItems(tx, order)` claims the whole order via
`UPDATE "Order" SET "stockRestoredAt" = NOW() WHERE id = ? AND "stockRestoredAt" IS NULL`.
Returns need a per-return claim so that two returns against the same order both restock, and
neither restocks twice. `restockReturnItems(tx, returnRequest)` applies the identical
guarded-claim pattern against `ReturnRequest.stockRestoredAt`. The two functions are
deliberately siblings: parameterising the existing one would let a caller accidentally pass a
return where an order is expected and silently disable the order-level guard.

### D2 — Restock at RECEIVED, refund as a separate action

FR-012 and the spec's edge cases both require that units re-enter inventory only when they
physically arrive. `APPROVED` authorises the customer to ship; `RECEIVED` is the warehouse
acknowledgement and is the sole restock trigger.

Refund issuance is a **separate action**, not a side effect of `receive`. Collapsing them
strands a gateway-rejected return at `RECEIVED` with no action accepting that state as input,
which is exactly the out-of-band support workflow this feature exists to eliminate. The split
also aligns the permission boundary with the money boundary: `receive` needs `orders:returns`,
`refund` needs `orders:refund`. See [research.md](./research.md) R12.

### D3 — Refund amount is computed once, at request time, and frozen

`ReturnItem.refundableAmount` is persisted when the return is created, not recomputed at refund
time. Recomputing later would let a subsequent price change, coupon expiry, or partial refund
alter the amount owed for goods already agreed. The frozen amount is re-validated against the
order's remaining refundable balance at refund time, so a stale amount can never over-refund.

### D4 — Reservations are untouched

`productVariants` carries both `stock` (on-hand) and `reservedStock` (sum of `HELD`
reservations). Availability is `stock - reservedStock`. Restocking a return increments `stock`
only, so returned units become available without disturbing any live checkout hold. No
reservation row is created, consumed, or released by the returns flow.

### D5 — COD returns never call a gateway

`codGateway.refund()` throws `PaymentVerificationError` by design. A COD return therefore
records a refund row with `status = 'PENDING'`, `gatewayRefundId = null`, and a
`MANUAL_SETTLEMENT:` reason prefix, and exposes an admin "mark settled" action that flips it to
`PROCESSED` with an audit entry. This requires relaxing `refunds.paymentTransactionId` to
nullable — see [data-model.md](./data-model.md) M4.

## Complexity Tracking

> Filled only where the Constitution Check surfaced a justified deviation.

| Violation                                                                       | Why Needed                                                                                                                                                                                                                        | Simpler Alternative Rejected Because                                                                                                                                                         |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New `allocateMoney` helper in `src/lib/money.ts` (Principle VII — YAGNI)        | A partial return must recover the returned items' share of an order-level `discountAmount`. Naive per-item proration loses or invents paise on rounding, and FR-011 / SC-004 demand exact reconciliation against captured amount. | Rounding each item independently with `roundMoney` fails to sum back to the order discount. Largest-remainder allocation on integer minor units is the minimal correct construction.         |
| Making `refunds.paymentTransactionId` nullable (schema change to shipped table) | COD orders have no captured transaction, and FR-013 mandates a settlement path for them.                                                                                                                                          | Writing a sentinel string (`'COD_MANUAL'`) into a column that every other reader treats as a real gateway reference would corrupt refund reconciliation and the webhook uniqueness contract. |

## Phase Status

- [x] Phase 0 — research complete ([research.md](./research.md)); one item (R1) escalated as a business decision
- [x] Phase 1 — data model, contracts, quickstart generated
- [ ] Phase 2 — task breakdown (run `/speckit.tasks`)
