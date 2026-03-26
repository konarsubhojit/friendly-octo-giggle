# Tasks: Order Policy Confirmation

**Input**: Design documents from `/specs/003-order-policy-dialog/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: The feature spec explicitly requires testable user scenarios, so this task list includes Vitest and Playwright coverage.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g. [US1], [US2], [US3])
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the shared scaffolding this feature relies on before story-specific behavior is added.

- [ ] T001 Create canonical policy constants scaffold in `lib/constants/checkout-policies.ts`
- [ ] T002 [P] Create policy constants test scaffold in `__tests__/lib/constants/checkout-policies.test.ts`
- [ ] T003 [P] Create checkout policy Playwright spec scaffold in `playwright-tests/checkout-policy.spec.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build shared UI and data plumbing that all user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Extract reusable pricing summary UI into `components/cart/CartPricingSummary.tsx` and update `app/cart/page.tsx` to use it
- [ ] T005 [P] Extend `lib/order-summary.ts` with helpers for checkout dialog line-item and pricing summary derivation
- [ ] T006 Create typed accessible dialog shell in `components/cart/OrderPolicyConfirmDialog.tsx`

**Checkpoint**: Shared pricing, dialog, and policy scaffolding are ready for story work.

---

## Phase 3: User Story 1 - Review policy before purchase (Priority: P1) 🎯 MVP

**Goal**: Stop immediate order submission and require a full review dialog with selected items, totals, and explicit acknowledgment before checkout proceeds.

**Independent Test**: From the cart, clicking `Place Order` opens the review dialog, no checkout request is sent until the checkbox is selected and `Confirm and Place Order` is pressed, and cancelling leaves the cart unchanged.

### Tests for User Story 1

- [ ] T007 [P] [US1] Add checkout submit interception and confirm-gating tests in `__tests__/components/cart/CheckoutForm.test.tsx`
- [ ] T008 [P] [US1] Add dialog rendering, item summary, and checkbox enablement tests in `__tests__/components/cart/OrderPolicyConfirmDialog.test.tsx`
- [ ] T009 [P] [US1] Add dialog failure-state tests in `__tests__/components/cart/OrderPolicyConfirmDialog.test.tsx` for unavailable policy content
- [ ] T010 [US1] Add end-to-end review-before-submit coverage in `playwright-tests/checkout-policy.spec.ts`

### Implementation for User Story 1

- [ ] T011 [US1] Implement itemized order review, pricing summary, and acknowledgment state handling in `components/cart/OrderPolicyConfirmDialog.tsx`
- [ ] T012 [US1] Implement blocking error-state rendering in `components/cart/OrderPolicyConfirmDialog.tsx` when required policy content is unavailable
- [ ] T013 [US1] Wire `components/cart/CheckoutForm.tsx` to open the dialog and defer the existing `/api/checkout` submission until confirmation
- [ ] T014 [US1] Reuse `components/cart/CartPricingSummary.tsx` and shared order-summary helpers inside `components/cart/OrderPolicyConfirmDialog.tsx`

**Checkpoint**: User Story 1 is functional and independently testable as an MVP.

---

## Phase 4: User Story 2 - Understand cancellation and return limits (Priority: P2)

**Goal**: Present clear, consistent cancellation, return, and refund rules in checkout and aligned storefront policy surfaces.

**Independent Test**: Opening the dialog and visiting the Help and Returns pages shows consistent no-refund and post-shipment no-cancellation rules, along with the damaged-only return exception.

### Tests for User Story 2

- [ ] T015 [P] [US2] Add shared policy copy assertions for cancellation, return, and refund rules in `__tests__/lib/constants/checkout-policies.test.ts`
- [ ] T016 [US2] Add storefront policy page coverage for cancellation, return, and refund copy in `__tests__/app/help/page.test.tsx` and `__tests__/app/returns/page.test.tsx`

### Implementation for User Story 2

- [ ] T017 [US2] Populate cancellation, return, and refund policy content in `lib/constants/checkout-policies.ts`
- [ ] T018 [US2] Render cancellation, return, and refund sections from shared constants in `components/cart/OrderPolicyConfirmDialog.tsx`
- [ ] T019 [US2] Update `app/help/page.tsx` and `app/returns/page.tsx` to reuse the shared cancellation, return, and refund policy content

**Checkpoint**: User Stories 1 and 2 both work independently, and policy wording is consistent across checkout and static policy pages.

---

## Phase 5: User Story 3 - Know the damaged-product process (Priority: P3)

**Goal**: Explain the damaged-product email/contact flow, replacement-only remedy, and shipping responsibility clearly wherever the policy is shown.

**Independent Test**: The dialog and aligned policy pages tell shoppers to email `support@estore.example.com` with photos and issue details, state that refunds are not issued, and explain customer-paid return shipping plus free replacement shipping.

### Tests for User Story 3

- [ ] T020 [US3] Extend `__tests__/components/cart/OrderPolicyConfirmDialog.test.tsx` and `__tests__/lib/constants/checkout-policies.test.ts` for damaged-item guidance and support email coverage
- [ ] T021 [US3] Extend `__tests__/app/help/page.test.tsx`, `__tests__/app/returns/page.test.tsx`, and `playwright-tests/checkout-policy.spec.ts` for damaged-product process coverage

### Implementation for User Story 3

- [ ] T022 [US3] Add damaged-product contact, replacement, and shipping responsibility content to `lib/constants/checkout-policies.ts`
- [ ] T023 [US3] Render damaged-product instructions, explicit support email, and shipping responsibility details in `components/cart/OrderPolicyConfirmDialog.tsx`
- [ ] T024 [US3] Update `app/help/page.tsx` and `app/returns/page.tsx` to reuse the shared damaged-product guidance and support email content

**Checkpoint**: All three user stories are independently functional and policy guidance is complete across checkout and static pages.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency, accessibility, and validation across the full feature.

- [ ] T025 [P] Add any missing accessibility refinements and copy cleanup in `components/cart/OrderPolicyConfirmDialog.tsx`, `components/cart/CheckoutForm.tsx`, `app/help/page.tsx`, and `app/returns/page.tsx`
- [ ] T026 Run feature validation from `specs/003-order-policy-dialog/quickstart.md` and update `specs/003-order-policy-dialog/quickstart.md` if verification steps changed
- [ ] T027 [P] Run final regression commands `npm run lint`, `npx tsc --noEmit`, `npm run test`, and `npm run build`
- [ ] T028 Run targeted Playwright verification for `playwright-tests/checkout-policy.spec.ts` and capture screenshots for the cart dialog, Help page, and Returns page
- [ ] T029 [P] Run SonarQube analysis on modified files including `components/cart/CheckoutForm.tsx`, `components/cart/OrderPolicyConfirmDialog.tsx`, `app/help/page.tsx`, `app/returns/page.tsx`, and `lib/constants/checkout-policies.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies and can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 and blocks all user story work
- **User Story 1 (Phase 3)**: Depends on Phase 2 and delivers the MVP
- **User Story 2 (Phase 4)**: Depends on Phase 2 and can begin after the foundation is complete, but is safest after US1 because it extends the dialog created for the MVP
- **User Story 3 (Phase 5)**: Depends on Phase 2 and builds on the same shared policy surfaces updated in US2
- **Polish (Phase 6)**: Depends on completion of all desired user stories

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on later stories
- **User Story 2 (P2)**: Depends on the shared dialog and policy scaffolding from Phase 2; extends the dialog delivered in US1
- **User Story 3 (P3)**: Depends on the same shared policy module and dialog/page surfaces used in US2

### Within Each User Story

- Story tests should be written before or alongside the implementation they validate
- Shared constants/helpers before rendering logic
- Rendering logic before flow integration
- Story must be independently validated before moving on

### Parallel Opportunities

- `T002` and `T003` can run in parallel after `T001`
- `T004` and `T005` can run in parallel before `T006`
- `T007`, `T008`, and `T009` can run in parallel for US1
- `T015` can run in parallel with the start of `T016`
- `T027` and `T029` can run in parallel once implementation is complete

---

## Parallel Example: User Story 1

```bash
# Launch the core US1 tests together:
Task: "Add checkout submit interception and confirm-gating tests in __tests__/components/cart/CheckoutForm.test.tsx"
Task: "Add dialog rendering, item summary, and checkbox enablement tests in __tests__/components/cart/OrderPolicyConfirmDialog.test.tsx"
Task: "Add dialog failure-state tests in __tests__/components/cart/OrderPolicyConfirmDialog.test.tsx for unavailable policy content"

# Then implement the shared UI pieces together where there is no file overlap:
Task: "Wire components/cart/CheckoutForm.tsx to open the dialog and defer the existing /api/checkout submission until confirmation"
Task: "Reuse components/cart/CartPricingSummary.tsx and shared order-summary helpers inside components/cart/OrderPolicyConfirmDialog.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate the cart review dialog and blocked submission behavior
5. Demo or ship the guarded checkout review as the MVP

### Incremental Delivery

1. Finish Setup + Foundational
2. Deliver User Story 1 and validate it independently
3. Add User Story 2 and validate policy wording consistency
4. Add User Story 3 and validate damaged-product guidance everywhere
5. Run Polish tasks for screenshots, SonarQube analysis, and final regression

### Parallel Team Strategy

1. One developer completes Setup + Foundational
2. After that:
   - Developer A: User Story 1 flow wiring and dialog behavior
   - Developer B: User Story 2 shared policy constants and page alignment
   - Developer C: User Story 3 damaged-product guidance and final assertions
3. Rejoin for Polish and final regression

---

## Notes

- [P] tasks indicate different files and no incomplete dependencies
- [US1], [US2], and [US3] map directly to the approved user stories in `spec.md`
- Keep the `/api/checkout` contract unchanged throughout implementation
- Use shared policy constants to avoid copy drift across checkout, Help, and Returns
