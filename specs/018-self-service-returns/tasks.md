# Tasks: Customer Self-Service Returns

**Input**: Design documents from `/specs/018-self-service-returns/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Included. Constitution Principle III mandates unit tests for shared utilities and services, and SC-008 sets an explicit 85% coverage threshold for `src/features/**/services/**`.

**Organization**: Grouped by user story. US1–US3 are all P1 and form an indivisible commercial increment — a return that cannot be triaged, or an approval that cannot restock and refund, has no operational value. US4 is P2 and ships independently on top.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete work)
- **[Story]**: `[US1]`–`[US4]`; Setup/Foundational/Polish phases carry no story label

---

## ✅ Phase 0: Scope Decision (CLOSED)

- [x] T001 Resolve the published-policy conflict in [research.md](./research.md) R1. **Decided 2026-08-08: Option B — damaged-item returns only.** Recorded in [spec.md](./spec.md) "Scope Decision" and [research.md](./research.md) R1.

**What Option B binds**:

- `returnReasonEnum` is `['DAMAGED', 'DEFECTIVE', 'WRONG_ITEM']` (T004, T005). No change-of-mind or fit reasons.
- Evidence is **mandatory**, minimum one image and maximum five (T016, T023, T024, T028).
- Carrier integration and return labels stay out of scope — the policy makes return shipping the customer's cost.
- The state machine, restock, refund calculation, idempotency, and COD paths are **unaffected**.

**Residual, non-blocking**: Option B satisfies the published _returns_ clause but not the _refunds_ clause, which still reads "Refunds are not issued for orders." A narrow amendment to the `refunds` and `damagedItems` clauses (decision B-1) is required and is carried as **T063**, not as a gate. If B-2 (settle by replacement) is chosen instead, FR-010 through FR-013 and SC-004 must be struck and the feature re-planned rather than patched.

**Checkpoint**: Decision recorded. Phase 1 may start.

---

## Phase 1: Setup

**Purpose**: Configuration and constants that later phases import. No behaviour yet.

- [ ] T002 [P] Add `'orders:returns'` to `ADMIN_PERMISSIONS` and grant it to `SUPPORT` in the `ROLE_PERMISSIONS` map in [src/lib/constants/roles.ts](src/lib/constants/roles.ts) (`ADMIN` already receives all permissions)
- [ ] T003 [P] Add `returnsConfig` to [src/lib/edge-config.ts](src/lib/edge-config.ts): the `ReturnsConfig` interface (`defaultWindowDays: 7`, `categoryWindowDays` keyed by **category name**, `nonReturnableCategoryNames`), `DEFAULT_RETURNS_CONFIG`, a `getReturnsConfig()` reader, and entries in both the `EdgeConfigData` type and the `getAllEdgeConfig` batch read — mirroring `shippingConfig` end to end
- [ ] T004 [P] Create `src/lib/constants/returns.ts` with `RETURN_STATUSES` and `RETURN_REASONS` const tuples plus their derived TS unions, so schema, Zod, and UI share one source. Per Option B, `RETURN_REASONS` is exactly `['DAMAGED', 'DEFECTIVE', 'WRONG_ITEM']`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, migration, and the pure functions every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Schema & Migration

- [ ] T005 Add `returnStatusEnum` and `returnReasonEnum` pgEnums — the reason enum restricted to `['DAMAGED', 'DEFECTIVE', 'WRONG_ITEM']` per Option B — and the `returnRequests`, `returnItems`, `returnEvidence` tables with all columns, indexes, unique constraints, and check constraints specified in [data-model.md](./data-model.md), to [src/lib/schema.ts](src/lib/schema.ts). `ReturnEvidence.returnRequestId` is **nullable** — evidence is uploaded before the return exists — with `userId` and `orderId` NOT NULL and a `(userId, orderId)` index
- [ ] T006 Add `deliveredAt` timestamp to the `orders` table and `returnRequestId` varchar(7) FK to the `refunds` table, and relax `refunds.paymentTransactionId` from `.notNull()` to nullable per [data-model.md](./data-model.md) M1/M2/M4, in [src/lib/schema.ts](src/lib/schema.ts)
- [ ] T007 Add `returnRequestsRelations`, `returnItemsRelations`, `returnEvidenceRelations`, and extend `ordersRelations` with `returns: many(returnRequests)` in [src/lib/schema.ts](src/lib/schema.ts)
- [ ] T008 Generate the migration with `npm run db:generate`, review the SQL, and hand-edit `drizzle/0017_self_service_returns.sql` to add the `deliveredAt` backfill (`UPDATE "Order" SET "deliveredAt" = "updatedAt" WHERE status = 'DELIVERED'`) with the comment recording that it is an approximation for historical rows, and to make index creation on the non-empty `Order` and `Refund` tables `CONCURRENTLY`
- [ ] T009 Apply the migration with `npm run db:migrate` and verify the new tables, indexes, and constraints exist. Constitution workflow step 6 also names `scripts/sql/bootstrap-drizzle-initial.sql` and `npm run db:bootstrap`; **neither exists in this repository** — `scripts/sql/` holds only `catalog-data.sql`, and `package.json` defines only `db:generate`, `db:migrate`, `db:push`, `db:studio` — so that clause is stale constitution content and is skipped deliberately

### Pure Functions — tests first

- [ ] T010 [P] Write failing tests for `allocateMoney` in [**tests**/lib/money.test.ts](__tests__/lib/money.test.ts): sum invariant `sum(allocateMoney(t, w)) === t` across randomised weight vectors, zero total, single weight, all-zero weights, and deterministic tie-breaking by ascending index
- [ ] T011 [P] Write failing tests for the return state machine in [**tests**/features/orders/services/return-state-machine.test.ts](__tests__/features/orders/services/return-state-machine.test.ts): every legal transition from [research.md](./research.md) R12 accepted — including `RECEIVED → RECEIVED` on refund retry — every illegal one rejected, and `REJECTED` terminal
- [ ] T012 [P] Write failing tests for the refund calculator in [**tests**/features/orders/services/return-refund-calculator.test.ts](__tests__/features/orders/services/return-refund-calculator.test.ts): partial vs full return, shipping refunded only on full return (R3), discount share reconciles exactly to the order's `discountAmount`, proportional item tax
- [ ] T013 Implement `allocateMoney(total: number, weights: readonly number[]): number[]` using largest-remainder allocation over integer minor units in [src/lib/money.ts](src/lib/money.ts) — T010 must pass
- [ ] T014 [P] Implement the transition table and `assertTransition(from, action)` in `src/features/orders/services/return-state-machine.ts` as a pure module with no I/O, implementing all five actions (`approve`, `reject`, `receive`, `refund`, `settle`) from [research.md](./research.md) R12 — T011 must pass
- [ ] T015 [P] Implement `calculateReturnRefund` in `src/features/orders/services/return-refund-calculator.ts` using `allocateMoney`, applying the full-order-only shipping rule — T012 must pass (depends on T013)

### Validation Schemas

- [ ] T016 Add `CreateReturnRequestSchema` — with `evidenceIds` **required**, `.min(1).max(5)` per Option B — and the `DecideReturnSchema` discriminated union including the `refund` action, from [data-model.md](./data-model.md) to [src/features/orders/validations.ts](src/features/orders/validations.ts)

**Checkpoint**: Schema migrated, pure logic proven, validation defined. User stories can begin.

---

## Phase 3: User Story 1 — Request a return for a delivered item (Priority: P1) 🎯 MVP

**Goal**: A customer opens a delivered order, selects items and quantities, chooses a reason, attaches evidence, and submits a return request that persists and is visible in order history.

**Independent Test**: Sign in as a customer with a delivered order, submit a return for one item, confirm it persists and appears in order history; confirm a second customer receives 404 on that return.

### Tests for User Story 1

- [ ] T017 [P] [US1] Write failing service tests in [**tests**/features/orders/services/return-service.test.ts](__tests__/features/orders/services/return-service.test.ts) covering: ownership rejection, order not `DELIVERED`, window expired, excluded category, requested quantity exceeding returnable, refund total exceeding the order's remaining captured balance, and `REJECTED` returns releasing held quantity
- [ ] T018 [P] [US1] Write failing route tests in `__tests__/app/api/orders/returns.test.ts` asserting 401 without session, 404 for another customer's order, 400 on Zod failure, 409 with the correct `code` discriminator, and 201 on success
- [ ] T018a [P] [US1] Write failing tests for `POST …/returns/evidence` in `__tests__/app/api/orders/return-evidence.test.ts` asserting rejection of a disallowed type by magic byte, a file over `MAX_FILE_SIZE` (413), and a sixth upload for the same (`userId`, `orderId`) pair (409). Also assert that `POST …/returns` rejects a request with an empty `evidenceIds`, and one whose ids all belong to another customer, with `400` — covers SC-007

### Implementation for User Story 1

- [ ] T019 [US1] Set `deliveredAt` alongside `status` when the transition target is `DELIVERED` in [src/app/api/admin/orders/[id]/route.ts](src/app/api/admin/orders/%5Bid%5D/route.ts) — the return window is measured from this column
- [ ] T020 [US1] Implement `getReturnEligibility(orderId, userId)` in `src/features/orders/services/return-service.ts`, computing returnable quantity per order item (excluding only `REJECTED` returns), per-item window expiry resolved from `returnsConfig` by the item's **category name** (`products.category` is free text with no FK — never key by id), and the eligibility reason discriminator
- [ ] T021 [US1] Implement `createReturnRequest` in `src/features/orders/services/return-service.ts` inside a transaction that locks the order row `FOR UPDATE`, re-validates every invariant under the lock, computes frozen `refundableAmount` per item via T015, inserts the `ReturnRequest` and `ReturnItem` rows, then sets `returnRequestId` on the `ReturnEvidence` rows matching `evidenceIds` **and** the caller's `userId` and `orderId` — ignoring non-matching ids silently, but rejecting the whole request with `400` when none survives the filter, since evidence is mandatory — T017 must pass
- [ ] T022 [US1] Extract the magic-byte MIME check, size caps, and extension normalisation from [src/app/api/upload/route.ts](src/app/api/upload/route.ts) into a shared `src/lib/upload-validation.ts`, hoist the private `MAX_FORM_DATA_BODY_SIZE` const from that route into [src/lib/upload-constants.ts](src/lib/upload-constants.ts), and re-point the existing route at both, leaving its `checkAdminAuth('products:write')` gate unchanged
- [ ] T023 [US1] Implement `POST /api/orders/[id]/returns/evidence` in `src/app/api/orders/[id]/returns/evidence/route.ts` using the shared validator from T022, `auth()` ownership gating, and `uploadImage` from [src/lib/image-storage.ts](src/lib/image-storage.ts). The row is inserted **orphaned** (`returnRequestId` null) with `userId` and `orderId` set, capped at 5 orphaned rows per (`userId`, `orderId`) — T018a must pass
- [ ] T024 [US1] Implement `GET` and `POST /api/orders/[id]/returns` in `src/app/api/orders/[id]/returns/route.ts` per [contracts/customer-returns.md](./contracts/customer-returns.md), wrapped in `withApiLogging`, responding through `apiSuccess`/`handleApiError`, with `Cache-Control: private, no-store` — T018 must pass
- [ ] T025 [US1] Add `serializeCustomerReturn` to [src/lib/serializers.ts](src/lib/serializers.ts) that explicitly omits `decidedById`, `receivedById`, `stockRestoredAt`, `refundId`, `gatewayRefundId`, `errorMessage`, `paymentTransactionId`, and variant stock fields — never spread the row
- [ ] T026 [US1] Implement `GET /api/returns/[id]` in `src/app/api/returns/[id]/route.ts`, returning **404** (not 403) for another customer's return so the endpoint does not confirm the identifier exists
- [ ] T027 [P] [US1] Build `ReturnEvidenceUploader.tsx` in `src/features/orders/components/` as a Client Component posting to the T023 endpoint, with client-side type/size pre-checks that never substitute for the server check
- [ ] T028 [US1] Build `ReturnRequestForm.tsx` in `src/features/orders/components/` as a Client Component with per-item quantity steppers bounded by `returnableQuantity`, a damage-reason selector offering only the three Option B reasons, a submit control disabled until at least one evidence image is attached, and `formatPrice()` from `useCurrency()` for all amounts — no raw `$` or `.toFixed(2)`
- [ ] T029 [US1] Surface the return action and submitted returns on [src/app/(public)/orders/[id]/page.tsx](<src/app/(public)/orders/%5Bid%5D/page.tsx>), keeping the page a Server Component and confining `'use client'` to T027/T028
- [ ] T030 [US1] Add cache invalidation (`invalidateUserOrderCaches`, `invalidateAdminOrderCaches`) and `return_requested` business-event logging via [src/lib/logger.ts](src/lib/logger.ts) to the creation path

**Checkpoint**: A customer can submit a return end to end. Nothing can yet action it.

---

## Phase 4: User Story 2 — Administrators triage the return queue (Priority: P1)

**Goal**: An authorized administrator reviews pending returns with order context and evidence, and approves or rejects each with a recorded reason and an audit entry.

**Independent Test**: Submit two returns as a customer, open `/admin/returns`, approve one and reject the other with reasons; confirm both audit rows exist and a staff account lacking `orders:returns` is refused.

**Depends on**: US1 (returns must exist to triage).

### Tests for User Story 2

- [ ] T031 [P] [US2] Write failing tests in `__tests__/app/api/admin/returns.test.ts` asserting 401 unauthenticated, 403 without `orders:returns`, 400 when `decisionReason` is absent on approve **or** reject, 409 on an illegal transition, and that an audit row is written for each decision
- [ ] T032 [P] [US2] Write a failing concurrency test in [**tests**/features/orders/services/return-service.test.ts](__tests__/features/orders/services/return-service.test.ts) proving two simultaneous decisions serialise and the second is rejected by the transition check

### Implementation for User Story 2

- [ ] T033 [US2] Implement `decideReturn(returnId, action, decisionReason, actor)` in `src/features/orders/services/return-service.ts` inside a transaction that re-reads the return row `FOR UPDATE`, applies T014's transition check, and writes `decidedById`/`decidedAt` — T032 must pass
- [ ] T034 [US2] Write `recordAdminAuditLog({ entity: 'return', entityId, action, diff })` from [src/features/admin/services/admin-audit-log.ts](src/features/admin/services/admin-audit-log.ts) on every decision, capturing prior and new status and the reason
- [ ] T035 [US2] Implement `GET /api/admin/returns` in `src/app/api/admin/returns/route.ts` with `checkAdminAuth('orders:returns')`, status/search/cursor/limit params, and a query ordered to use the `ReturnRequest_status_createdAt_idx` composite index
- [ ] T036 [US2] Implement `PATCH /api/admin/returns/[id]` in `src/app/api/admin/returns/[id]/route.ts` handling the `approve` and `reject` actions per [contracts/admin-returns.md](./contracts/admin-returns.md) — T031 must pass
- [ ] T037 [P] [US2] Add `returnsSlice.ts` to `src/features/orders/store/` for admin queue state, with all thunks routed through [src/lib/api-client.ts](src/lib/api-client.ts) and never raw `fetch`, and register it in [src/lib/store.ts](src/lib/store.ts)
- [ ] T038 [P] [US2] Build `AdminReturnCard.tsx` in `src/features/admin/components/` as a Client Component showing order context, items, reason, evidence thumbnails, and decision actions with a mandatory reason field
- [ ] T039 [US2] Build `src/app/admin/returns/page.tsx` as a Server Component calling `requireAdminPermission('orders:returns')` from [src/features/admin/services/admin-page-auth.ts](src/features/admin/services/admin-page-auth.ts), plus `src/app/admin/returns/error.tsx`

**Checkpoint**: Returns can be requested and triaged. No inventory or money has moved.

---

## Phase 5: User Story 3 — Approved returns restock and refund correctly (Priority: P1)

**Goal**: Marking a return received restocks each unit to its originating variant; a separate refund action issues the money through the existing pipeline, linked to the return, with both operations independently idempotent and the refund retryable after a gateway failure.

**Independent Test**: Approve a return, mark it received, confirm variant `stock` increased by exactly the returned quantity and `reservedStock` is unchanged; issue the refund and confirm a linked `Refund` row exists for the correct amount; replay both calls and confirm neither is applied twice.

**Depends on**: US2 (a return must reach `APPROVED`).

### Tests for User Story 3

- [ ] T040 [P] [US3] Write failing tests in [**tests**/features/orders/services/return-restock.test.ts](__tests__/features/orders/services/return-restock.test.ts): the first claim returns `true` and increments `stock`, a second call returns `false` and increments nothing, `reservedStock` is never written, and soft-deleted variants are still restocked
- [ ] T041 [P] [US3] Write failing tests in [**tests**/features/orders/services/return-service.test.ts](__tests__/features/orders/services/return-service.test.ts) for the receive and refund paths: `receive` restocks and moves to `RECEIVED` without creating a refund; `refund` creates exactly one refund and moves to `REFUNDED`; replaying `refund` produces no second row; **gateway rejection leaves the return at `RECEIVED` with `refundId` unset and a subsequent `refund` retry succeeds**
- [ ] T042 [P] [US3] Write failing tests for the COD path asserting `codGateway.refund` is never invoked, a `PENDING` refund row is written with `paymentTransactionId: null` and a `MANUAL_SETTLEMENT:` reason prefix, and `settle` flips it to `PROCESSED`
- [ ] T043 [P] [US3] Write a regression test in `__tests__/app/api/admin/orders/status-transitions.test.ts` asserting `DELIVERED` remains terminal in `VALID_TRANSITIONS`, so the double-refund scenario stays structurally impossible ([research.md](./research.md) R13)

### Implementation for User Story 3

- [ ] T044 [US3] Implement `restockReturnItems(tx, returnRequest)` in `src/features/orders/services/return-restock.ts` claiming `ReturnRequest.stockRestoredAt` with a guarded `UPDATE ... WHERE "stockRestoredAt" IS NULL`, then incrementing `ProductVariant.stock` per item and never touching `reservedStock` — T040 must pass. **Do not modify or parameterise [src/features/orders/services/order-restock.ts](src/features/orders/services/order-restock.ts)**
- [ ] T045 [US3] Extend `refundOrder` in [src/features/orders/services/refund-service.ts](src/features/orders/services/refund-service.ts) to accept an optional `returnRequestId` and persist it on the created `Refund` row, leaving every existing caller's behaviour unchanged
- [ ] T046 [US3] Implement the `receive` action in `src/features/orders/services/return-service.ts`: transition check under `FOR UPDATE`, call T044, set `receivedAt`/`receivedById`, advance to `RECEIVED`. **No refund is issued here** — T041 must pass
- [ ] T046a [US3] Implement the `refund` action in `src/features/orders/services/return-service.ts`: assert current state is `RECEIVED`, return unchanged when `refundId IS NOT NULL`, otherwise issue the refund, set `ReturnRequest.refundId`, and advance to `REFUNDED`. On gateway rejection the state stays `RECEIVED` so the action can be retried — T041 must pass
- [ ] T047 [US3] Branch the refund issuance in T046a on `order.paymentProvider`: `COD` writes the manual-settlement refund row directly and never calls the gateway ([src/lib/payments/cod.ts](src/lib/payments/cod.ts) throws by design); all other providers call `refundOrder` — T042 must pass
- [ ] T048 [US3] Implement the `settle` action gated on `orders:refund` (not `orders:returns`) in `src/app/api/admin/returns/[id]/route.ts`, flipping the linked refund `PENDING → PROCESSED`, setting `processedAt`, and writing an audit entry
- [ ] T049 [US3] Add the `receive`, `refund`, and `settle` actions to the `PATCH /api/admin/returns/[id]` handler — gating `refund` and `settle` on `orders:refund` and `receive` on `orders:returns` — and to `AdminReturnCard.tsx`, showing `settle` only for `COD` orders
- [ ] T050 [US3] Surface `Refund.errorMessage` on the admin card when a gateway refund fails, together with a visible retry control for the `refund` action, so the return remains actionable (spec US3 scenario 4)
- [ ] T051 [US3] Add cache invalidation and `return_received` / `return_refunded` business-event logging to the receive and refund paths

**Checkpoint**: The full commercial loop closes. Inventory and money move correctly and idempotently.

---

## Phase 6: User Story 4 — Return status is transparent to the customer (Priority: P2)

**Goal**: A customer sees where their return stands, the rejection reason if any, and the refunded amount and date, and is notified of changes through permitted channels only.

**Independent Test**: Submit a return, progress it through approval to refund, and confirm each state and the final refunded amount appear in order detail, and that a customer with transactional email disabled receives nothing.

**Depends on**: US3 (the full lifecycle must exist to be reported).

### Tests for User Story 4

- [ ] T052 [P] [US4] Write failing tests asserting `deliverReturnStatusNotification` suppresses email when `isChannelEnabled(preferences, 'transactional', 'email')` is false, satisfying SC-006
- [ ] T053 [P] [US4] Write failing component tests for `ReturnStatusPanel` covering each status, the rejection reason, and the refunded amount and date

### Implementation for User Story 4

- [ ] T054 [P] [US4] Declare `returnStatusChanged = eventType('order/return.status.changed', { schema })` in [src/features/orders/inngest/events.ts](src/features/orders/inngest/events.ts) matching the existing `orderStatusChanged` pattern
- [ ] T055 [P] [US4] Add `returnStatusUpdateTemplate` to [src/lib/email/templates.ts](src/lib/email/templates.ts) returning `{ subject, bodyHtml, bodyText }`
- [ ] T056 [US4] Implement `deliverReturnStatusNotification` in [src/lib/notifications/order-notifications.ts](src/lib/notifications/order-notifications.ts), resolving the recipient via `resolveNotificationRecipient` and gating each channel on `isChannelEnabled(preferences, 'transactional', channel)` — T052 must pass
- [ ] T057 [US4] Add `sendReturnStatusEmailFunction` to [src/features/orders/inngest/emails.ts](src/features/orders/inngest/emails.ts) — **not** `src/lib/inngest/functions/` — with `idempotency: 'event.data.returnId + "-" + event.data.status'`, `retries: EMAIL_FUNCTION_RETRIES`, and `onFailure: recordEmailFailure`. Both helpers are module-private to `emails.ts`, and a domain-specific function in `src/lib/` would violate constitution Principle VIII
- [ ] T058 [US4] **Register `sendReturnStatusEmailFunction` in [src/lib/inngest/registry.ts](src/lib/inngest/registry.ts)** — an unregistered function fails silently: the event publishes, nothing consumes it, no error is raised
- [ ] T059 [US4] Publish the event via `dispatchWorkflowEvent` with an inline `fallback` from every transition point in `return-service.ts`, so notification still reaches the customer when Inngest is unconfigured
- [ ] T060 [US4] Build `ReturnStatusPanel.tsx` in `src/features/orders/components/` as a Server Component showing current status, next step, rejection reason, and refunded amount and date — rendering a `FAILED` refund as "processing" rather than as a customer-visible failure — T053 must pass
- [ ] T061 [US4] Render `ReturnStatusPanel` on [src/app/(public)/orders/[id]/page.tsx](<src/app/(public)/orders/%5Bid%5D/page.tsx>) and add return status to the order history list

**Checkpoint**: All four user stories functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T062 [P] Implement `GET /api/admin/export/returns` in `src/app/api/admin/export/returns/route.ts` using `streamCsvResponse` and `batchedCsvRows` from [src/features/admin/services/admin-csv.ts](src/features/admin/services/admin-csv.ts) with the fixed column order from [contracts/admin-returns.md](./contracts/admin-returns.md) (FR-017)
- [ ] T063 Amend the `refunds` and `damagedItems` clauses in [src/lib/constants/checkout-policies.ts](src/lib/constants/checkout-policies.ts) per decision **B-1**, so that approved damage claims may be settled by refund where replacement is unavailable, and the published promise matches the shipped mechanism (FR-018). Requires product/legal sign-off on the wording before merge
- [ ] T064 [P] Update [docs/features.md](docs/features.md) and `specs/003-order-policy-dialog` to describe the returns lifecycle (FR-018)
- [ ] T065 [P] Add accessibility attributes across the new UI: `htmlFor`/`id` on every label, `aria-label` on icon-only controls, `aria-expanded`/`aria-haspopup`/`role="menu"` on the queue action menus, `aria-hidden` on decorative elements, and real `<button>`/`<a>` elements rather than ARIA-roled divs
- [ ] T066 [P] Write `playwright-tests/returns.spec.ts` covering the full lifecycle, the keyboard path through the request form, and axe-core accessibility assertions on the customer form and admin queue; capture screenshots per constitution Principle III
- [ ] T067 Verify coverage meets the 85%/76%/85%/85% threshold for `src/features/**/services/**` with `npm run test:coverage` (SC-008)
- [ ] T068 Run `sonarqube_analyze_file` on every added and modified file, and `sonarqube_list_potential_security_issues` on all API routes plus the evidence upload handler; resolve every BLOCKER and CRITICAL
- [ ] T069 Run the full gate — `npm run lint`, `npx tsc --noEmit -p tsconfig.check.json`, `npm test`, `npm run build`, `npm run docs:check` — and the manual verification path in [quickstart.md](./quickstart.md)
- [ ] T070 Run the `branch-diff-review` skill, then `branch-diff-remediate`, looping until the verdict is `READY TO COMMIT` with an empty remediation queue

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 0 (Decision)**: **Closed.** Option B recorded 2026-08-08.
- **Phase 1 (Setup)**: Ready to start. All three tasks parallel.
- **Phase 2 (Foundational)**: After Phase 1. **Blocks all user stories.**
- **Phase 3 (US1)**: After Phase 2.
- **Phase 4 (US2)**: After US1 — there is nothing to triage until returns exist.
- **Phase 5 (US3)**: After US2 — a return must reach `APPROVED` before it can be received.
- **Phase 6 (US4)**: After US3 — the full lifecycle must exist before it can be reported.
- **Phase 7 (Polish)**: After all desired stories.

### Why the P1 stories are sequential, not parallel

US1, US2, and US3 are all P1 but form a strict chain: each consumes the state the previous one produces. They are not independently deliverable as a _product_ — a request nobody can approve, or an approval that never restocks, has no commercial value. They remain independently _testable_, which is what the story boundaries buy. US4 is genuinely additive and could be deferred indefinitely without breaking the loop.

### Within Phase 2

```text
T005 → T006 → T007 → T008 → T009      (schema chain, strictly sequential)
T010, T011, T012                       (parallel — three test files)
T013 → T015                            (calculator depends on allocateMoney)
T014                                   (parallel with T013/T015)
T016                                   (parallel with all pure-function work)
```

### Critical path

`T005–T009 → T013/T015 → T021 → T024 → T033 → T036 → T044 → T046 → T046a → T069`

---

## Parallel Opportunities

**Phase 1** — all three:

```text
T002  roles.ts
T003  edge-config.ts
T004  constants/returns.ts
```

**Phase 2 tests** — three independent files:

```text
T010  __tests__/lib/money.test.ts
T011  __tests__/features/orders/services/return-state-machine.test.ts
T012  __tests__/features/orders/services/return-refund-calculator.test.ts
```

**Phase 5 tests** — four independent files:

```text
T040  return-restock.test.ts
T041  return-service.test.ts (receive + refund paths)
T042  COD path
T043  status-transitions.test.ts
```

**Phase 6** — event, template, and UI are independent until T056:

```text
T054  inngest/events.ts
T055  email/templates.ts
```

**Phase 7** — T062, T064, T065, T066 touch disjoint files.

---

## Implementation Strategy

### Minimum shippable increment

Phases 1–5 (T002–T051, including T018a and T046a). This is the smallest set that delivers commercial value: a customer can file a damage claim, an administrator can triage it, and the goods and money settle correctly. Stopping before Phase 5 ships a feature that takes customer claims and cannot fulfil them, which is worse than shipping nothing.

### Recommended sequence

1. **Phase 1 + 2** — schema and pure logic. Apply the migration and get a fully green test run before touching a route.
2. **Phase 3** — validate with a real customer session over HTTPS. Confirm the 404-not-403 ownership behaviour and the mandatory-evidence rejection explicitly.
3. **Phase 4** — validate with `SUPPORT` and `ADMIN` accounts, and with a staff account lacking the permission.
4. **Phase 5** — **the highest-risk phase.** Verify idempotency by replaying every mutation and asserting stock and refund counts are unchanged. Test COD separately from gateway orders.
5. **Phase 6** — verify the notification actually fires; an unregistered Inngest function is silent.
6. **Phase 7** — gates, review, remediate. **T063 needs product/legal sign-off on the amended policy wording**; start that conversation early rather than at the merge gate.

### Highest-risk tasks

| Task       | Risk                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| T044       | Reusing `restockOrderItems` instead of writing a sibling consumes the order-level claim and permanently blocks future restocks |
| T046/T046a | Merging `receive` and `refund` back into one action strands a gateway-rejected return at `RECEIVED` with no exit               |
| T047       | Calling the gateway for a COD order surfaces a 400 to the administrator with no recovery path                                  |
| T005       | A `NOT NULL` `ReturnEvidence.returnRequestId` makes the upload-before-create sequence impossible                               |
| T008       | A missing `deliveredAt` backfill leaves every historical delivered order with a null window anchor                             |
| T020       | Keying `returnsConfig` by category id silently disables every per-category window — `products.category` is free text           |
| T057/T058  | An unregistered Inngest function fails silently — no error, no notification                                                    |
| T013       | Naive per-item rounding instead of largest-remainder loses paise and breaks SC-004 reconciliation                              |

---

## Summary

| Phase            | Tasks            | Count  |
| ---------------- | ---------------- | ------ |
| 0 — Decision     | T001             | 1      |
| 1 — Setup        | T002–T004        | 3      |
| 2 — Foundational | T005–T016        | 12     |
| 3 — US1 (P1)     | T017–T030, T018a | 15     |
| 4 — US2 (P1)     | T031–T039        | 9      |
| 5 — US3 (P1)     | T040–T051, T046a | 13     |
| 6 — US4 (P2)     | T052–T061        | 10     |
| 7 — Polish       | T062–T070        | 9      |
| **Total**        |                  | **72** |

Test tasks: 16. Parallelisable tasks: 28.
