# Research: Order Policy Confirmation

## Decision 1: Keep the confirmation step inside the existing client-side checkout flow

- **Decision**: Intercept `Place Order` in `components/cart/CheckoutForm.tsx`, open a dedicated `OrderPolicyConfirmDialog`, and invoke the existing `/api/checkout` request only after explicit confirmation.
- **Rationale**: The current cart and checkout interaction already lives in a Client Component backed by Redux and `next-auth` hooks. Next.js App Router guidance supports keeping interactivity in a Client Component while passing only serializable data across boundaries. Preserving the current API route avoids unnecessary contract churn and keeps logging, auth checks, and queueing behavior unchanged.
- **Alternatives considered**:
  - Refactor checkout to a Server Action: rejected because the existing checkout pipeline already uses a typed API client and asynchronous request polling.
  - Submit immediately and ask for confirmation in the backend: rejected because the spec requires blocking submission until the user explicitly confirms.

## Decision 2: Use a feature-specific rich dialog instead of stretching the generic confirm dialog

- **Decision**: Build a dedicated `components/cart/OrderPolicyConfirmDialog.tsx` rather than broadening `components/ui/ConfirmDialog.tsx` to support structured cart content, policy sections, and checkbox gating.
- **Rationale**: The generic confirm dialog is optimized for short title/message confirmations. This feature needs itemized content, totals, email disclosure, and a required acknowledgment checkbox. A specialized component keeps the shared primitive simple and aligns with the repo's existing native `dialog` pattern used on the order detail page.
- **Alternatives considered**:
  - Extend `ConfirmDialog` with `children`, checkbox props, and layout branches: rejected because it would add feature-specific complexity to a generic shared component.
  - Build an entirely custom overlay with `div` wrappers: rejected because the repo already uses accessible `dialog` patterns and tests target `role="dialog"` successfully.

## Decision 3: Centralize policy copy and contact details in a shared typed constant module

- **Decision**: Create a typed module under `lib/constants/checkout-policies.ts` containing the canonical support email and structured policy sections reused by checkout, Help, and Returns.
- **Rationale**: The current Help and Returns pages contain policy text that conflicts with the approved feature scope. A single source of truth is the only reliable way to satisfy FR-013 and FR-014 without copy drift.
- **Alternatives considered**:
  - Duplicate strings in each page/component: rejected because the spec explicitly requires consistent wording across surfaces.
  - Store policy copy in Edge Config or a CMS: rejected because the feature does not need runtime-configurable policy management and the constitution favors simpler solutions.

## Decision 4: Derive the dialog summary from existing cart state and current pricing rules

- **Decision**: Populate the dialog from `selectCart`, existing item/variation data, and the same subtotal/shipping/total rules already rendered in `app/cart/page.tsx`, using `useCurrency().formatPrice` for all displayed amounts.
- **Rationale**: The dialog must show the exact order context the shopper is about to confirm, and the cart page already has the authoritative client-side data needed to do that without another fetch. Reusing current pricing logic avoids inconsistencies between the sidebar summary and the dialog.
- **Alternatives considered**:
  - Fetch a fresh server-side preview before opening the dialog: rejected because it adds latency and a new failure mode before the user can confirm.
  - Rebuild pricing logic separately inside the dialog: rejected because it increases drift risk and violates the DRY principle.

## Decision 5: Test the feature at the component and end-to-end layers

- **Decision**: Add Vitest coverage for dialog rendering, acknowledgment gating, and shared policy content, plus a Playwright flow that exercises cart checkout confirmation and captures screenshots.
- **Rationale**: The constitution requires unit/component coverage for reusable UI and Playwright verification for UI changes. There are currently no cart page tests, so the dialog interception behavior needs new automated coverage.
- **Alternatives considered**:
  - Rely only on Playwright: rejected because checkbox gating, callback sequencing, and copy reuse are cheaper and more deterministic to cover in component tests.
  - Rely only on unit tests: rejected because the end-to-end cart flow and modal visibility need browser-level validation.
