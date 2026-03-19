# Tasks: Admin Product Variation Management

**Input**: Design documents from `/specs/002-admin-variation-management/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/variation-api.md, quickstart.md

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Schema & Validation)

**Purpose**: Database migration and shared validation schemas needed by all stories

- [x] T001 Add `deletedAt` timestamp column to `productVariations` in `lib/schema.ts`
- [x] T002 Generate Drizzle migration via `npm run db:generate` and review generated SQL in `drizzle/`
- [x] T003 Apply migration via `npm run db:migrate`
- [x] T004 [P] Add `CreateVariationSchema` and `UpdateVariationSchema` Zod schemas in `lib/validations.ts` per data-model.md validation rules
- [x] T005 [P] Verify `invalidateProductCaches` in `lib/cache.ts` covers variation mutations (variations are nested in product queries — no new cache keys needed unless gaps found)

---

## Phase 2: Foundational (Soft-Delete Filtering + Product Edit Page Shell)

**Purpose**: Core infrastructure that MUST be complete before user story implementation. Includes soft-delete filtering across all customer-facing queries and the admin product edit page skeleton with variation list display (US4).

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Filter soft-deleted variations in `lib/db.ts` `findAll()` (~line 125): change `with: { variations: true }` to `with: { variations: { where: (v, { isNull }) => isNull(v.deletedAt) } }`
- [x] T007 Filter soft-deleted variations in `lib/db.ts` `findBestsellers()` (~line 230): add `isNull(pv.deletedAt)` to the `findMany` where clause
- [x] T008 Filter soft-deleted variations in `lib/db.ts` `findById()` (~line 320): change `with: { variations: true }` to use `where: isNull(deletedAt)`
- [x] T009 Filter soft-deleted variations in `lib/db.ts` wishlist `getProducts()` (~line 423): change `with: { variations: true }` to use `where: isNull(deletedAt)`
- [x] T010 Filter soft-deleted variations in `app/api/cart/route.ts` across all cart queries (~lines 50, 208, 221, 349): add `isNull(deletedAt)` filter to nested `with: { variations: ... }` clauses
- [x] T011 Filter soft-deleted variations in `app/api/orders/route.ts` order creation (~line 317): add `isNull(deletedAt)` check when looking up variations for pricing
- [x] T012 [P] [US4] Create admin product edit page Server Component at `app/admin/products/[id]/page.tsx` that fetches product + active variations from DB (explicitly filter `isNull(deletedAt)` on variations in the Drizzle `with:` clause) and renders product details with a variations section shell
- [x] T013 [P] [US4] Create `VariationList` Client Component in `components/admin/VariationList.tsx` displaying variation cards (name, designName, priceModifier, stock, thumbnail) with empty state per FR-013
- [x] T014 [US4] Update admin products list page `app/admin/products/page.tsx` to link product cards to `/admin/products/[id]` for editing instead of opening ProductFormModal

**Checkpoint**: Soft-delete filtering complete across all customer-facing queries. Admin product edit page displays product details and lists existing variations. No variation mutation capability yet.

---

## Phase 3: User Story 1 — Create a New Variation (Priority: P1) 🎯 MVP

**Goal**: Admin can create a new variation for any product via a form, with full validation (name uniqueness, required fields, effective price > 0, 25-variation limit).

**Independent Test**: Navigate to a product's edit page, click "Add Variation", fill all fields, submit, verify variation appears in the list and on customer-facing product page.

### Implementation for User Story 1

- [x] T015 [US1] Create POST handler in `app/api/admin/products/[id]/variations/route.ts` per contracts/variation-api.md: wrap with `withApiLogging`, auth check, validate with CreateVariationSchema, enforce 25-variation limit, check effective price > 0, check name uniqueness (including archived variations — return descriptive 409 if name conflicts with a soft-deleted variation), insert via Drizzle, invalidate caches, return 201
- [x] T016 [US1] Create GET handler in `app/api/admin/products/[id]/variations/route.ts`: wrap with `withApiLogging`, auth check, list active (non-deleted) variations for product, return with count
- [x] T017 [US1] Create `VariationFormModal` Client Component in `components/admin/VariationFormModal.tsx` with form fields (name, designName, priceModifier, stock), client-side validation, effective price warning (formula: `product.price + priceModifier > 0`, must match server-side logic), and submit to POST endpoint
- [x] T018 [US1] Wire "Add Variation" button in `VariationList` to open `VariationFormModal` in create mode; refresh variation list on successful creation

**Checkpoint**: Admin can create variations with full validation. Variations appear in the admin list and on the customer storefront. MVP complete.

---

## Phase 4: User Story 2 — Edit an Existing Variation (Priority: P2)

**Goal**: Admin can edit any field of an existing variation via a pre-populated form.

**Independent Test**: Click edit on a variation, modify fields, save, verify changes persist in admin list and on storefront.

### Implementation for User Story 2

- [x] T019 [US2] Create PUT handler in `app/api/admin/products/[id]/variations/[variationId]/route.ts` per contracts/variation-api.md: wrap with `withApiLogging`, auth check, validate with UpdateVariationSchema, check effective price > 0 if priceModifier changed, check name uniqueness if name changed (including archived name conflicts), update via Drizzle, invalidate caches
- [x] T020 [US2] Add edit mode to `VariationFormModal` in `components/admin/VariationFormModal.tsx`: accept optional `variation` prop to pre-populate fields, submit to PUT endpoint instead of POST when editing
- [x] T021 [US2] Wire edit button on variation cards in `VariationList` to open `VariationFormModal` with selected variation data; refresh list on success

**Checkpoint**: Admin can edit variations. Changes reflected in admin and storefront.

---

## Phase 5: User Story 3 — Delete a Variation (Priority: P2)

**Goal**: Admin can soft-delete a variation with confirmation. Deleted variations hidden from customers but preserved in order history.

**Independent Test**: Delete a variation, verify it disappears from admin list and storefront, verify existing orders still show the variation details.

### Implementation for User Story 3

- [x] T022 [US3] Create DELETE handler in `app/api/admin/products/[id]/variations/[variationId]/route.ts`: wrap with `withApiLogging`, auth check, verify variation exists and belongs to product, set `deletedAt = now()`, invalidate caches
- [x] T023 [US3] Wire delete button on variation cards in `VariationList` to show existing `DeleteConfirmModal` from `components/admin/DeleteConfirmModal.tsx`; on confirm, call DELETE endpoint and remove variation from list

**Checkpoint**: Admin can soft-delete variations. Order history remains intact with original variation details.

---

## Phase 6: User Story 5 — Upload Variation Images (Priority: P3)

**Goal**: Admin can upload a primary image and additional images per variation during create or edit.

**Independent Test**: Upload images during variation creation, verify they appear in admin form preview and on customer storefront when variation is selected.

### Implementation for User Story 5

- [x] T024 [US5] Add image upload fields to `VariationFormModal` in `components/admin/VariationFormModal.tsx`: primary image file input with preview, additional images slots (up to 10), reuse existing upload logic pattern from `ProductFormModal`
- [x] T025 [US5] Add image upload flow to `VariationFormModal` submit handler: upload files to `/api/upload` before variation create/update, pass returned URLs in the request body
- [x] T026 [US5] Display variation thumbnail image in `VariationList` cards in `components/admin/VariationList.tsx` (use Next.js Image component with fallback to product image)

**Checkpoint**: Full variation image management working — upload, preview, display in admin and storefront.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Extract product edit form, tests, and cleanup

- [x] T027 [P] Extract `ProductEditForm` Client Component from `ProductFormModal` into `components/admin/ProductEditForm.tsx` — inline form layout for the product edit page (reuse field logic, remove modal wrapper)
- [x] T028 [P] Integrate `ProductEditForm` into `app/admin/products/[id]/page.tsx` replacing the placeholder product details section
- [x] T029 [P] Add unit tests for `CreateVariationSchema` and `UpdateVariationSchema` in `__tests__/lib/validations.test.ts`
- [x] T030 [P] Add unit tests for variation API routes in `__tests__/app/api/admin/products/[id]/variations/route.test.ts` covering: create, list, update, soft-delete, validation errors, 25-limit rejection, effective price rejection, duplicate name rejection, archived name conflict. Auth negative tests: unauthenticated → 401, non-admin → 403, admin → success for each endpoint
- [x] T031 [P] Add component tests for `VariationList` in `__tests__/components/admin/VariationList.test.tsx` (renders variations, empty state, edit/delete buttons)
- [x] T032 [P] Add component tests for `VariationFormModal` in `__tests__/components/admin/VariationFormModal.test.tsx` (create mode, edit mode, validation errors, effective price warning)
- [x] T033 Run `quickstart.md` validation: start dev server, navigate to admin product edit page, create/edit/delete a variation, verify customer storefront shows correct data
- [x] T034 [P] Add integration test for FR-011 order history preservation in `__tests__/app/api/admin/products/[id]/variations/soft-delete-orders.test.ts`: create variation → create order referencing it → soft-delete variation → fetch order → verify order still shows original variation name, designName, and details

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on T001–T003 (schema change + migration). BLOCKS all user stories
- **US1 Create (Phase 3)**: Depends on Phase 2 completion (page + variation list exist)
- **US2 Edit (Phase 4)**: Depends on Phase 3 (create endpoint + VariationFormModal exist)
- **US3 Delete (Phase 5)**: Depends on Phase 2 (variation list exists). Can run in parallel with Phase 3/4
- **US5 Images (Phase 6)**: Depends on Phase 3 (VariationFormModal exists to add image fields to)
- **Polish (Phase 7)**: Depends on Phase 3 minimum; T027-T028 can start after Phase 2

### User Story Independence

- **US4 (View)**: Delivered in Phase 2 — foundational for all other stories
- **US1 (Create)**: After Phase 2 — delivers MVP
- **US2 (Edit)**: After US1 — needs the form modal created in US1
- **US3 (Delete)**: After Phase 2 — reuses existing DeleteConfirmModal, can parallel with US1/US2
- **US5 (Images)**: After US1 — extends the form modal from US1

### Within Each Phase

- Tasks marked [P] within the same phase can run in parallel
- T006–T011 (soft-delete filtering) should be done sequentially per file to avoid conflicts in `lib/db.ts`
- T012, T013 can run in parallel (different files)
- T015, T016 are in the same file — do sequentially
- T029–T032 are all in different files — fully parallelizable

### Parallel Opportunities

```
Phase 1: T004 ║ T005 (different files)
Phase 2: T006–T011 (sequential per file) ║ T012+T013 (parallel, different files)
Phase 3: T015→T016 (same file) then T017→T018
Phase 4: T019 then T020→T021
Phase 5: T022→T023 (can run parallel with Phase 3/4)
Phase 6: T024→T025→T026
Phase 7: T027 ║ T029 ║ T030 ║ T031 ║ T032 ║ T034 (all parallel)
```

---

## Implementation Strategy

### MVP First (User Story 1 + 4 Only)

1. Complete Phase 1: Setup (schema + validation)
2. Complete Phase 2: Foundational (soft-delete + edit page + variation list = US4)
3. Complete Phase 3: User Story 1 (create variations)
4. **STOP and VALIDATE**: Admin can view and create variations, customers see them on storefront
5. Deploy/demo MVP

### Incremental Delivery

1. Setup + Foundational → Schema ready, soft-delete filtering live, edit page visible
2. Add US1 (Create) → Test independently → **Deploy MVP**
3. Add US2 (Edit) → Test independently → Deploy
4. Add US3 (Delete) → Test independently → Deploy
5. Add US5 (Images) → Test independently → Deploy
6. Polish → Tests, extract ProductEditForm, quickstart validation

### Task Count Summary

| Phase                     | Tasks  | Parallelizable |
| ------------------------- | ------ | -------------- |
| Phase 1: Setup            | 5      | 2              |
| Phase 2: Foundational     | 9      | 2              |
| Phase 3: US1 Create (MVP) | 4      | 0              |
| Phase 4: US2 Edit         | 3      | 0              |
| Phase 5: US3 Delete       | 2      | 0              |
| Phase 6: US5 Images       | 3      | 0              |
| Phase 7: Polish           | 8      | 7              |
| **Total**                 | **34** | **11**         |

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Order history queries intentionally NOT filtered for soft-deleted variations (FR-011)
- Admin order views intentionally NOT filtered (audit trail)
- Image upload reuses existing `/api/upload` endpoint — no new upload infrastructure needed
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
