# Feature Specification: Back-in-Stock and Price-Drop Alerts

**Feature Branch**: `019-stock-and-price-alerts`  
**Created**: 2026-08-01  
**Status**: Draft  
**Epic**: Phase 2 — Correctness and commerce depth  
**Input**: Let shoppers subscribe to a product variant and be notified when it returns to stock or drops in price, delivered through the existing email and web-push channels under the existing notification preference centre.

## Baseline (verified 2026-08-01)

- The delivery infrastructure is already shipped and in production use: web push (RFC 8291) with per-device `PushSubscription` records and automatic cleanup of expired endpoints, the modular email system under `src/lib/email/` with provider retries and failed-email persistence, and Inngest for durable, retryable dispatch.
- The consent infrastructure is already shipped: `NotificationPreference` carries independent `transactional` and `marketing` booleans for email, push, and SMS, and a preference centre exists at `src/app/(public)/account/NotificationsSection.tsx`.
- The abandoned-cart reminder feature (PR #428) establishes the exact pattern this feature follows: a scheduled scan function, a per-recipient send function, and a uniqueness constraint (`AbandonedCartReminder_cartId_reminderNumber_key`) that makes duplicate sends impossible.
- **The gap**: an out-of-stock product page offers no way to register interest. The demand signal is discarded, and the shopper must remember to return.
- Today the only capture mechanism for out-of-stock intent is the wishlist, which is a passive list with no notification behavior.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Subscribe to an out-of-stock variant (Priority: P1)

A shopper who wants an unavailable variant can ask to be told when it returns, and is told when it does.

**Why this priority**: This is the demand signal that is currently thrown away, and it converts a dead end into a recoverable session.

**Independent Test**: Open a product whose variant is out of stock, subscribe, restock the variant, run the dispatch job, and confirm exactly one notification is sent.

**Acceptance Scenarios**:

1. **Given** an out-of-stock variant, **When** a shopper opens the product, **Then** a back-in-stock subscription control is offered.
2. **Given** a shopper subscribes, **When** the subscription is stored, **Then** it is confirmed on screen and visible in their account.
3. **Given** a subscribed variant is restocked, **When** the dispatch job runs, **Then** the subscriber is notified through their permitted channels.
4. **Given** a notification has been sent for a subscription, **When** the job runs again, **Then** no duplicate notification is sent.
5. **Given** a variant that restocks and sells out repeatedly, **When** dispatch evaluates it, **Then** each subscription produces at most one notification per subscription.

---

### User Story 2 - Subscribe to a price drop (Priority: P2)

A shopper who finds a product too expensive can ask to be told if the price falls.

**Why this priority**: Captures price-sensitive demand and reuses the whole Story 1 pipeline, but it converts less urgently than restock intent.

**Independent Test**: Subscribe to a price drop, lower the variant price beyond the threshold, run dispatch, and confirm one notification containing both the old and new price.

**Acceptance Scenarios**:

1. **Given** an in-stock variant, **When** a shopper opens the product, **Then** a price-drop subscription control is offered.
2. **Given** a subscribed variant's price falls by at least the configured threshold, **When** dispatch runs, **Then** the subscriber is notified with the previous and current price.
3. **Given** a price that falls by less than the threshold, **When** dispatch runs, **Then** no notification is sent.
4. **Given** a price that rises, **When** dispatch runs, **Then** no notification is sent.
5. **Given** a price that oscillates within one dispatch window, **When** dispatch runs, **Then** at most one notification is sent per subscription.

---

### User Story 3 - Shoppers stay in control of alert volume (Priority: P1)

A shopper can see every alert they have requested, remove any of them, and never receive an alert on a channel they have not permitted.

**Why this priority**: Consent and control are not optional for outbound messaging. Sending on a disabled channel is a compliance and trust failure, which makes this equal in priority to the core capability.

**Independent Test**: Disable a channel in the preference centre, trigger an alert, and confirm nothing is delivered on that channel.

**Acceptance Scenarios**:

1. **Given** a shopper with subscriptions, **When** they open their account, **Then** every subscription is listed with the product, variant, and type.
2. **Given** a listed subscription, **When** the shopper removes it, **Then** no further notification is sent for it.
3. **Given** a channel disabled in the preference centre, **When** an alert fires, **Then** nothing is delivered on that channel.
4. **Given** every permitted channel is disabled, **When** an alert fires, **Then** nothing is sent and the subscription is not silently deleted.
5. **Given** any alert message, **When** it is delivered, **Then** it contains a working unsubscribe path.

---

### User Story 4 - Operators can see and trust the alert pipeline (Priority: P3)

An administrator can see subscription demand and dispatch outcomes.

**Why this priority**: Useful for merchandising and for diagnosing delivery problems, but the customer-facing capability delivers value without it.

**Independent Test**: Create subscriptions across products, open the admin view, and confirm demand counts and dispatch outcomes are visible.

**Acceptance Scenarios**:

1. **Given** subscriptions exist, **When** an authorized admin opens the view, **Then** per-variant demand counts are shown.
2. **Given** dispatch has run, **When** an admin reviews it, **Then** sent, skipped, and failed counts are visible.
3. **Given** a failed send, **When** it is recorded, **Then** it appears in the existing failed-email surface where applicable.

---

### Edge Cases

- A restock followed immediately by a sell-out must not notify shoppers into a dead end; dispatch must re-verify availability at send time.
- If `016-inventory-reservation` has shipped, availability must be evaluated as reservation-aware available quantity, not raw on-hand stock.
- A subscription for a soft-deleted product or variant must be suppressed and cleaned up.
- Expired or revoked push endpoints must be cleaned up by the existing mechanism rather than retried indefinitely.
- A bulk price update or a large restock must not produce an unbounded send burst; dispatch must be batched and rate-aware.
- Subscriptions must have a maximum lifetime so stale intent does not generate messages indefinitely.
- Duplicate subscription attempts for the same user, variant, and type must be idempotent.
- A subscriber who deletes their account must have subscriptions removed by cascade.
- Alert content must not disclose exact stock counts, consistent with the platform's existing stock-privacy rule.
- Currency in alert content must respect the shopper's stored currency preference.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Authenticated shoppers MUST be able to subscribe to back-in-stock alerts for a specific product variant.
- **FR-002**: Authenticated shoppers MUST be able to subscribe to price-drop alerts for a specific product variant.
- **FR-003**: Subscriptions MUST be unique per user, variant, and alert type, enforced by a database constraint.
- **FR-004**: A scheduled Inngest function MUST detect qualifying restock and price-drop events and dispatch notifications in bounded batches.
- **FR-005**: Dispatch MUST re-verify the triggering condition at send time and MUST skip subscriptions that no longer qualify.
- **FR-006**: Availability MUST be evaluated as reservation-aware available quantity where reservations exist.
- **FR-007**: A price drop MUST only qualify when it meets or exceeds a configurable threshold.
- **FR-008**: Each subscription MUST produce at most one notification, enforced by a uniqueness constraint in the pattern of `AbandonedCartReminder`.
- **FR-009**: Delivery MUST respect `NotificationPreference` for every channel, and MUST send nothing when no permitted channel remains.
- **FR-010**: Every alert MUST include a working unsubscribe path.
- **FR-011**: Shoppers MUST be able to view and remove their subscriptions from their account.
- **FR-012**: Subscriptions MUST expire after a documented maximum lifetime and MUST be cleaned up when their product or variant is soft-deleted.
- **FR-013**: Alert content MUST NOT disclose exact stock counts and MUST render prices in the shopper's preferred currency.
- **FR-014**: Failed sends MUST be retried through the existing email retry and failed-email persistence mechanisms; expired push endpoints MUST be cleaned up by the existing routine.
- **FR-015**: Administrators MUST be able to see per-variant demand counts and dispatch outcomes.
- **FR-016**: Schema changes MUST ship as a reviewed Drizzle migration with indexes for variant, user, and dispatch-scan lookups.
- **FR-017**: Metrics MUST be emitted for subscriptions created, alerts sent, skipped, and failed.
- **FR-018**: `docs/features.md` MUST document the alert types, consent model, and dispatch guarantees.

### Key Entities

- **StockAlertSubscription**: A request by one user for one variant and one alert type, with creation time, expiry, and dispatch state.
- **AlertDispatchRecord**: The record proving a subscription was notified, enforcing at-most-once delivery.
- **NotificationPreference**: The existing per-channel consent record that gates every send.
- **PriceDropThreshold**: The configurable minimum reduction that qualifies a price change as an alert-worthy drop.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A subscriber is notified within one dispatch window of a qualifying restock or price drop.
- **SC-002**: No subscription ever produces more than one notification.
- **SC-003**: No notification is delivered on a channel the shopper has not permitted.
- **SC-004**: Every alert contains a working unsubscribe path.
- **SC-005**: A restock that sells out before dispatch produces no notification.
- **SC-006**: A bulk price update or mass restock does not exceed the configured send rate.
- **SC-007**: No alert content contains exact stock counts.
- **SC-008**: Service-layer coverage for subscription and dispatch logic meets the 85% threshold for `src/features/**/services/**`.

## Out of Scope

- Guest subscriptions by email address without an account.
- SMS and WhatsApp delivery; the preference centre exposes those channels but this feature ships email and push only.
- Price-history charts or price-tracking analytics for shoppers.
- Promotional or campaign messaging beyond the two alert types.

## Dependencies

- Reuses the shipped web-push, email, notification-preference, and Inngest infrastructure.
- Should follow `016-inventory-reservation` so availability is evaluated correctly.
