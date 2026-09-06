# Feature Specification: Loyalty, Store Credit, and Gift Cards

**Feature Branch**: `022-loyalty-and-store-credit`  
**Created**: 2026-08-01  
**Last reviewed**: 2026-08-10  
**Status**: Draft — ready to plan  
**Epic**: Phase 3 — AI, interaction quality, and revenue levers  
**Input**: Introduce a ledger-backed balance system that earns loyalty points on purchases, issues store credit as a refund alternative, and supports purchasable gift cards, all redeemable at checkout through the existing discount application pipeline.

## Baseline (verified 2026-08-10)

Re-verified against the working tree at `f257e72`. Every prerequisite this specification named has now shipped, and the refund surface it plugs into is richer than the original draft assumed.

- **Discount engine — shipped.** `Coupon` supports `PERCENTAGE`, `FIXED_AMOUNT`, `FREE_SHIPPING`, and `BOGO`, with `minCartValue`, `maxDiscountAmount`, `scopedCategories`, `scopedProductIds`, `usageLimit`, `perUserLimit`, `usageCount`, `stackable`, and `startsAt`/`endsAt` validity windows. `CouponRedemption` rows carry `couponId`, `userId`, `orderId`, and `discountAmount`, and are inserted in the same transaction as the order.
- **Exact-decimal money — shipped.** The `money` column type is `numeric(12,2)`; all arithmetic runs through `src/lib/money.ts` (`roundMoney`, `sumMoney`, `multiplyMoney`, `allocateMoney`, `convertMoney`). `allocateMoney` in particular is the largest-remainder distributor this specification's redemption rounding rule should reuse rather than reinvent.
- **Order money columns — confirmed.** `Order` carries `subtotalAmount`, `shippingAmount`, `taxAmount`, `discountAmount`, `totalAmount`, `amountPaid`, plus `couponId` and a denormalized `couponCode`. A balance redemption needs its own column or ledger link; it must not be folded into `discountAmount`, or coupon reporting becomes unreadable.
- **Order pricing — centralized.** `src/features/orders/services/order-pricing.ts` exposes `calculateSubtotal` and `calculateOrderTotals`, composing `quoteShipping` and `calculateTax`. This is the single insertion point for redemption precedence; there is no second total calculation to keep in sync.
- **Refunds — richer than assumed.** The `Refund` table carries `provider`, `paymentTransactionId`, `gatewayRefundId` (unique), `returnRequestId` (unique — the double-refund guard), `amount`, `status` (`PENDING | PROCESSED | FAILED`), `reason`, `errorMessage`, `initiatedById`, and `processedAt`. `refund-service.ts` supports partial amounts, validates against a computed refundable balance, and sets `paymentStatus` to `PARTIALLY_REFUNDED` or `REFUNDED` correctly. Store credit therefore slots in as an **alternative settlement instrument against an already-correct refundable-balance calculation** — this specification does not need to fix refund arithmetic.
- **Returns — shipped (018).** `ReturnRequest`, `ReturnItem`, and `ReturnEvidence` exist with a state machine (`return-state-machine.ts`), a refund calculator (`return-refund-calculator.ts`), restock (`return-restock.ts`), and admin triage at `/admin/returns` via `PATCH /api/admin/returns/[id]`. Store-credit issuance is a new settlement branch inside that existing transition, not a new workflow. The COD `settle` transition — a return on a Cash-on-Delivery order that has no gateway refund path — is exactly where store credit has the highest value.
- **Currency — INR base, display conversion only.** `User.currencyPreference` defaults to `INR`; `refreshExchangeRatesFunction` refreshes USD/EUR/GBP daily with hardcoded fallbacks in `src/lib/currency.ts`. A ledger stored in anything other than INR would inherit that refresh cadence as a correctness dependency, which is unacceptable for financial data.
- **Audit — shipped.** `AdminAuditLog` exists with `userId`, `entity`, and `createdAt` indexes and is written by `src/features/admin/services/admin-audit-log.ts`. FR-013 and FR-014 write into this table; note that it currently has **no read surface** — see `024-admin-console-revamp`, which builds one.
- **The gap — unchanged.** No `loyalty`, `credit`, `gift`, `wallet`, `points`, or `balance` table, service, or route exists. Every discount is still coupon-shaped: externally issued, not earned, not owned, and not refundable into.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Earn and redeem loyalty points (Priority: P1)

A customer earns points on completed purchases and can apply them against a future order.

**Why this priority**: This is the retention mechanism the feature exists to provide, and it exercises the full earn-hold-redeem ledger cycle.

**Independent Test**: Complete an order, confirm points are credited after the order reaches its qualifying status, then redeem them on a subsequent order and confirm the balance and order total both reflect the redemption.

**Acceptance Scenarios**:

1. **Given** a completed order, **When** it reaches the qualifying status, **Then** points are credited to the customer's balance according to the earn rule.
2. **Given** a customer with a balance, **When** they view their account, **Then** the current balance and the transaction history are shown.
3. **Given** a customer with a balance, **When** they apply it at checkout, **Then** the order total is reduced by the redeemed amount and the remaining balance is shown.
4. **Given** an order that is cancelled or refunded, **When** it is processed, **Then** points earned from it are reversed.
5. **Given** points redeemed on an order that later fails, **When** the failure is processed, **Then** the redeemed balance is returned to the customer.

---

### User Story 2 - Store credit as a refund alternative (Priority: P1)

An administrator resolving a return can issue store credit instead of a gateway refund, and the customer can spend it.

**Why this priority**: Store credit retains revenue that a gateway refund removes permanently, and it is the natural completion of the returns work in `018-self-service-returns`.

**Independent Test**: Approve a return, choose store credit, and confirm the customer's balance increases by the correct amount and no gateway refund is issued.

**Acceptance Scenarios**:

1. **Given** an approved return, **When** an admin issues store credit, **Then** the customer's balance increases by the refundable amount and no gateway refund is created.
2. **Given** store credit is issued, **When** it is recorded, **Then** it is linked to the originating return and written to the admin audit log.
3. **Given** an order paid by Cash on Delivery, **When** a refund is required, **Then** store credit is an available settlement path.
4. **Given** issued store credit, **When** the customer checks out, **Then** it is redeemable in the same way as loyalty balance.

---

### User Story 3 - Gift cards (Priority: P2)

A customer can buy a gift card and a recipient can redeem its value.

**Why this priority**: A revenue and acquisition lever that reuses the balance ledger, but it introduces its own purchase and delivery flow, so it follows the core ledger stories.

**Independent Test**: Purchase a gift card, redeem its code on another account, and confirm the value transfers exactly once.

**Acceptance Scenarios**:

1. **Given** a customer purchases a gift card, **When** the order completes, **Then** a gift card with a unique code is issued and delivered to the recipient.
2. **Given** a valid unredeemed code, **When** a customer redeems it, **Then** its value is credited to their balance and the code is marked redeemed.
3. **Given** an already-redeemed, expired, or invalid code, **When** redemption is attempted, **Then** it is refused with a clear reason.
4. **Given** concurrent redemption attempts on one code, **When** they execute, **Then** exactly one succeeds.
5. **Given** a gift card purchase whose order is refunded, **When** the refund is processed, **Then** the gift card is voided if unredeemed and the conflict is surfaced to an admin if it is already redeemed.

---

### User Story 4 - Balances are auditable and reconcilable (Priority: P1)

Every change to a balance is an immutable ledger entry, and the balance always equals the sum of its entries.

**Why this priority**: This is financial data. A balance that cannot be reconciled is unusable for support and represents real financial exposure, which makes auditability equal in priority to the customer-facing capability.

**Independent Test**: Perform a sequence of earns, redemptions, reversals, and issuances, then confirm the derived balance equals the ledger sum at every step.

**Acceptance Scenarios**:

1. **Given** any balance change, **When** it occurs, **Then** an immutable ledger entry records the amount, type, actor, and originating entity.
2. **Given** a customer's ledger, **When** entries are summed, **Then** the total equals the reported balance.
3. **Given** a ledger entry, **When** a correction is required, **Then** a compensating entry is added and no existing entry is mutated or deleted.
4. **Given** a redemption, **When** it is applied, **Then** it is written in the same transaction as the order it applies to.
5. **Given** an administrator adjusts a balance, **When** the adjustment is made, **Then** it requires a reason and is written to the admin audit log.

---

### Edge Cases

- A balance must never go negative; redemption must be atomic against concurrent redemptions of the same balance.
- Redemption combined with coupons must follow documented precedence and must never make an order total negative.
- Balances are stored in the INR base currency; display conversion must not introduce rounding drift into the ledger.
- Rounding at redemption must be defined explicitly, and residual fractions must be retained in the ledger rather than silently discarded.
- Expiring points must be expired by a scheduled job with advance notice through the notification preference centre.
- Gift card codes must be unguessable and must be rate-limited against enumeration.
- Gift card codes must not be recoverable in plaintext from logs, exports, or error messages.
- A deleted user's outstanding balance requires a documented disposition rather than a silent cascade delete.
- Redemption on an order that fails during the durable checkout pipeline must be returned, mirroring the reservation release path.
- Earning must not apply to the gift-card purchase itself, or value can be manufactured through repeated buy-and-refund cycles.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST maintain a per-customer balance derived from an append-only ledger of immutable entries.
- **FR-002**: Ledger entries MUST record amount, type, actor, originating entity, and timestamp, and MUST NOT be mutated or deleted.
- **FR-003**: Corrections MUST be expressed as compensating entries.
- **FR-004**: All balance amounts MUST use the exact-decimal money representation; floating-point arithmetic is prohibited.
- **FR-005**: Balances MUST be stored in the INR base currency, with conversion applied only for display.
- **FR-006**: Points MUST be earned on orders reaching a documented qualifying status, according to a configurable earn rule.
- **FR-007**: Earned points MUST be reversed when their originating order is cancelled or refunded.
- **FR-008**: Gift-card purchases MUST NOT earn points.
- **FR-009**: Customers MUST be able to redeem balance at checkout, and redemption MUST be written in the same transaction as the order.
- **FR-009a**: A balance redemption MUST be recorded in a field distinct from `Order.discountAmount`, so coupon discount and balance redemption remain separately reportable.
- **FR-010**: Redemption MUST be atomic against concurrent redemptions and MUST NOT permit a negative balance.
- **FR-011**: Balance redemption combined with coupons MUST follow a documented precedence and MUST NOT produce a negative order total.
- **FR-012**: Redeemed balance MUST be returned when its order fails in the durable checkout pipeline.
- **FR-013**: Administrators MUST be able to issue store credit against a return, linked to that return and written to the admin audit log.
- **FR-014**: Administrators MUST be able to adjust a balance with a required reason, written to the admin audit log.
- **FR-015**: Gift cards MUST have unguessable codes, MUST be redeemable exactly once, and redemption attempts MUST be rate-limited against enumeration.
- **FR-016**: Gift card codes MUST NOT appear in logs, exports, metrics, or error messages.
- **FR-017**: Point expiry MUST be handled by a scheduled job with advance notice delivered under existing notification preferences.
- **FR-018**: Customers MUST be able to view their balance and full transaction history in their account.
- **FR-019**: Schema changes MUST ship as a reviewed Drizzle migration with indexes supporting per-user ledger queries and gift-card code lookup.
- **FR-020**: A deleted user's outstanding balance MUST follow a documented disposition rule.
- **FR-021**: `docs/features.md` MUST document the earn rule, redemption precedence, expiry policy, and gift-card lifecycle.

### Key Entities

- **BalanceLedgerEntry**: An immutable record of one balance change, with amount, type (earn, redeem, issue, reverse, expire, adjust), actor, originating entity, and timestamp.
- **CustomerBalance**: The derived spendable total for one customer, always equal to the sum of that customer's ledger entries.
- **GiftCard**: A purchasable instrument with a unique unguessable code, a face value, a redemption state, and an optional expiry.
- **EarnRule**: The configurable policy converting qualifying order value into earned balance.
- **RedemptionPrecedence**: The documented ordering rule for applying balance alongside coupons and shipping charges.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A customer's reported balance always equals the sum of their ledger entries.
- **SC-002**: No balance can be driven negative, including under concurrent redemption attempts.
- **SC-003**: A gift card code can be redeemed exactly once, including under concurrent attempts.
- **SC-004**: Points from a cancelled or refunded order are fully reversed.
- **SC-005**: Balance redeemed on a failed checkout is returned to the customer.
- **SC-006**: Every administrative balance change is attributable through the audit log.
- **SC-007**: Gift card codes never appear in logs, exports, or error messages.
- **SC-008**: Service-layer coverage for ledger and redemption logic meets the 85% threshold for `src/features/**/services/**`.

## Out of Scope

- Tiered membership levels, referral programs, and partner reward integrations.
- Transferring balances between customers.
- Cash-out or withdrawal of balance to a payment instrument.
- Physical gift card fulfillment.

## Dependencies

- Builds on the shipped discount engine, exact-decimal money handling (`allocateMoney` in particular), and the partial-refund service — all verified present, so no blocking dependency remains.
- Pairs with `018-self-service-returns`, which has shipped: store credit is a new settlement branch inside the existing return transition, and the COD `settle` path is its highest-value case.
- Interacts with `016-inventory-reservation`, which has shipped: redeemed balance must be released on the same checkout-failure paths that release a stock reservation.
- Administrative issuance and adjustment write to `AdminAuditLog`, which has no read surface until `024-admin-console-revamp` builds one. This does not block implementation, but the audit trail is effectively unreadable by humans until then.
