# Quickstart: Order Policy Confirmation

## Implementation Steps

1. Create `lib/constants/checkout-policies.ts` with the canonical support email and structured policy sections for cancellation, returns, refunds, damaged-item handling, and shipping responsibilities.
2. Add `components/cart/OrderPolicyConfirmDialog.tsx` to render:
   - itemized cart lines
   - subtotal, shipping, and total
   - policy sections using the shared constants
   - acknowledgment checkbox
   - cancel and `Confirm and Place Order` actions
3. Update `components/cart/CheckoutForm.tsx` to:
   - intercept the existing submit flow
   - open the dialog instead of posting immediately
   - run the current checkout enqueue + polling sequence only after confirmation
   - preserve current toast, cart clearing, and redirect behavior
4. Update `app/help/page.tsx` and `app/returns/page.tsx` to consume the same shared policy content so the wording stays aligned with checkout.
5. Add Vitest coverage for the dialog and checkout form gating behavior.
6. Add Playwright coverage for the cart-to-confirmation flow and capture screenshots of the changed UI.

## Verification Steps

1. Run `npm run lint`.
2. Run `npm run test`.
3. Run the targeted Playwright coverage for the cart/policy flow.
4. Run `npm run build`.

## Expected Results

- Clicking `Place Order` opens the review dialog instead of immediately creating a checkout request.
- The dialog shows the selected items, subtotal, shipping, and total.
- The policy copy matches the Help and Returns pages.
- The confirm action is disabled until the shopper checks the acknowledgment box.
- Confirming proceeds through the current checkout request flow and success redirect.
