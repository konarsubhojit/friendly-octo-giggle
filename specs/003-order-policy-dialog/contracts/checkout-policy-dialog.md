# Contract: Checkout Policy Dialog

## Scope

This feature adds a UI contract to the existing cart checkout flow. It does not change the external `/api/checkout` request or response schema.

## Participants

- `components/cart/CheckoutForm.tsx` — owns submit interception and checkout side effects.
- `components/cart/OrderPolicyConfirmDialog.tsx` — renders the review dialog and exposes confirm/cancel actions.
- `lib/constants/checkout-policies.ts` — provides canonical policy content and support email.
- `app/help/page.tsx` and `app/returns/page.tsx` — render the same policy content without acknowledgment gating.

## Input Contract

The dialog must receive or derive the following data before it is shown:

| Field              | Type                     | Notes                                                              |
| ------------------ | ------------------------ | ------------------------------------------------------------------ |
| `isOpen`           | `boolean`                | Controls visibility.                                               |
| `items`            | `CheckoutLineItem[]`     | Must include each selected cart line with quantity and line total. |
| `pricingSummary`   | `CheckoutPricingSummary` | Must include subtotal, shipping, and total.                        |
| `policyDisclosure` | `PolicyDisclosure`       | Canonical content shared across all in-scope surfaces.             |
| `isAcknowledged`   | `boolean`                | Tracks checkbox state.                                             |
| `isSubmitting`     | `boolean`                | Reflects confirmed checkout in progress.                           |

## Interaction Contract

1. Shopper activates `Place Order` from the cart.
2. The checkout form prevents immediate network submission and opens the dialog.
3. The dialog shows:
   - itemized selected items
   - subtotal, shipping, and total
   - cancellation, return, refund, and damaged-item replacement policy sections
   - explicit support email `support@estore.example.com`
   - acknowledgment checkbox
4. `Confirm and Place Order` remains disabled until the checkbox is selected.
5. If the shopper cancels or closes the dialog, no `/api/checkout` request is sent.
6. If the shopper confirms, the existing checkout submission path runs unchanged.

## Accessibility Contract

- The review surface must expose `role="dialog"` through a semantic dialog implementation.
- The dialog must have an accessible name and description.
- The checkbox must have an explicit label describing what is being acknowledged.
- Keyboard users must be able to reach the checkbox, cancel action, and confirm action in a logical order.

## Failure Contract

- If required policy content cannot be loaded or rendered, the dialog must present a blocking error message.
- In that state, `Confirm and Place Order` must remain unavailable.
- No `POST /api/checkout` request may be sent until policy content is visible and acknowledgment is possible.

## API Compatibility Contract

- `POST /api/checkout` remains unchanged.
- `CheckoutEnqueueResponse` and `CheckoutRequestStatusResponse` remain unchanged.
- The only behavioral change is timing: the request is sent after explicit client-side acknowledgment instead of immediately on the initial button press.

## Non-Goals

- No new persistence for policy acknowledgments.
- No CMS, Edge Config, or admin-managed policy editor.
- No changes to order creation semantics after the checkout request is submitted.
