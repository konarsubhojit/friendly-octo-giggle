# Phase 0 Research: Customer Self-Service Returns

**Feature**: `018-self-service-returns` | **Date**: 2026-08-08

Each entry resolves a `NEEDS CLARIFICATION` from the Technical Context, or records a
verified fact about existing code that constrains the design.

---

## R1 — Published policy contradicts the feature (BLOCKING)

**Status**: ⛔ Unresolved — requires a business decision, not a technical one.

**Finding**: The spec's Baseline claims the published policy "already governs cancellation,
returns, and refunds" and that "return terms are a shipped promise without a shipped
mechanism". The actual text in `src/lib/constants/checkout-policies.ts` says the opposite:

```text
returns:  "Orders cannot be returned unless the product is received in damaged condition."
          "Shoppers must contact support with detailed photos, a short video, and a
           description of the issue before any damaged-item return is reviewed."

refunds:  "Refunds are not issued for orders."
          "Damaged products are handled through review and replacement rather than refund."
```

Every customer accepts this text at checkout via `CHECKOUT_POLICY_ACKNOWLEDGMENT`. The feature
as specified — self-service returns for any delivered item, settled by refund — is prohibited
by the terms the customer agreed to.

**Why this blocks**: Shipping a refund mechanism while the accepted terms say "refunds are not
issued" creates a contradiction between contract and product. Resolving it after launch means
changing terms retroactively for orders already placed.

**Options**:

| Option                                                                               | Consequence                                                                                                                 |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| **A** — Amend the policy to permit returns and refunds within a window (recommended) | Requires legal/commercial sign-off. `CHECKOUT_POLICIES` and `specs/003-order-policy-dialog` updated in the same change.     |
| **B** — Scope the feature to damaged-item returns only                               | Matches current terms with no amendment. Reason set narrows to damage categories; evidence becomes mandatory, not optional. |
| **C** — Settle approved returns with replacement instead of refund                   | Matches current terms exactly, but contradicts FR-010 through FR-013 and removes the entire refund half of the spec.        |

**Recommendation**: Option A. The spec's Success Criteria (SC-004 reconciliation, FR-013 COD
settlement) only make sense under a refund model. Escalate to the product owner before Phase 3;
capture the decision in the spec's Baseline and amend `CHECKOUT_POLICIES` as part of FR-018.

**Impact if Option B is chosen instead**: `ReturnReason` collapses to damage categories,
`ReturnEvidence` becomes required (minimum one image), and the return window may be shorter.
The state machine, restock, and refund design are otherwise unaffected.

---

## R2 — Return window: length, source, and category awareness

**Decision**: Store the window in Vercel Edge Config under a new `returnsConfig` key, read via
`src/lib/edge-config.ts`, with a hardcoded fallback of **7 days** and an optional per-category
override map.

```ts
interface ReturnsConfig {
  readonly defaultWindowDays: number // fallback 7
  readonly categoryWindowDays: Readonly<Record<string, number>> // category NAME → days
  readonly nonReturnableCategoryNames: readonly string[]
}
```

**Keyed by category _name_, not id.** `products.category` is `text('category').notNull()` — a
denormalised free-text name with a `Product_category_idx` index and **no foreign key** to the
`Category` table. An earlier draft keyed this config by `categoryId`, which would have matched
nothing: every product would have silently fallen through to the default window while the
configuration appeared to be in effect. Lookup is case-insensitive, because nothing constrains
the casing of that free-text column.

**Per-order evaluation**: an order may span categories with different windows. The window is
evaluated **per item**, so an item in a non-returnable category is excluded individually rather
than disqualifying the entire order.

**Rationale**: The constitution designates Edge Config for "runtime configuration that is read
often but changes rarely (feature flags, shipping rates)" with mandatory hardcoded fallbacks —
a return window is exactly that. `shippingConfig` already establishes the pattern, so this adds
a key rather than a mechanism.

**Window is measured from delivery, not order creation** (spec Edge Cases). The `orders` table
has no `deliveredAt` column; it only has `status` and `updatedAt`. Using `updatedAt` is wrong —
any later mutation moves it. **A `deliveredAt` timestamp must be added to `orders`** and set by
the existing admin status-transition handler when status becomes `DELIVERED`. Existing delivered
orders backfill to `updatedAt` in the migration, which is the best available approximation and
must be noted in the migration comment.

**Alternatives considered**: Database-backed settings table (rejected — no such table exists,
and a read on every order-detail render would be a new query on a hot path). Environment
variable (rejected — not category-aware, requires redeploy to change).

---

## R3 — Shipping refund rule

**Decision**: Shipping is refunded **only when every unit on the order is returned**. Partial
returns refund goods and their discount share, never shipping or its tax.

**Rationale**: FR-011 requires "a documented shipping-refund rule" without prescribing one.
This rule is the standard commerce convention, is trivially explainable to the customer, and
avoids apportioning a single indivisible delivery across partial returns. It also guarantees
SC-004 reconciliation: the sum of all partial refunds for an order can never exceed
`subtotalAmount - discountAmount`, with `shippingAmount + taxAmount` only ever refunded once.

**Tax treatment**: Item tax is refunded proportionally with the item using the same
`allocateMoney` split (R4). Shipping tax follows shipping.

---

## R4 — Proportional discount allocation on partial returns

**Decision**: Add `allocateMoney(total: number, weights: readonly number[]): number[]` to
`src/lib/money.ts`, implementing largest-remainder allocation over integer minor units.

**Rationale**: `src/lib/money.ts` currently exposes `toMinorUnits`, `fromMinorUnits`,
`roundMoney`, `sumMoney`, `multiplyMoney`, `convertMoney`, `formatMoneyValue`, `parseMoney`,
and `isSupportedMoneyAmount` — there is no allocation primitive. Prorating a discount by
rounding each line independently does not sum back to the original: a ₹10.00 discount across
three equal lines yields 3 × ₹3.33 = ₹9.99, losing a paisa. Largest-remainder distributes the
residual minor units deterministically to the largest fractional parts, guaranteeing
`sum(allocateMoney(t, w)) === t` exactly.

**Contract**:

- Operates entirely on integer minor units, so no floating-point drift.
- Deterministic: ties broken by ascending index, so the same input always yields the same split.
- Sum invariant is the primary test assertion, exercised across randomised weight vectors.

**Per-item refundable amount**:

```text
grossLine        = item.price × returnedQuantity
discountShare    = allocateMoney(order.discountAmount, allLineGrossAmounts)[itemIndex]
                   × (returnedQuantity / item.quantity)
refundableAmount = grossLine − discountShare   (+ proportional item tax)
```

**Alternatives considered**: Storing a per-item discount at order creation (rejected — requires
backfilling every historical order and changing checkout, far outside this feature's scope).
Refunding gross price and absorbing the discount (rejected — over-refunds, violating SC-004).

---

## R5 — Cash on Delivery settlement path

**Decision**: A COD return records a refund row with `provider = 'COD'`,
`paymentTransactionId = null`, `gatewayRefundId = null`, `status = 'PENDING'`, and a reason
prefixed `MANUAL_SETTLEMENT:`. An admin action (`action: 'settle'`, permission
`orders:refund`) flips it to `PROCESSED`, sets `processedAt`, and writes an audit entry. The
gateway is never called.

**Rationale**: Verified in `src/lib/payments/cod.ts` — `codGateway.refund()` unconditionally
throws `PaymentVerificationError('Cash on Delivery refunds ... must be settled manually', 400)`.
Routing a COD return through `refundOrder` would surface as a 400 to the administrator with no
recovery path. Recording the obligation and settling it out of band is the only correct model:
the money owed is real and must be tracked even though the transfer happens offline.

**Schema consequence**: `refunds.paymentTransactionId` is currently `text(...).notNull()`. It
must become nullable (data-model M4). This is safe — the column is only read when reconciling
gateway webhooks, which never fire for COD.

**Alternatives considered**: Sentinel value `'COD_MANUAL'` in `paymentTransactionId` (rejected —
poisons webhook reconciliation, which treats the column as a real gateway reference). Skipping
the refund row entirely (rejected — the obligation becomes invisible and SC-004 unverifiable).

---

## R6 — Admin permission name

**Decision**: `'orders:returns'`, appended to `ADMIN_PERMISSIONS`, granted to `ADMIN`
(which already receives all permissions) and `SUPPORT`.

**Rationale**: `src/lib/constants/roles.ts` uses `<entity>:<action>` and already scopes order
capabilities as `orders:read`, `orders:update`, `orders:refund`. Returns triage is an order
capability, so `orders:returns` extends the existing family rather than introducing a new
entity namespace. `SUPPORT` already holds `orders:read` and `reviews:moderate` — triaging
customer returns is squarely support work. `FULFILMENT` receives it only if warehouse staff
mark receipt; deferred pending the operational decision, with `ADMIN` sufficient at launch.

**Note**: The COD "mark settled" action is gated on the existing `orders:refund`, not
`orders:returns`, because it moves money.

---

## R7 — Restock interaction with inventory reservations

**Decision**: Restock increments `productVariants.stock` only. `reservedStock` is never touched,
and no `StockReservation` row is created, consumed, or released.

**Rationale**: `016-inventory-reservation` **has shipped** — verified by the presence of the
`StockReservation` table, `stockReservationStatusEnum`, `productVariants.reservedStock` with its
non-negative check constraint, `src/features/orders/services/stock-reservation.ts`, and
`expireStockReservationsFunction` in the Inngest registry. Availability is derived as
`stock - reservedStock`, so incrementing `stock` alone makes returned units available while
leaving every live checkout hold intact. This satisfies the spec's edge case verbatim.

---

## R8 — Idempotency mechanism for partial restock

**Decision**: A `stockRestoredAt` timestamp on `ReturnRequest`, claimed by a guarded update
inside the transaction, mirroring the order-level pattern exactly:

```sql
UPDATE "ReturnRequest" SET "stockRestoredAt" = NOW()
WHERE id = $1 AND "stockRestoredAt" IS NULL
```

Only the claiming call proceeds to increment variant stock; concurrent or repeated calls see
zero affected rows and return `false`.

**Rationale**: Verified that `restockOrderItems` in
`src/features/orders/services/order-restock.ts` uses precisely this guarded-claim idiom against
`orders.stockRestoredAt` and returns a boolean indicating whether this caller performed the
work. Reusing the idiom keeps the concurrency reasoning identical to code already reviewed and
in production. It cannot reuse the _function_, because the order-level column is a single
all-or-nothing flag that a partial return must not consume.

**Soft-deleted variants**: `restockOrderItems` already updates variants regardless of
`deletedAt`. `restockReturnItems` matches that behaviour — the units physically exist and must
be counted; whether the variant is still sellable is a merchandising concern, not an inventory
one. This resolves the spec's "restocking a soft-deleted variant must be handled explicitly"
edge case with an explicit, documented choice rather than silent discard.

---

## R9 — Idempotency mechanism for refund issuance

**Decision**: A nullable, **unique** `refundId` on `ReturnRequest`, set in the same transaction
that transitions the return to `REFUNDED`. Refund creation is attempted only when `refundId IS
NULL`; the unique constraint is the backstop against a concurrent double-issue.

**Rationale**: `refundOrder` already protects the _order_ from over-refund by locking the order
row `FOR UPDATE` and counting non-`FAILED` refunds against the refundable balance. That protects
the order total but does not prevent one return from generating two refund rows that each fit
within the balance. The per-return unique link closes that gap. Both guards are retained —
`refundOrder`'s balance check remains the authority on SC-004 reconciliation.

**Gateway failure**: When the gateway rejects, `refundOrder` throws `RefundRequestError` (502)
after having reserved a `PENDING` row that settles to `FAILED`. The return stays at `RECEIVED`,
`refundId` remains unset, and the failure reason surfaces to admins from `refunds.errorMessage`.
The `RECEIVED → RECEIVED` retry transition in R12 is what makes that state recoverable — an
administrator re-issues the `refund` action once the underlying gateway problem is resolved. No
dedicated failure state is needed, but the retry action is mandatory; without it `RECEIVED` is
a dead end.

---

## R10 — Notification delivery

**Decision**: Publish `order/return.status.changed` through `dispatchWorkflowEvent` with an
inline `deliverReturnStatusNotification` fallback, consumed by a new
`sendReturnStatusEmailFunction` added to **`src/features/orders/inngest/emails.ts`** and
registered in `src/lib/inngest/registry.ts`, keyed for idempotency on `returnId + "-" + status`.

**Why `src/features/orders/inngest/emails.ts` and not `src/lib/inngest/functions/`**: the three
existing order email functions — `sendOrderConfirmationEmailFunction`,
`sendOrderStatusEmailFunction`, `sendOrderRefundEmailFunction` — all live in that file, and
their shared helpers `recordEmailFailure` and `finishEmailRun` are **module-private** (not
exported). Placing the return function elsewhere would force either exporting those helpers or
duplicating them, and would put a domain-specific concern in `src/lib/`, contradicting
constitution Principle VIII. `src/lib/inngest/functions/` holds only cross-domain scheduled work
(`email-retry.ts`, `exchange-rates.ts`, `stock-reservations.ts`).

**Rationale**: This mirrors `sendOrderStatusEmailFunction` exactly, including its
`idempotency: 'event.data.orderId + status'` pattern and its `dispatchWorkflowEvent(..., {
fallback })` degradation when Inngest is unconfigured. Preference enforcement is already
handled inside the delivery layer: `deliverOrderStatusNotification` resolves the recipient via
`resolveNotificationRecipient` and gates each channel on
`isChannelEnabled(preferences, 'transactional', channel)`. Reusing that path satisfies FR-014
and SC-006 without reimplementing preference logic.

**Category**: `transactional`. A return status update is a service communication about a
transaction the customer initiated, not marketing.

---

## R11 — Evidence upload security

**Decision**: Reuse `POST /api/upload` semantics in a new customer-scoped route
`POST /api/orders/[id]/returns/evidence`, applying the same magic-byte MIME check
(JPEG/PNG/GIF/WebP), the same `MAX_FILE_SIZE` cap from `src/lib/upload-constants.ts` and
`MAX_FORM_DATA_BODY_SIZE` — which is currently a **private const inside
`src/app/api/upload/route.ts`** and must be moved into `upload-constants.ts` as part of the
extraction — plus a per-order cap of 5 orphaned uploads.

**Rationale**: The existing `/api/upload` route is gated on `checkAdminAuth('products:write')`
and cannot be opened to customers. The validation logic, however, is exactly right and must not
be re-derived: magic-byte sniffing rather than trusting `Content-Type` is what prevents a
polyglot upload. Extracting the shared validator into `src/lib/upload-validation.ts` and having
both routes call it satisfies Principle VIII while keeping the two authorization models
separate.

**Serving**: Uploaded files are served from the blob provider's own origin
(`*.public.blob.vercel-storage.com` or the Azure account host), never from the application
origin, so a stored file can never execute as same-origin script. This is a property of
`uploadImage` today and requires no change — it is recorded here because the spec calls it out
as an edge case.

---

## R12 — Return state machine (AUTHORITATIVE)

**Decision**: Five states and five actions, enforced by a pure transition table in
`src/features/orders/services/return-state-machine.ts`. This section is the single source of
truth; [data-model.md](./data-model.md) and
[contracts/admin-returns.md](./contracts/admin-returns.md) restate it and must not diverge.

```text
REQUESTED ──approve──▶ APPROVED ──receive──▶ RECEIVED ──refund──▶ REFUNDED (terminal)
    │                      │                    │▲
    └──reject──▶ REJECTED ◀─┘                    └┘ refund retry after gateway failure
                 (terminal)
```

| From        | Action    | To         | Permission       | Side effects                     |
| ----------- | --------- | ---------- | ---------------- | -------------------------------- |
| `REQUESTED` | `approve` | `APPROVED` | `orders:returns` | Notification, audit log          |
| `REQUESTED` | `reject`  | `REJECTED` | `orders:returns` | Notification, audit log          |
| `APPROVED`  | `receive` | `RECEIVED` | `orders:returns` | **Restock**, notification, audit |
| `APPROVED`  | `reject`  | `REJECTED` | `orders:returns` | Notification, audit log          |
| `RECEIVED`  | `refund`  | `REFUNDED` | `orders:refund`  | **Refund**, notification, audit  |
| `RECEIVED`  | `refund`  | `RECEIVED` | `orders:refund`  | Retry after a gateway failure    |
| `REFUNDED`  | `settle`  | `REFUNDED` | `orders:refund`  | COD only — `PENDING → PROCESSED` |
| `REJECTED`  | —         | —          | —                | Terminal                         |

**Why `receive` and `refund` are separate actions.** An earlier draft collapsed them into a
single `receive → REFUNDED` transition. That is wrong: when the gateway rejects, `refundOrder`
throws and the return is left at `RECEIVED` — a state no action accepted as input, so the
return was permanently stranded. That is precisely the out-of-band support workflow this
feature exists to remove, and it contradicts the spec's "the return remains actionable"
requirement (User Story 3, scenario 4). Splitting the actions gives the failure a retry path.
It also aligns the permission boundary with the money boundary: `receive` moves inventory and
needs `orders:returns`; `refund` moves money and needs `orders:refund`.

**`RECEIVED → RECEIVED` on retry** is deliberate and is not a no-op: it re-attempts issuance
while `refundId IS NULL`. The UNIQUE `refundId` guard (R9) makes a successful retry
unrepeatable, and the restock claim (R8) is already spent, so a retry never double-restocks.

**`APPROVED → REJECTED` is retained** because goods may never arrive after approval, and
stranding the return in `APPROVED` forever has no operational exit. There is deliberately **no
customer-withdraw state**: the spec does not request it (YAGNI), and admin rejection already
covers the operational need.

**Concurrency**: Every transition executes inside a transaction that first re-reads the return
row `FOR UPDATE`, so two admins acting simultaneously serialise and the second sees the updated
state and is rejected by the transition table. This resolves the spec's "concurrent admin
actions must not produce conflicting states" edge case.

---

## R13 — Order cancellation after a return exists

**Decision**: `DELIVERED` is terminal in the existing `VALID_TRANSITIONS` map
(`DELIVERED: ['DELIVERED']`), so a delivered order cannot be cancelled and the double-refund
scenario is structurally impossible.

**Rationale**: Verified in `src/app/api/admin/orders/[id]/route.ts`. Customer cancellation is
additionally restricted to `CUSTOMER_CANCELLABLE_STATUSES = {PENDING, PROCESSING}`. Since
returns require `DELIVERED`, the spec's "return request for an order that is subsequently
cancelled" edge case cannot occur under the current transition rules. **No code is needed**;
a regression test asserting the invariant is, so a future transition-map change surfaces the
conflict immediately.

---

## R14 — Test conventions and coverage target

**Decision**: Service tests under `__tests__/features/orders/services/`, mirroring source
paths. The three pure modules — `return-state-machine`, `return-refund-calculator`,
`return-restock` — are tested exhaustively, which is what carries the coverage number.

**Rationale**: `vitest.config.mts` enforces a stricter per-path threshold for
`src/features/**/services/**/*.ts` — 85% lines/functions/statements, 76% branches — against a
global 80/74/80/80. SC-008 restates this. Concentrating branching logic in pure, dependency-free
functions makes that threshold cheap to hit and keeps `return-service.ts` (which is mostly
transaction orchestration) thin enough to cover with a handful of mocked-transaction tests.

---

## Summary of Decisions

| ID  | Decision                                                                    | Status               |
| --- | --------------------------------------------------------------------------- | -------------------- |
| R1  | Policy conflict — amend published terms (Option A recommended)              | ⛔ Awaiting business |
| R2  | 7-day window in Edge Config keyed by category **name**; `deliveredAt` added | ✅ Resolved          |
| R3  | Shipping refunded only on full-order return                                 | ✅ Resolved          |
| R4  | `allocateMoney` largest-remainder helper                                    | ✅ Resolved          |
| R5  | COD manual-settlement refund row; `paymentTransactionId` nullable           | ✅ Resolved          |
| R6  | Permission `orders:returns` for `ADMIN` + `SUPPORT`                         | ✅ Resolved          |
| R7  | Restock touches `stock` only, never `reservedStock`                         | ✅ Resolved          |
| R8  | `ReturnRequest.stockRestoredAt` guarded claim                               | ✅ Resolved          |
| R9  | Unique `ReturnRequest.refundId` guards refund issuance                      | ✅ Resolved          |
| R10 | Event + function in `src/features/orders/inngest/emails.ts`                 | ✅ Resolved          |
| R11 | Shared upload validator; orphaned-evidence model; blob serving              | ✅ Resolved          |
| R12 | Five states, five actions; `receive`/`refund` split for retry               | ✅ Resolved          |
| R13 | Cancel-after-return impossible; assert with a regression test               | ✅ Resolved          |
| R14 | Pure-function concentration to meet the 85% service threshold               | ✅ Resolved          |
