# Data Model: Order Policy Confirmation

## 1. OrderConfirmationReview

- **Purpose**: Represents the transient client-side review state between the shopper clicking `Place Order` and the existing checkout request being sent.
- **Fields**:
  - `isOpen: boolean` — whether the dialog is visible.
  - `isAcknowledged: boolean` — whether the shopper selected the policy checkbox.
  - `isSubmitting: boolean` — whether the confirmed checkout request is currently being enqueued or polled.
  - `submitError: string | null` — surfaced if the underlying checkout flow fails after confirmation.
- **Relationships**:
  - References one `CheckoutPricingSummary`.
  - References one or more `CheckoutLineItem` entries.
  - References one `PolicyDisclosure`.
- **Validation rules**:
  - `Confirm and Place Order` remains disabled while `isAcknowledged === false`.
  - Closing the dialog resets `isOpen` and returns the user to the cart without invoking checkout.
- **State transitions**:
  - `idle -> review_open`
  - `review_open -> acknowledged`
  - `review_open -> dismissed`
  - `acknowledged -> submitting`
  - `submitting -> completed | failed`

## 2. CheckoutLineItem

- **Purpose**: Shopper-visible representation of each cart entry included in the review dialog.
- **Fields**:
  - `id: string`
  - `productName: string`
  - `variationLabel: string | null`
  - `quantity: number`
  - `unitPrice: number`
  - `lineTotal: number`
  - `customizationNote: string | null`
- **Relationships**:
  - Derived from `CartItemWithProduct` in `lib/types.ts`.
  - Aggregated into `CheckoutPricingSummary` totals.
- **Validation rules**:
  - `quantity >= 1`
  - `unitPrice >= 0`
  - `lineTotal = unitPrice * quantity`
  - `variationLabel` is present only when a variation/design was selected.

## 3. CheckoutPricingSummary

- **Purpose**: Canonical price breakdown shown both in the cart sidebar and in the policy confirmation dialog.
- **Fields**:
  - `itemCount: number`
  - `subtotal: number`
  - `shippingAmount: number`
  - `shippingLabel: string`
  - `total: number`
- **Relationships**:
  - Computed from the set of `CheckoutLineItem` entries.
  - Consumed by `OrderConfirmationReview`.
- **Validation rules**:
  - `subtotal` equals the sum of all line totals.
  - `total = subtotal + shippingAmount`.
  - Display formatting must always use the active currency formatter rather than raw `$` strings.

## 4. PolicyDisclosure

- **Purpose**: Structured canonical policy content reused across checkout, Help, and Returns surfaces.
- **Fields**:
  - `supportEmail: "support@estore.example.com"`
  - `cancellationRules: readonly string[]`
  - `returnRules: readonly string[]`
  - `refundRules: readonly string[]`
  - `damageClaimSteps: readonly string[]`
  - `shippingResponsibilityRules: readonly string[]`
- **Relationships**:
  - Referenced by `OrderConfirmationReview`.
  - Reused by static Help and Returns content.
- **Validation rules**:
  - The explicit support email must be displayed on every in-scope surface.
  - The copy must describe replacement as the only damaged-item remedy.
  - The copy must state that returns are not accepted except for damaged items.

## 5. PolicySurfaceProjection

- **Purpose**: Describes how the same `PolicyDisclosure` content appears on different UI surfaces.
- **Fields**:
  - `surface: "checkout-dialog" | "help-page" | "returns-page"`
  - `sections: readonly string[]`
  - `requiresAcknowledgment: boolean`
- **Relationships**:
  - Uses one `PolicyDisclosure`.
- **Validation rules**:
  - `checkout-dialog` must include `requiresAcknowledgment = true`.
  - `help-page` and `returns-page` must render matching policy meaning, even if the layout differs.
