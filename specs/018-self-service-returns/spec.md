# Feature Specification: Customer Self-Service Returns

**Feature Branch**: `018-self-service-returns`  
**Created**: 2026-08-01  
**Status**: Planned  
**Epic**: Phase 2 — Correctness and commerce depth  
**Input**: Let customers request a return for delivered order items, give administrators an approval queue, and connect approved returns to the existing refund and restock machinery.

## Scope Decision (2026-08-08) — damaged-item returns only

This feature is scoped to **Option B**: self-service returns are available only for items received
in damaged, defective, or incorrect condition. It is not a general change-of-mind returns
capability.

Consequences, binding on every requirement below:

- The reason set is restricted to damage categories. `CHANGED_MIND`, `SIZE_OR_FIT`, and
  `NOT_AS_DESCRIBED` are **out of scope**.
- Photographic evidence is **mandatory**, not optional — the published policy already requires
  it before any damaged-item claim is reviewed.
- **Images upload in-product; video does not.** The published policy also requires "a short
  video". Video is collected out-of-band over Instagram direct message, correlated by return ID.
  See the Evidence Channel decision below.
- Approved claims are settled by **refund**, which requires a policy amendment (below).

### Evidence channel — images in-product, video over Instagram DM

The published `damagedItems` clause requires three artifacts: **detailed photos, a short video,
and a description**. This feature accepts photos and description in-product and directs video to
an Instagram direct message.

**Why video is not uploaded here**: the existing upload path is image-specific end to end —
`uploadImage` in `src/lib/image-storage.ts`, magic-byte detection limited to JPEG/PNG/GIF/WebP,
and a 5 MB `MAX_FILE_SIZE` that no usable phone video fits inside. Supporting video means a
second storage path, a second size regime, transcoding or playback concerns, and a materially
larger abuse surface — disproportionate to a media type the admin reviews once. Instagram
already handles capture, compression, and delivery.

**How correlation works**: the customer is shown their return ID after submission with a copy
control and a direct link to the store's Instagram inbox. They send the video quoting that ID.
The administrator finds the DM by searching the ID. **No social handle is stored** — see FR-020.

**Where the handle lives**: the handle and its DM link are static constants in
`src/lib/constants/store.ts`, because they appear in the acknowledged policy copy that a Client
Component imports synchronously. Whether the channel is _offered_ is an Edge Config feature flag
(`returnVideoViaInstagram`, default `false`), so an unstaffed inbox can be switched off without a
deploy. See plan research R15.

### Residual policy delta — three clauses require amendment

Option B narrows the amendment surface but does not eliminate it. The published policy conflicts
with this feature in three separate places, and all three are carried by T063:

| Clause         | Current text                                                                    | Conflict                                                                         |
| -------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `refunds`      | "Refunds are not issued for orders." / "...replacement rather than refund."     | **Settlement.** FR-010 to FR-013 and SC-004 assume refund.                       |
| `returns`      | "Shoppers **must contact support** with detailed photos, a short video..."      | **Channel.** This feature replaces the email channel with in-product submission. |
| `damagedItems` | "**Email** support@... with detailed photos, a short video, and a description." | **Channel and media.** Photos move in-product; video moves to Instagram DM.      |

Every success criterion involving money (SC-004, FR-010 through FR-013) assumes refund
settlement. Two ways to close the settlement conflict, and that choice remains a business one:

| Option  | Change required                                                                                                                                                               |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B-1** | Amend the `refunds` and `damagedItems` clauses to permit refund as a settlement for approved damage claims where replacement is unavailable. Narrow, one-paragraph amendment. |
| **B-2** | Settle approved claims by replacement only, matching the current text verbatim. This removes the entire refund half of the feature and is materially Option C.                |

**B-1 is assumed by the rest of this specification.** If B-2 is chosen instead, FR-010 through
FR-013, SC-004, and User Story 3's refund half must be struck and replaced with a replacement
fulfilment flow.

The **channel** and **media** amendments are not optional under either sub-option — they follow
from shipping an in-product claim form at all.

## Baseline (verified 2026-08-01)

- Refunds already exist as an admin-initiated capability. The `Refund` table records provider, `paymentTransactionId`, `gatewayRefundId`, amount, status (`PENDING`, `PROCESSED`, `FAILED`), reason, `initiatedById`, and `processedAt`, and is served by `src/features/orders/services/refund-service.ts`.
- Pre-shipment cancellation is shipped (PR #427) and restocks through `src/features/orders/services/order-restock.ts` with status-transition enforcement.
- **The gap**: once an order reaches `DELIVERED`, a customer has no in-product path to start a damaged-item claim. Every post-delivery claim is an out-of-band support request — the policy directs the customer to email support with photos and a video — that an admin must then translate into a manual settlement.
- The published policy in `src/lib/constants/checkout-policies.ts` and `specs/003-order-policy-dialog` **permits damaged-item returns but forbids refunds**, and is acknowledged by the customer at checkout. The damaged-item process it describes — submit evidence, await review, ship the product back at the customer's cost — is exactly the lifecycle this feature automates. The settlement mechanism, the submission channel, and the video requirement all differ, hence the three-clause amendment above.
- The policy is restated on **four additional surfaces** that must stay in step, two of which hardcode their copy rather than deriving it from `CHECKOUT_POLICIES`: `src/app/(public)/returns/page.tsx` (the `RETURN_STEPS` array and the "Refunds are not issued" reminder are both hardcoded), `src/app/(public)/help/page.tsx` (the return-policy FAQ answer is hardcoded), `src/app/(public)/checkout/review/page.tsx`, and `src/features/cart/components/OrderPolicyConfirmDialog.tsx`. Amending the constant alone leaves the hardcoded copy stale.
- There is **no social handle constant** anywhere in the codebase; `SUPPORT_EMAIL` in `src/lib/constants/checkout-policies.ts` is the only contact detail. The Instagram handle is new and belongs in `src/lib/constants/store.ts` alongside `STORE_NAME`.
- Supporting infrastructure exists: order status enum ending at `DELIVERED`/`CANCELLED`, image upload through Vercel Blob and Azure Blob (`src/lib/image-storage.ts`), the notification preference centre and email/push channels, `adminAuditLogs`, and granular admin permissions in `src/lib/constants/roles.ts`.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Request a return for a delivered item (Priority: P1)

A customer can open a delivered order, select the items and quantities to return, choose a damage reason, attach photographic evidence, and submit a claim without emailing support. After submitting, they are told how to send the required video over Instagram.

**Why this priority**: This is the missing customer-facing capability. Everything else in this specification exists to process what this story creates.

**Independent Test**: Sign in as a customer with a delivered order, submit a damage claim for one item with a photo, and confirm the request is persisted, visible in order history, and followed by an Instagram video prompt carrying the return ID.

**Acceptance Scenarios**:

1. **Given** a delivered order inside the return window, **When** the customer opens it, **Then** a return action is available for eligible items.
2. **Given** the return form, **When** the customer selects items, quantities, a damage reason, and attaches at least one image, **Then** the request is persisted and acknowledged on screen.
3. **Given** an order outside the return window or not yet delivered, **When** the customer views it, **Then** no return action is offered and the reason is explained.
4. **Given** an item already fully returned, **When** the customer requests again, **Then** the already-returned quantity is excluded from the selectable amount.
5. **Given** a return request is submitted, **When** it is accepted, **Then** the customer receives a confirmation through their preferred, permitted channel.
6. **Given** a submitted return, **When** the confirmation is shown, **Then** the return ID, a control to copy it, and a direct link to the store's Instagram inbox are presented with an instruction to send the video quoting that ID.
7. **Given** the customer attempts to attach a video file to the form, **When** the file is selected, **Then** it is rejected with a message directing them to Instagram rather than a generic type error.

---

### User Story 2 - Administrators triage the return queue (Priority: P1)

An administrator can review pending returns with order context and evidence, then approve or reject each with a recorded reason.

**Why this priority**: A request that nobody can action has no value. The queue is the operational half of Story 1.

**Independent Test**: Submit return requests as a customer, open the admin returns queue, and approve one and reject another with reasons.

**Acceptance Scenarios**:

1. **Given** pending return requests, **When** an authorized admin opens the returns queue, **Then** each request shows its order, items, quantities, reason, and evidence.
2. **Given** a pending request, **When** an admin approves it, **Then** its status advances and the customer is notified.
3. **Given** a pending request, **When** an admin rejects it, **Then** a reason is required, recorded, and communicated to the customer.
4. **Given** any approval or rejection, **When** it is recorded, **Then** an entry is written to the admin audit log identifying the actor.
5. **Given** an admin without the returns permission, **When** they attempt to access the queue, **Then** access is refused by the existing role gate.

---

### User Story 3 - Approved returns restock and refund correctly (Priority: P1)

When returned goods are received, the units re-enter inventory and the customer is refunded through the existing refund pipeline.

**Why this priority**: This is where money and inventory move. An error here is a direct financial or inventory loss, so it must be as rigorous as the refund path it extends.

**Independent Test**: Approve a return, mark it received, and confirm variant stock increases by the returned quantity and a linked refund record is created for the correct amount.

**Acceptance Scenarios**:

1. **Given** an approved return, **When** it is marked received, **Then** each returned unit is restocked to its originating variant.
2. **Given** a received return, **When** the refund is issued, **Then** a `Refund` record is created and linked to the return.
3. **Given** a partial return, **When** the refund amount is computed, **Then** it reflects the returned items' paid price including their share of any applied discount, and follows the documented shipping-refund rule.
4. **Given** a refund that the gateway rejects, **When** the failure is recorded, **Then** the return remains actionable and the failure reason is visible to admins.
5. **Given** a return processed more than once, **When** the duplicate is attempted, **Then** neither the restock nor the refund is applied twice.
6. **Given** an order paid by Cash on Delivery, **When** the refund for a received return is issued, **Then** the documented settlement path for non-captured payments is followed rather than a gateway refund.

---

### User Story 4 - Return status is transparent to the customer (Priority: P2)

A customer can see where their return stands and what happens next, without contacting support.

**Why this priority**: Return status opacity is a leading driver of support contact, but it depends on the lifecycle established by the preceding stories.

**Independent Test**: Submit a return and confirm its status is visible in order history and updates as the admin progresses it.

**Acceptance Scenarios**:

1. **Given** a submitted return, **When** the customer opens the order, **Then** the current return status and next step are shown.
2. **Given** a return status change, **When** it occurs, **Then** the customer is notified through channels permitted by their notification preferences.
3. **Given** a rejected return, **When** the customer views it, **Then** the recorded reason is shown.
4. **Given** a refunded return, **When** the customer views it, **Then** the refunded amount and its issue date are shown.

---

### Edge Cases

- The return window must be evaluated against delivery date, not order date, and must be configurable per category.
- A request submitted with no evidence image must be rejected before any row is written.
- A customer attempting to attach a video must be told where to send it, not merely told the type is unsupported.
- The Instagram handle must resolve to a real, monitored inbox before the channel is enabled; a dead link is worse than the email fallback it replaces. The feature flag defaults to off so that shipping the code and enabling the channel are separate decisions.
- Uploaded evidence is untrusted input: type, size, and count must be validated, and files must never be executed or served from an application origin that could enable script execution.
- A return whose refund exceeds the amount actually captured for those items must be rejected.
- Restocking a soft-deleted variant must be handled explicitly rather than silently discarded.
- A return request for an order that is subsequently cancelled must not double-refund.
- Concurrent admin actions on the same return must not produce conflicting states.
- Returns must not restock items the customer never sent back; restock happens at received, not at approved.
- If `016-inventory-reservation` has shipped, restocked units must re-enter on-hand stock without disturbing live reservations. (Verified shipped — see plan research R7.)
- Customers must only ever see and act on their own returns; ownership must be enforced server-side on every operation.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Customers MUST be able to request a return for items in a `DELIVERED` order within a configurable return window measured from delivery.
- **FR-002**: The return request MUST capture per-item quantities and a reason drawn from the damage-only reason set: damaged in transit, defective on arrival, or wrong item received. Change-of-mind and fit reasons MUST NOT be offered.
- **FR-003**: Requestable quantity MUST exclude quantities already returned or pending return for the same order item.
- **FR-004**: Every return request MUST carry at least one evidence **image** and at most five, each validated for type and size and stored through the existing image-storage abstraction. A request without evidence MUST be rejected, because the published policy requires evidence before any damage claim is reviewed. Video files MUST NOT be accepted by this endpoint.
- **FR-005**: Every return operation MUST enforce ownership server-side; a customer MUST NOT read or mutate another customer's return.
- **FR-006**: The return lifecycle MUST be an explicit state machine with enforced transitions, and invalid transitions MUST be rejected.
- **FR-007**: Administrators MUST have a returns queue guarded by a granular admin permission consistent with `src/lib/constants/roles.ts`.
- **FR-008**: Approval and rejection MUST require a recorded reason and MUST write to the admin audit log.
- **FR-009**: Marking a return received MUST restock each returned unit to its originating variant, using a return-scoped restock claim so that partial and repeated returns against one order each restock exactly once. The existing order-level restock service MUST NOT be reused for this, because its single order-level guard cannot express partial restock (see plan D1).
- **FR-010**: Refunds for received returns MUST be created through the existing refund service and linked to the return record — except for Cash on Delivery orders, which follow FR-013's manual settlement path because the COD gateway has no refund capability.
- **FR-011**: Partial-return refund amounts MUST reflect the items' paid price including their proportional share of applied discounts, following a documented shipping-refund rule.
- **FR-012**: Restock and refund MUST each be idempotent; repeated processing of one return MUST NOT apply either twice.
- **FR-013**: Cash on Delivery orders MUST follow a documented settlement path rather than a gateway refund.
- **FR-014**: Customers MUST be notified of return status changes through channels permitted by their notification preferences.
- **FR-015**: Return status, reason, and refunded amount MUST be visible to the customer in order history and order detail.
- **FR-016**: Schema changes MUST ship as a reviewed Drizzle migration with indexes for order, user, and status lookups.
- **FR-017**: Returns MUST be included in the existing admin CSV export capability.
- **FR-018**: `docs/features.md` and `specs/003-order-policy-dialog` MUST be updated, and the `refunds`, `returns`, and `damagedItems` clauses in `src/lib/constants/checkout-policies.ts` MUST be amended — for settlement (B-1), submission channel, and video channel respectively — so the published policy and the implemented mechanism agree. Every surface that restates the policy, including the hardcoded copy in `src/app/(public)/returns/page.tsx` and `src/app/(public)/help/page.tsx`, MUST be updated in the same change.
- **FR-019**: After a return is submitted, the customer MUST be shown the return ID, a control to copy it, and a direct link to the store's Instagram inbox, with an instruction to send the required video quoting that ID. The link MUST open in a new tab with `rel="noopener noreferrer"`. The prompt MUST be gated on the `returnVideoViaInstagram` feature flag; when the flag is off, the customer MUST instead be directed to email the video to the support address, so the channel is never simply absent.
- **FR-020**: The system MUST NOT store the customer's social handle or any Instagram identifier. Correlation between a direct message and a return MUST rely solely on the customer quoting the return ID, so the feature introduces no new personal data.

### Key Entities

- **ReturnRequest**: A customer-initiated request against one order, with status, reason, timestamps, and the acting administrator for each decision.
- **ReturnItem**: A requested quantity of one order item, carrying the computed refundable amount for that quantity.
- **ReturnEvidence**: An uploaded image, validated and stored through the image-storage abstraction. Created before the return exists and attached to it on submission, so it carries its own owner and order scope during that window.
- **Refund**: The existing refund record, extended with a link to the return that caused it.
- **Return Window**: The configurable, category-aware period after delivery during which a return may be requested. Not a database entity — it is runtime configuration held in Edge Config with a hardcoded fallback, keyed by category name (see plan research R2).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A customer can complete a return request for a delivered order without contacting support.
- **SC-002**: Every return decision is attributable to a specific administrator through the audit log.
- **SC-003**: Restocked quantities exactly equal received quantities, with no double-counting under repeated processing.
- **SC-004**: Refund amounts for partial returns reconcile against the amount originally captured for those items.
- **SC-005**: No customer can read or modify another customer's return request.
- **SC-006**: Return status changes reach customers only through channels their notification preferences permit.
- **SC-007**: Uploaded evidence outside the permitted type, size, or count is rejected, and a request carrying no evidence at all is rejected.
- **SC-008**: Service-layer coverage for return processing meets the 85% threshold for `src/features/**/services/**`.
- **SC-009**: Every customer who submits a return is given the return ID and a working route to send the required video, without needing to consult the policy page.
- **SC-010**: No Instagram handle or other social identifier is persisted by the feature.

## Out of Scope

- **Change-of-mind, fit, and "not as described" returns.** This feature covers damaged, defective, and wrong-item claims only (see Scope Decision).
- **In-product video upload.** Video is collected over Instagram direct message; the upload endpoint accepts images only. Adding video would require a second storage path, a separate size regime, and playback handling — see the Evidence Channel decision.
- **Automated ingestion of Instagram messages.** No API integration, no inbox polling, no linking of a DM to a return record. Correlation is manual, by return ID.
- Carrier integration, return shipping labels, and pickup scheduling. The published policy makes return shipping the customer's cost and responsibility.
- Exchanges for a different product or variant; this specification covers returns and refunds only.
- Automated fraud scoring of return requests.
- Warehouse inspection or grading workflows beyond a received or not-received decision.

## Dependencies

- Extends the shipped refund and cancellation work from PR #427 and the restock service.
- Depends on `016-inventory-reservation`, which **has shipped**: restock must increment on-hand `stock` without disturbing `reservedStock` or any live reservation row.
- Pairs naturally with `022-loyalty-and-store-credit`, which can offer store credit as a refund alternative.
