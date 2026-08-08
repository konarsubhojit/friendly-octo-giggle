# Quickstart: Customer Self-Service Returns

**Feature**: `018-self-service-returns` | **Date**: 2026-08-08

How to build, run, and verify this feature. Read [plan.md](./plan.md) first for the design and
[research.md](./research.md) for why each decision was made.

---

## ⛔ Before you start

**[research.md](./research.md) R1 is unresolved and blocks implementation.** The published
checkout policy currently states _"Refunds are not issued for orders"_ and _"Orders cannot be
returned unless the product is received in damaged condition."_ Building refund-settled
self-service returns contradicts the terms every customer accepts at checkout.

Get a decision from the product owner on Option A (amend the policy), B (damaged-item returns
only), or C (replacement instead of refund) before writing code. Option B narrows
`ReturnReason` and makes evidence mandatory; Option C removes the refund half of the feature
entirely.

---

## Prerequisites

```bash
npm install
cp .env.example .env.local   # fill DATABASE_URL, UPSTASH_*, NEXTAUTH_SECRET
npm run db:migrate           # bring the local database current before adding 0017
```

Optional for full-fidelity local work:

- `EDGE_CONFIG` — otherwise `returnsConfig` falls back to the hardcoded 7-day default, which is
  the intended and tested degradation path
- `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` — otherwise `dispatchWorkflowEvent` returns
  `'fallback'` and notifications deliver inline

---

## Build order

Each step leaves the tree green. Do not reorder — later steps import earlier ones, and the pure
functions must exist before the orchestration that calls them.

### 1. Schema and migration

1. Add `returnStatusEnum`, `returnReasonEnum`, and the three tables to `src/lib/schema.ts`.
2. Add `orders.deliveredAt`, `refunds.returnRequestId`; relax `refunds.paymentTransactionId`.
3. Add the Drizzle relations.

```bash
npm run db:generate                     # → drizzle/0017_self_service_returns.sql
# review the SQL — confirm the deliveredAt backfill and the DROP NOT NULL
npm run db:migrate
```

### 2. Pure functions (test-first — these carry the coverage number)

| Module                                                     | Responsibility                                           |
| ---------------------------------------------------------- | -------------------------------------------------------- |
| `src/lib/money.ts` → `allocateMoney`                       | Largest-remainder split; `sum(result) === total` exactly |
| `src/features/orders/services/return-state-machine.ts`     | Transition table; no I/O                                 |
| `src/features/orders/services/return-refund-calculator.ts` | Per-item refundable amount, shipping rule                |

These three have no database or network dependency, so test them exhaustively first. They are
what makes the 85% `src/features/**/services/**` threshold cheap to reach.

### 3. Services

`return-restock.ts` (guarded claim), then `return-service.ts` (transaction orchestration), then
the `refund-service.ts` modification that accepts and persists `returnRequestId`.

### 4. API routes

Customer routes first (`/api/orders/[id]/returns`, `/api/returns/[id]`), then admin
(`/api/admin/returns`, `/api/admin/returns/[id]`, `/api/admin/export/returns`).

### 5. Notifications

Event in `src/features/orders/inngest/events.ts` → email template → delivery function →
function added to `src/features/orders/inngest/emails.ts` → register in
`src/lib/inngest/registry.ts`. The function belongs in `emails.ts`, not
`src/lib/inngest/functions/`, because `recordEmailFailure` and `finishEmailRun` are
module-private there. **Registration is easy to forget and fails silently** — the event
publishes, no function consumes it, no error is raised.

### 6. UI

`ReturnStatusPanel` (Server Component) and `ReturnRequestForm` / `ReturnEvidenceUploader`
(Client) on order detail; `src/app/admin/returns/page.tsx` plus `AdminReturnCard`.

### 7. Documentation

Update `docs/features.md` and `specs/003-order-policy-dialog`, and amend
`src/lib/constants/checkout-policies.ts` per the R1 decision (FR-018).

---

## Verification gates

All five must pass before commit. `npm run build` is not optional — it is the only gate that
catches Next.js route-type and prerender errors.

```bash
npm run lint
npx tsc --noEmit -p tsconfig.check.json
npm test
npm run build
npm run docs:check
```

Then, per constitution workflow step 7:

```text
sonarqube_analyze_file                    # every added/modified file
sonarqube_list_potential_security_issues  # the API routes and the upload handler
```

---

## Manual verification path

Run `npm run dev` (HTTPS, self-signed cert at `https://localhost:3000`).

1. **Seed state** — place an order, then move it to `DELIVERED` via
   `PATCH /api/admin/orders/{id}`. Confirm `deliveredAt` is now populated.
2. **Request** — open the order as the customer. The return action appears. Submit a return for
   1 of 3 units with an evidence image.
3. **Eligibility** — reload. The item now shows `returnableQuantity: 2`. Requesting 3 returns
   `409 / QUANTITY_EXCEEDED`.
4. **Ownership** — sign in as a different customer and `GET /api/returns/{id}`. Expect **404**,
   not 403.
5. **Queue** — sign in as admin, open `/admin/returns`. The request is listed with its evidence.
6. **Approve** — approve with a reason. Confirm the customer sees `APPROVED`, an audit row
   exists, and an email is delivered (or logged as suppressed if preferences forbid it).
7. **Receive** — mark received. Confirm:
   - `ProductVariant.stock` increased by exactly 1
   - `ProductVariant.reservedStock` is **unchanged**
   - status is `RECEIVED` and **no refund row was created** — receive moves inventory only
8. **Refund** — issue the refund as a separate action. Confirm a `Refund` row exists with
   `returnRequestId` set, `ReturnRequest.refundId` matches it, and status is `REFUNDED`.
9. **Idempotency** — replay both calls. Expect `409` on the receive replay, and verify stock did
   **not** increase again and no second refund row appeared.
10. **Retry recovery** — force a gateway failure, confirm the return stays at `RECEIVED` with
    `refundId` unset and `Refund.errorMessage` visible, then re-issue `refund` and confirm it
    succeeds. **This is the scenario the receive/refund split exists for.**
11. **Rejection** — submit a second return, reject it, and confirm the held quantity is released
    (`returnableQuantity` returns to 2).
12. **Evidence cap** — upload 6 images against one order. Expect `409` on the sixth. Confirm the
    first five rows have `returnRequestId` null until the return is created.
13. **COD** — repeat against a COD order. Confirm no gateway call, a `PENDING` refund with a
    `MANUAL_SETTLEMENT:` reason, and that `settle` flips it to `PROCESSED`.

Capture screenshots of the customer return form, the customer status panel, and the admin queue
— constitution Principle III requires Playwright evidence for UI changes.

---

## Test targets

| File                                                                  | Focus                                                                                   |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `__tests__/lib/money.test.ts`                                         | `allocateMoney` sum invariant across randomised weights; zero total; single weight      |
| `__tests__/features/orders/services/return-state-machine.test.ts`     | Every legal transition including the `RECEIVED → RECEIVED` retry; illegal ones rejected |
| `__tests__/features/orders/services/return-refund-calculator.test.ts` | Partial vs full return; shipping rule; discount allocation reconciles to order total    |
| `__tests__/features/orders/services/return-restock.test.ts`           | Claim succeeds once; second call returns `false`; `reservedStock` untouched             |
| `__tests__/features/orders/services/return-service.test.ts`           | Ownership rejection; window expiry; quantity ceiling; over-refund; refund retry         |
| `__tests__/app/api/orders/return-evidence.test.ts`                    | Type, size, and count rejection (SC-007)                                                |
| `__tests__/app/api/admin/orders/status-transitions.test.ts`           | Regression: `DELIVERED` remains terminal ([research.md](./research.md) R13)             |
| `playwright-tests/returns.spec.ts`                                    | Full lifecycle, a11y via axe-core, keyboard path through the request form               |

---

## Traps

- **Do not reuse `restockOrderItems`.** It claims `orders.stockRestoredAt`, a single order-level
  flag. Calling it for a return consumes the order's claim and silently blocks any future
  restock for that order.
- **Do not merge `receive` and `refund` into one action.** A gateway rejection would strand the
  return at `RECEIVED` with no action accepting that state — the exact dead end this feature
  exists to remove.
- **Do not make `ReturnEvidence.returnRequestId` NOT NULL.** Evidence is uploaded before the
  return exists; the row must be insertable while orphaned.
- **Do not key `returnsConfig` by category id.** `products.category` is free text with no FK, so
  an id-keyed lookup silently matches nothing and every window falls through to the default.
- **Do not add route segment config.** `export const dynamic` / `revalidate` / `runtime` are
  rejected outright with Cache Components enabled.
- **Do not call the gateway for COD.** `codGateway.refund()` throws by design. Branch on
  `order.paymentProvider` before reaching `refundOrder`.
- **Do not recompute refund amounts at refund time.** They are frozen at request time (D3).
  Re-validate against the remaining balance, but never recalculate.
- **Do not trust `Content-Type` on evidence uploads.** Use the shared magic-byte validator.
- **Do not return 403 for another customer's return.** Return 404 — 403 confirms the identifier
  exists.
- **Do not format prices with `$` or `.toFixed(2)`.** Use `formatPrice()` from `useCurrency()`.
  Base currency is INR.
