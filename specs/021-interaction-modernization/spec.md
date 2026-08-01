# Feature Specification: Interaction Modernization

**Feature Branch**: `021-interaction-modernization`  
**Created**: 2026-08-01  
**Status**: Draft  
**Epic**: Phase 3 — AI, interaction quality, and revenue levers  
**Input**: Adopt the React 19.2 and Next.js 16 interaction primitives already installed — View Transitions, `<Activity>`, and Server Actions with `useActionState` and `useOptimistic` — so navigation is continuous, multi-step state survives, and high-frequency mutations stop round-tripping through Redux thunks.

## Baseline (verified 2026-08-01)

- React `19.2.7` is installed and exports `Activity`. Next.js `16.2.11` supports `experimental.viewTransition`. **None of these are used**: `ViewTransition`, `startViewTransition`, `useOptimistic`, and `useActionState` have zero occurrences in `src/`, and `experimental.viewTransition` is not enabled.
- Mutations are overwhelmingly client-driven. Only **3** files contain `'use server'` (`src/app/(public)/auth/signin/page.tsx`, `src/features/orders/services/order-mirror.ts`, `src/features/orders/actions/orders.ts`) against **133** files containing `'use client'`.
- The dominant mutation path is Redux thunk → `src/lib/api-client.ts` → route handler, across the cart, orders, admin, and wishlist slices. `api-client.ts` is a deliberate dependency-inversion boundary with its own thunk tests, so it cannot simply be discarded.
- Checkout is a four-page funnel (`shipping`, `payment`, `review`, `confirmation`). Navigating between steps unmounts and remounts each step's component tree, discarding in-progress form state and any fetched data.
- Optimistic behavior exists but is hand-rolled — for example the wishlist slice mutates local state before the request resolves and does not automatically roll back on failure, as recorded in `specs/010-wishlist`.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Continuous navigation between storefront views (Priority: P2)

Moving between catalog and product views animates continuously instead of flashing, and the shared product image carries between them.

**Why this priority**: A meaningful perceived-quality improvement with a contained blast radius, but it changes no functional behavior, so it ranks below the mutation work.

**Independent Test**: Navigate from a product grid to a product detail page in a supporting browser and confirm a continuous transition; repeat in a non-supporting browser and confirm normal navigation.

**Acceptance Scenarios**:

1. **Given** a supporting browser, **When** a shopper navigates from the shop grid to a product page, **Then** the transition is continuous and the shared image element is carried across.
2. **Given** a non-supporting browser, **When** the same navigation occurs, **Then** it completes normally with no error and no visual defect.
3. **Given** a shopper with a reduced-motion preference, **When** they navigate, **Then** transition animation is suppressed.
4. **Given** a transition is in progress, **When** the shopper navigates again, **Then** the interruption is handled without a stuck or blank view.

---

### User Story 2 - Multi-step state survives navigation (Priority: P1)

A shopper moving backward and forward through checkout keeps their entered data, and switching admin table tabs does not discard loaded state.

**Why this priority**: Losing entered data inside the checkout funnel is a direct conversion loss and the most damaging interaction defect in the current product.

**Independent Test**: Enter shipping details, advance to payment, return to shipping, and confirm the entered values are still present without a refetch.

**Acceptance Scenarios**:

1. **Given** a shopper has entered checkout details, **When** they navigate to the next step and return, **Then** their entries are preserved.
2. **Given** a preserved step, **When** it is revisited, **Then** it does not refetch data it already holds.
3. **Given** an admin switching between table views, **When** they return to a previous view, **Then** its loaded state and scroll position are preserved.
4. **Given** preserved-but-hidden content, **When** it is not visible, **Then** it does not run effects that would fire requests or notifications.
5. **Given** a shopper completes checkout, **When** the order is confirmed, **Then** preserved funnel state is cleared and cannot leak into a subsequent order.

---

### User Story 3 - Instant, self-correcting mutations (Priority: P1)

Changing cart quantity, toggling a wishlist item, or submitting a review responds immediately and reconciles honestly when the server disagrees.

**Why this priority**: These are the highest-frequency interactions on the storefront, and the current hand-rolled optimism can leave the UI showing a state the server rejected.

**Independent Test**: Toggle a wishlist item with the network forced to fail and confirm the UI reverts to the true state and surfaces an error.

**Acceptance Scenarios**:

1. **Given** a shopper changes cart quantity, **When** the change is submitted, **Then** the UI updates immediately.
2. **Given** the server rejects the mutation, **When** the failure returns, **Then** the UI reverts to the server-confirmed state and shows an actionable error.
3. **Given** a mutation is in flight, **When** it is pending, **Then** a pending state is exposed and duplicate submission is prevented.
4. **Given** a mutation succeeds, **When** it completes, **Then** affected cached data is revalidated so other surfaces agree.
5. **Given** a mutation requires authentication or ownership, **When** it executes on the server, **Then** session, ownership, and Zod validation are enforced exactly as the equivalent route handler enforces them today.

---

### User Story 4 - The migration does not reduce test coverage or safety (Priority: P1)

Moving mutations off the thunk and `api-client` path preserves the behavior those thunk tests currently protect.

**Why this priority**: This is the principal risk of the whole specification. The `api-client` abstraction and its tests are an intentional design boundary; retiring them carelessly would silently drop coverage.

**Independent Test**: For each migrated mutation, confirm equivalent test coverage exists against the new path before the old path is deleted.

**Acceptance Scenarios**:

1. **Given** a mutation migrated to a Server Action, **When** the migration lands, **Then** equivalent tests cover the new path.
2. **Given** a thunk is removed, **When** it is removed, **Then** its test file is replaced rather than deleted, and coverage thresholds still pass.
3. **Given** a feature module is migrated, **When** the change lands, **Then** it is a self-contained, revertable change set for that module alone.
4. **Given** state genuinely shared across pages, **When** the migration is scoped, **Then** it remains in Redux rather than being forced into a Server Action.

---

### Edge Cases

- View Transitions must be feature-detected; calling the API unguarded throws in unsupported browsers.
- Reduced-motion preferences must suppress transition animation.
- Preserved-but-hidden components must not run effects that fire requests, emit analytics, or trigger notifications.
- Preserved checkout state must never survive into a different order or a different signed-in user.
- Optimistic state must always reconcile against the server response, including on error, so the UI cannot settle on a state the server rejected.
- Server Actions are a public endpoint surface and must enforce authentication, ownership, and validation exactly as the equivalent route handlers do.
- Rate limiting applied in `proxy.ts` to API routes must have an equivalent for mutations moved to Server Actions.
- Redux and Server Action state must not both own the same data; each migrated mutation needs a single source of truth.
- Preserving state increases memory use; the set of preserved subtrees must be bounded.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: View Transitions MUST be enabled and applied to storefront navigation between catalog and product views.
- **FR-002**: View Transitions MUST be feature-detected and MUST degrade to normal navigation when unsupported.
- **FR-003**: Transition animation MUST be suppressed when the user prefers reduced motion.
- **FR-004**: Checkout funnel steps MUST preserve entered state across forward and backward navigation.
- **FR-005**: Preserved-but-hidden subtrees MUST NOT execute effects that issue requests or produce user-visible side effects.
- **FR-006**: Preserved funnel state MUST be cleared on order completion and on sign-out.
- **FR-007**: Cart quantity changes, wishlist toggles, and review submissions MUST be migrated to Server Actions with pending state and optimistic updates.
- **FR-008**: Optimistic updates MUST reconcile against the server response and MUST revert on failure with an actionable error message.
- **FR-009**: In-flight mutations MUST prevent duplicate submission.
- **FR-010**: Server Actions MUST enforce session authentication, ownership, and Zod validation equivalent to the route handlers they replace.
- **FR-011**: Mutations moved off API routes MUST retain equivalent abuse protection to the `proxy.ts` rate limiting they previously received.
- **FR-012**: Successful mutations MUST revalidate affected cached data so all surfaces agree.
- **FR-013**: Migration MUST proceed one feature module at a time, each as an independently revertable change set.
- **FR-014**: A removed thunk's tests MUST be replaced with equivalent tests against the new path before removal; coverage thresholds MUST continue to pass.
- **FR-015**: State genuinely shared across pages MUST remain in Redux; the migration MUST NOT force page-local state into Server Actions or the reverse.
- **FR-016**: Each migrated mutation MUST have exactly one source of truth for its data.
- **FR-017**: `docs/development.md` and `.github/copilot-instructions.md` MUST document when to use a Server Action versus a Redux thunk.

### Key Entities

- **Transition Surface**: A navigation pair animated by View Transitions, with its shared element and its fallback behavior.
- **Preserved Subtree**: A component tree kept mounted but hidden, with a defined lifetime and clearing rule.
- **Server Action Mutation**: A server-executed mutation with its validation schema, authorization rule, optimistic update, and revalidation targets.
- **Migration Unit**: One feature module migrated as a single revertable change set with its replacement tests.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Navigating away from and back to a checkout step preserves all entered data.
- **SC-002**: A failed mutation always leaves the UI showing the server-confirmed state.
- **SC-003**: Interaction to Next Paint for cart quantity change and wishlist toggle does not regress and is measured before and after.
- **SC-004**: Navigation succeeds with no visual defect in browsers without View Transitions support.
- **SC-005**: Reduced-motion users receive no transition animation.
- **SC-006**: Test coverage thresholds pass after every migration unit, with no net loss of mutation coverage.
- **SC-007**: Every migrated mutation rejects unauthenticated, unauthorized, and invalid input exactly as its predecessor did.
- **SC-008**: Preserved state never appears in a different order or under a different signed-in user.

## Out of Scope

- Removing Redux; it remains the owner of genuinely cross-page state.
- Redesigning the checkout funnel's steps or visual design.
- Migrating admin mutations, which are lower frequency and can follow later.
- Enabling the React Compiler, which belongs to `015-build-and-dx-modernization`.

## Dependencies

- Should follow `013-e2e-in-continuous-integration`, because interaction changes are best verified at the browser level.
- Should follow `015-build-and-dx-modernization` so compiler-driven memoization changes and interaction changes are measured separately.
- Interacts with `012-cache-components-and-ppr`, since mutation revalidation targets the cache tags that specification introduces.
