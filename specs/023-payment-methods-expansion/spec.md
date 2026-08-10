# Feature Specification: Payment Methods Expansion and Reconciliation

**Feature Branch**: `023-payment-methods-expansion`  
**Created**: 2026-08-01  
**Last reviewed**: 2026-08-10  
**Status**: Draft — ready to plan; scope revised, see below  
**Epic**: Phase 3 — AI, interaction quality, and revenue levers  
**Input**: Extend the payment layer behind its existing gateway abstraction with a second provider, a shopper-facing method selection at checkout, additional checkout methods, and operator tooling to reconcile and replay webhook deliveries.

## Baseline (verified 2026-08-10)

Re-verified against the working tree at `f257e72`. **The correctness defect this specification was built around has been fixed since the original draft**, and a different, larger gap has surfaced in its place: the checkout has no payment-method selection at all.

- **Gateway abstraction — confirmed clean.** `PaymentGateway` in `src/lib/payments/gateway.ts` declares `provider`, `ensureConfigured()`, `createOrder()`, `verifyPayment()`, `verifyWebhook()`, and `refund()`. `src/lib/payments/registry.ts` resolves an implementation by provider name. `src/lib/payments/providers.ts` is a deliberately dependency-free capability table (`PAYMENT_PROVIDERS`, `PAYMENT_PROVIDER_CAPABILITIES`, `requiresPaymentSignature`, `settlesPaymentOnDelivery`) safe to import from schema, validations, and client bundles, and both helpers fail closed on an unknown provider. Adding a provider remains an additive change by design.
- **Registered providers — still exactly two.** `RAZORPAY` and `COD`, with capabilities `requiresSignature` and `settlesOnDelivery`.
- **Webhook idempotency — confirmed.** `WebhookEvent` carries a unique `(provider, eventId)`; `claimWebhookEvent` in `src/features/payments/services/payment-webhook-service.ts` lets the first claim win and permits a stale claim older than five minutes with a null `processedAt` to be reclaimed, so a delivery that died mid-flight is recovered rather than swallowed. Routes: `POST /api/payments/webhook` (legacy, defaults to Razorpay) and `POST /api/payments/webhook/[provider]`. Razorpay verification is HMAC-SHA256 with a timing-safe comparison; COD's `verifyWebhook` throws by design.
- **Partial refunds — RESOLVED, no longer a defect.** `paymentStatusEnum` now includes `PARTIALLY_REFUNDED`; `refund-service.ts` derives the status as `prepared.refundableBalance > 0 ? 'PARTIALLY_REFUNDED' : 'REFUNDED'`; `prepareRefund` locks the order, sums non-failed refunds, and rejects over-refunding; `Refund.returnRequestId` is uniquely constrained; `AdminOrderCard` and `Badge` render the state, and `src/features/orders/validations.ts` accepts it. **User Story 1 and FR-001 through FR-004 below are therefore already satisfied.** They are retained as regression requirements, not as work.
- **The new headline gap — there is no payment method selection.** `src/app/(public)/checkout/payment/page.tsx` renders a static placeholder: a dashed box labelled `Payment gateway (coming soon)` saying "Online payment integration is coming soon… payment details will be confirmed via email". The shopper never chooses a provider or a method; `checkoutRequest.paymentProvider` is populated from the request payload (`src/features/cart/services/checkout-service.ts`), not from a deliberate shopper choice. A fully functioning Razorpay gateway is wired up behind a checkout that will not offer it.
- **No operator webhook surface.** `WebhookEvent` rows are written and claimed but never displayed; there is no admin page, no route under `/api/admin` for deliveries, and therefore no way to notice or replay a delivery that never completed.
- **No stored instruments.** No UPI, wallet, net-banking, EMI, card-vaulting, tokenization, or saved-payment-method support exists anywhere in the tree — a definitive search result, not an inference.
- **Audit target exists.** `AdminAuditLog` is available for FR-015's replay records, but it has no human-readable surface until `024-admin-console-revamp` builds one.

### Scope revision (2026-08-10)

The original priority order opened with the partial-refund defect. That is fixed, so priorities shift: **User Story 5 (payment method selection at checkout) is now P1 and must land first** — every other story in this specification is unreachable by a shopper until the checkout offers a method. User Story 1 is demoted to a regression guarantee.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Partially refunded orders report accurately (Priority: P3 — already satisfied, retained as a regression guarantee)

An order that has been refunded in part is distinguishable from one refunded in full, everywhere it is reported.

**Why this priority**: This was the specification's opening defect. It was fixed before this specification was planned — `PARTIALLY_REFUNDED` exists in the enum, refund settlement derives the status from the remaining refundable balance, and the admin surfaces render it. The story is kept so the behavior is covered by explicit acceptance criteria and cannot silently regress while the provider work below churns the same service.

**Independent Test**: Refund part of a paid order and confirm the order reports a partially refunded state with the outstanding balance visible, while a full refund reports as fully refunded.

**Acceptance Scenarios**:

1. **Given** a paid order, **When** part of its value is refunded, **Then** its payment state reports as partially refunded and the remaining refundable balance is shown.
2. **Given** a partially refunded order, **When** the remaining balance is refunded, **Then** its payment state reports as fully refunded.
3. **Given** partially and fully refunded orders, **When** an admin filters or exports orders, **Then** the two are distinguishable.
4. **Given** orders that predate the partially-refunded state, **When** they are reported, **Then** their reported state matches their actual refund total; the migration establishing this has already run and MUST NOT be re-applied.

---

### User Story 5 - A shopper can choose how to pay (Priority: P1 — now the first story to land)

At the payment step a shopper is offered the payment options the platform actually supports, chooses one, and completes the purchase through it.

**Why this priority**: This is the gap that makes every other story in this specification unreachable. A fully implemented Razorpay gateway, signature verification, webhook settlement, and refund path all exist behind a checkout step that renders a static "coming soon" placeholder and never asks the shopper to choose. Adding a second provider or extra methods before this exists would add capability nobody can reach.

**Independent Test**: Open the payment step, confirm both configured options are offered with distinct labels, complete a purchase through each, and confirm the resulting order records the provider that was actually used.

**Acceptance Scenarios**:

1. **Given** configured providers, **When** a shopper reaches the payment step, **Then** each configured provider is offered as a selectable option with a clear label and a statement of when payment is taken.
2. **Given** a shopper selects a prepaid provider, **When** they confirm, **Then** the gateway payment flow is initiated and the order settles only on verified payment.
3. **Given** a shopper selects Cash on Delivery, **When** they confirm, **Then** the order is created in a pending-payment state that settles on delivery, consistent with the provider's `settlesOnDelivery` capability.
4. **Given** a provider that is not configured in the environment, **When** the payment step renders, **Then** that provider is not offered, and no error is shown for the providers that are configured.
5. **Given** the shopper's selection, **When** the checkout request is created, **Then** the recorded `paymentProvider` reflects the shopper's explicit choice, validated server-side against the registered provider list, and never a value trusted verbatim from the client without validation.
6. **Given** exactly one provider is configured, **When** the payment step renders, **Then** it is selected by default and the step does not present a meaningless single-option choice.

---

### User Story 2 - A second payment provider (Priority: P1)

Customers can pay through an additional provider, selected at checkout, without any change to order, refund, or webhook logic outside the provider's own module.

**Why this priority**: Single-provider dependency is a direct availability risk — a provider outage stops all prepaid revenue — and it caps the addressable market.

**Independent Test**: Register the new provider, complete a purchase through it end to end, and confirm order creation, webhook handling, and refunds all work without changes to shared services.

**Acceptance Scenarios**:

1. **Given** the new provider is registered and configured, **When** a shopper reaches checkout, **Then** it is offered as a payment option.
2. **Given** a shopper selects it, **When** they complete payment, **Then** the order is created through the same durable checkout pipeline as an existing provider.
3. **Given** a payment through the new provider, **When** it is verified, **Then** signature verification follows that provider's own scheme via `verifyPayment`.
4. **Given** a webhook from the new provider, **When** it is delivered, **Then** it is verified, deduplicated, and processed on the same path as existing providers.
5. **Given** an order paid through the new provider, **When** it is refunded in full or in part, **Then** the refund is issued through that provider's gateway.
6. **Given** the provider is not configured in an environment, **When** checkout loads, **Then** it is not offered and `ensureConfigured` fails closed with an actionable message.

---

### User Story 3 - Additional checkout methods (Priority: P2)

Shoppers can pay by the local methods they expect — UPI, wallets, and net banking — rather than cards alone.

**Why this priority**: A conversion lever with meaningful upside in the primary market, but it depends on the provider work and the accurate state model landing first.

**Independent Test**: Complete a purchase using each newly enabled method and confirm the order records which method was used.

**Acceptance Scenarios**:

1. **Given** enabled methods, **When** a shopper reaches payment, **Then** each available method is presented with its own clear label.
2. **Given** a shopper selects a method, **When** payment completes, **Then** the order records the method used.
3. **Given** a method is unavailable or fails, **When** the shopper is returned, **Then** they can retry or choose another method without losing their cart.
4. **Given** a method with a deferred confirmation, **When** confirmation is pending, **Then** the order remains in a pending payment state and settles only on the confirming webhook.

---

### User Story 4 - Operator webhook reconciliation (Priority: P2)

An operator can see webhook deliveries, identify ones that never completed, and safely replay them.

**Why this priority**: A webhook that dies mid-flight leaves an order in a wrong state with no operator visibility today. The schema already anticipates this case; only the tooling is missing.

**Independent Test**: Interrupt a webhook mid-processing, confirm it appears as unprocessed in the operator view, replay it, and confirm the order settles correctly and exactly once.

**Acceptance Scenarios**:

1. **Given** received webhooks, **When** an admin opens the reconciliation view, **Then** deliveries are listed with provider, event type, received time, and processed state.
2. **Given** a delivery that was never processed, **When** an admin replays it, **Then** its side effects run and it is marked processed.
3. **Given** an already-processed delivery, **When** a replay is attempted, **Then** it is refused or is a verified no-op, and side effects do not run twice.
4. **Given** any replay, **When** it is performed, **Then** the actor, target, and outcome are written to the admin audit log.
5. **Given** the reconciliation view, **When** it is accessed by a non-admin, **Then** access is refused.

---

### Edge Cases

- Concurrent partial refunds must not collectively exceed the refundable balance.
- Provider configuration must fail closed: an unconfigured provider is never offered and never silently degrades to another provider.
- Provider credentials and webhook secrets must never appear in logs, metrics, error messages, or client bundles.
- Webhook signature verification must remain mandatory for every provider; a replay must not bypass it.
- Replaying a delivery must reuse the existing idempotency guarantee rather than working around it.
- A provider outage must degrade to the remaining providers with a clear shopper-facing message, not a generic failure.
- Cash on Delivery settles on delivery and has no gateway refund path, so its refund route must remain explicitly modelled rather than assumed.
- Payment method identifiers returned by a provider must be validated before storage; they must not be trusted verbatim.
- The system must not store raw card data under any circumstance.
- Currency and exact-decimal money handling must be identical across providers; no provider may introduce its own rounding.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The payment status model MUST distinguish partially refunded from fully refunded orders. _(Satisfied: `PARTIALLY_REFUNDED` exists in `paymentStatusEnum`; retained as a regression requirement.)_
- **FR-002**: Refund settlement MUST derive payment status from the actual refunded total against the amount paid, not set a terminal state unconditionally. _(Satisfied in `refund-service.ts`; retained as a regression requirement.)_
- **FR-003**: Existing orders MUST report a payment status matching their actual refund history. _(Satisfied; the establishing migration has already run and MUST NOT be re-applied.)_
- **FR-004**: Admin order filtering and CSV export MUST expose the partially refunded state. _(Satisfied; retained as a regression requirement.)_
- **FR-004a**: The checkout payment step MUST present the configured providers as an explicit shopper choice, replacing the current static placeholder.
- **FR-004b**: The selected provider MUST be validated server-side against the registered provider list before it is persisted on a checkout request or order.
- **FR-004c**: Each offered option MUST state when payment is collected, so a prepaid provider and a settles-on-delivery provider are not presented as equivalent.
- **FR-005**: Concurrent refunds MUST NOT collectively exceed an order's refundable balance.
- **FR-006**: A second payment provider MUST be added purely as a new `PaymentGateway` implementation plus a registry and capability entry, with no change to order, checkout, or refund services.
- **FR-007**: Each provider MUST verify its own payment signatures and webhook signatures through the gateway interface.
- **FR-008**: An unconfigured provider MUST NOT be offered at checkout, and `ensureConfigured` MUST fail closed with an actionable message.
- **FR-009**: Provider credentials and webhook secrets MUST NOT appear in logs, metrics, error messages, or any client bundle.
- **FR-010**: Additional checkout methods MUST be selectable, and the method used MUST be recorded on the order.
- **FR-011**: Methods with deferred confirmation MUST leave the order in a pending payment state until the confirming webhook settles it.
- **FR-012**: A failed or abandoned payment attempt MUST return the shopper to checkout with their cart intact and the ability to retry or switch methods.
- **FR-013**: Administrators MUST have a view of webhook deliveries showing provider, event type, received time, and processed state.
- **FR-014**: Administrators MUST be able to replay an unprocessed webhook delivery, and replay MUST reuse the existing idempotency guarantee so side effects run exactly once.
- **FR-015**: Webhook replay MUST require admin authorization and MUST be written to the admin audit log.
- **FR-016**: Raw card data MUST NOT be stored, logged, or transmitted through the application under any circumstance.
- **FR-017**: Provider-supplied identifiers MUST be validated before persistence.
- **FR-018**: All providers MUST use the shared exact-decimal money handling; provider-specific rounding is prohibited.
- **FR-019**: Schema changes MUST ship as a reviewed Drizzle migration.
- **FR-020**: `docs/features.md` and `docs/deployment.md` MUST document the provider set, required configuration, and the reconciliation procedure.

### Key Entities

- **PaymentProvider**: A registered gateway with its capability flags, configuration requirements, and refund support.
- **PaymentMethod**: A shopper-selectable instrument offered by a provider, recorded on the resulting order.
- **PaymentState**: The order's settlement state, including a partially refunded state carrying the outstanding refundable balance.
- **WebhookDelivery**: A received provider event with provider, event id, event type, received time, and processed time, uniquely constrained per provider and event.
- **ReconciliationAction**: An operator replay of a delivery, with actor, target, outcome, and audit record.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-000**: A shopper can select a payment provider at checkout and complete a purchase through each configured provider, with the order recording the provider actually used.
- **SC-001**: A partially refunded order is distinguishable from a fully refunded one in the admin UI, filters, and CSV export.
- **SC-002**: No order's refunds can exceed its amount paid, including under concurrent refund attempts.
- **SC-003**: A complete purchase, webhook settlement, and refund succeed through the new provider without modification to shared order or checkout services.
- **SC-004**: An unconfigured provider is never offered and never causes a checkout error for an unrelated provider.
- **SC-005**: Replaying a webhook delivery produces its side effects exactly once, verified under repeated replay.
- **SC-006**: Every webhook replay is attributable through the admin audit log.
- **SC-007**: No provider credential or webhook secret appears in any log, metric, export, or client bundle.
- **SC-008**: Service-layer coverage for payment and refund logic meets the 85% threshold for `src/features/**/services/**`.

## Out of Scope

- Storing card details or building any card vault; tokenized instruments remain provider-held.
- Subscriptions, recurring billing, and mandates.
- Buy-now-pay-later and installment products.
- Multi-currency settlement; display conversion behavior is unchanged.
- Marketplace split payments and payouts to third-party sellers.

## Dependencies

- Builds on the shipped `PaymentGateway` abstraction, registry, capability table, webhook idempotency claim, and partial-refund service — all verified present, so no blocking dependency remains.
- The partial-refund correctness work this specification originally owned has already shipped; only the regression guarantees remain.
- Pairs with `022-loyalty-and-store-credit`, which introduces store credit as a settlement path alongside gateway refunds.
- Interacts with `018-self-service-returns`, which has shipped and increases refund volume, raising the value of accurate partial-refund reporting.
- The webhook reconciliation view (User Story 4) should follow `024-admin-console-revamp` so it is built on the unified admin list surface and its replay records land in an audit view a human can read, rather than adding one more bespoke admin screen that then has to be converted.
