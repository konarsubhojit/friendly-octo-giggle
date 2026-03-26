# Feature Specification: Order Policy Confirmation

**Feature Branch**: `003-order-policy-dialog`  
**Created**: 2026-03-25  
**Status**: Draft  
**Input**: User description: "I want the to show details about order cancellation, return process and refund for orders when use clicks the Place Order button. A dialog with the items selected, the return policy and other details should popup and user should confirm that to proceed. Build the details from below points.

1. Order cancellation is allowed only before an order is shipped. Once shipped it should not be cancelled and no refund will be issued.
2. Orders cannot be returned except if the product is damaged. User should contact us through email with the detailed photos and the issue and will get back to you with the details.
3. No refunds will be issued. If your received product is damaged will ask you to send the product back to us and then will send you a new one.
4. Delivery charges of the product back to us should be beared upon by the customer. We wont charge any shipping fee to send the replacement."

## Clarifications

### Session 2026-03-25

- Q: Should this feature update only the checkout confirmation dialog, or also align existing Help and Returns policy surfaces? → A: Update the checkout confirmation dialog and also revise the existing Help and Returns pages to match the new policy.
- Q: Should the policy disclosure show a specific support email address or only generic contact guidance? → A: Show the explicit support email address in the dialog and on aligned policy pages.
- Q: What level of order detail should the confirmation dialog show for the shopper's selected items? → A: Show the full cart breakdown, including subtotal, shipping, and all totals.
- Q: Which email address should be shown as the explicit policy contact for damaged-product claims? → A: Use `support@estore.example.com` as the explicit policy contact email.
- Q: What interaction should count as explicit policy confirmation before the order is submitted? → A: Require a checkbox acknowledgment inside the dialog, then enable `Confirm and Place Order`.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Review policy before purchase (Priority: P1)

As a shopper ready to place an order, I want to review the selected items and the store's cancellation, return, and refund rules before the order is submitted so that I can make an informed decision.

**Why this priority**: This is the core value of the feature. It prevents users from placing orders without seeing the material terms that affect cancellation, return eligibility, and replacement handling.

**Independent Test**: Can be fully tested by attempting to place an order from checkout and confirming that the order is not submitted until the shopper has reviewed the policy details and explicitly confirms.

**Acceptance Scenarios**:

1. **Given** a shopper has items ready for checkout, **When** they select Place Order, **Then** the system shows a confirmation dialog containing the selected items and the policy details before the order is submitted.
2. **Given** the confirmation dialog is open, **When** the shopper does not confirm, **Then** the order submission does not proceed.
3. **Given** the confirmation dialog is open, **When** the shopper confirms after reviewing the details, **Then** the order submission proceeds.

---

### User Story 2 - Understand cancellation and return limits (Priority: P2)

As a shopper, I want the policy language to clearly explain when cancellation is allowed and when returns or refunds are not available so that I understand the consequences of placing the order.

**Why this priority**: The policy terms shape whether a user continues with purchase, but they are secondary to the requirement that the terms be shown before submission.

**Independent Test**: Can be fully tested by opening the confirmation dialog and verifying that the cancellation, return, refund, and damaged-item replacement rules are displayed in clear language.

**Acceptance Scenarios**:

1. **Given** the confirmation dialog is shown, **When** the shopper reads the policy section, **Then** it states that cancellation is allowed only before shipment and is not allowed after shipment.
2. **Given** the confirmation dialog is shown, **When** the shopper reads the policy section, **Then** it states that returns are not accepted except for damaged products.
3. **Given** the confirmation dialog is shown, **When** the shopper reads the policy section, **Then** it states that refunds are not issued and that damaged products are handled through a replacement process instead.

---

### User Story 3 - Know the damaged-product process (Priority: P3)

As a shopper, I want to understand what to do if a delivered product is damaged so that I know how to request help and what costs I am responsible for.

**Why this priority**: This information matters after purchase and supports trust, but it is less critical than disclosing the terms before the order is placed.

**Independent Test**: Can be fully tested by verifying that the confirmation dialog includes the damaged-product contact process, evidence required, replacement outcome, and shipping responsibility.

**Acceptance Scenarios**:

1. **Given** the confirmation dialog is shown, **When** the shopper reads the damaged-product instructions, **Then** it tells them to contact the business by email with detailed photos and a description of the issue.
2. **Given** the confirmation dialog is shown, **When** the shopper reads the damaged-product instructions, **Then** it states that the customer pays to send the damaged product back and the business covers shipping for the replacement.

### Edge Cases

- If the shopper closes or dismisses the dialog, the order remains unsubmitted and the shopper returns to checkout with their current selections unchanged.
- If the shopper has multiple items in the order, the dialog still presents the full selected-item summary together with the policy terms in a single review step.
- If policy details cannot be displayed for any reason, the order submission must be blocked rather than allowing checkout to continue without disclosure.
- If the shopper has not selected the acknowledgment checkbox, the order confirmation action remains unavailable and no order submission request is sent.
- If an order has already reached shipment after purchase, any later attempt to interpret the policy from this flow must remain consistent with the disclosed rule that cancellation is no longer allowed.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST intercept the shopper's Place Order action and present a confirmation step before submitting the order.
- **FR-002**: The confirmation step MUST display a summary of the items currently selected for purchase.
- **FR-002a**: The confirmation step MUST display the full cart pricing breakdown being confirmed, including itemized line entries, subtotal, shipping charge, and final total.
- **FR-003**: The confirmation step MUST display the order cancellation policy stating that cancellation is allowed only before the order is shipped.
- **FR-004**: The confirmation step MUST state that once an order has shipped, it cannot be cancelled and no refund will be issued.
- **FR-005**: The confirmation step MUST state that orders are not returnable except when a product is received in damaged condition.
- **FR-006**: The confirmation step MUST state that refunds are not issued for orders.
- **FR-007**: The confirmation step MUST state that damaged products are handled through review and replacement rather than refund.
- **FR-008**: The confirmation step MUST tell shoppers that damaged-product claims require contacting the business by email with detailed photos and a description of the issue, and it MUST display the support email address explicitly.
- **FR-009**: The confirmation step MUST state that the customer is responsible for the cost of shipping a damaged product back.
- **FR-010**: The confirmation step MUST state that the business will not charge shipping for sending the replacement product.
- **FR-011**: The system MUST require the shopper to explicitly confirm the displayed policy details before the order can proceed.
- **FR-011a**: The confirmation step MUST include an acknowledgment checkbox, and the final `Confirm and Place Order` action MUST remain disabled until the checkbox is selected.
- **FR-012**: The system MUST allow the shopper to cancel or dismiss the confirmation step without placing the order.
- **FR-013**: The policy wording shown during confirmation MUST remain consistent across checkout attempts unless the canonical shared policy content is intentionally updated.
- **FR-014**: The system MUST update the existing storefront Help and Returns policy surfaces so their cancellation, return, refund, and damaged-item replacement guidance matches the checkout confirmation policy.

### Key Entities _(include if feature involves data)_

- **Order Confirmation Review**: The pre-submission review state that presents selected items, policy details, and the shopper's choice to proceed or stop.
- **Checkout Pricing Summary**: The pricing breakdown shown in the confirmation step, including itemized line entries, subtotal, shipping charge, and final total for the pending order.
- **Policy Disclosure**: The set of purchase terms presented during order confirmation, including cancellation restrictions, damaged-item exception, no-refund rule, contact instructions, and shipping responsibilities.
- **Damaged Product Claim Guidance**: The customer-facing instructions that describe how to report damage, what evidence must be provided, and how replacement is handled.

## Assumptions

- The business already has an email contact channel that shoppers can use for damaged-product claims.
- The canonical support email address for this policy is `support@estore.example.com`, and it must be shown explicitly anywhere this policy is disclosed in scope for this feature.
- The disclosed policy applies uniformly to all products covered by the standard checkout flow.
- The same policy copy must be reflected on the checkout confirmation dialog, Help page, and Returns page so shoppers do not encounter conflicting guidance.
- Replacement of a damaged product is the only post-delivery remedy described in this feature.
- The shopper must confirm the policy each time they attempt to place an order through this checkout flow.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of orders placed through the standard checkout flow require a visible policy review and explicit shopper confirmation before submission.
- **SC-002**: At least 95% of test participants can identify the no-refund rule and the post-shipment cancellation restriction immediately after completing the confirmation step.
- **SC-003**: At least 90% of shoppers can complete the review-and-confirm step in under 60 seconds without assistance.
- **SC-004**: Support contacts disputing cancellation, return, or refund policy terms decrease by at least 30% within the first full measurement period after launch.
