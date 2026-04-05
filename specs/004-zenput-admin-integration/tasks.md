# Tasks: Zenput Admin Integration

**Input**: Design documents from `specs/004-zenput-admin-integration/`
**Prerequisites**: plan.md ✅, spec.md ✅, data-model.md ✅, quickstart.md ✅, research.md ✅

**Tests**: Unit test updates (required — SC-008, plan.md Principle III) and Playwright verification
(required — FR-030) are included as update tasks applied **after** each story's implementation.

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and
delivered independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with adjacent tasks (different files, no blocking dependency)
- **[Story]**: Which user story this task belongs to (US1–US4)
- All file paths are relative to repository root

---

## Phase 1: Setup

**Purpose**: Install the zenput@1 library — the single prerequisite that blocks all user story phases.

- [ ] T001 Install zenput@1 as a project dependency by running `npm install zenput@1` and verifying the install with `node -e "const z = require('zenput'); console.log(Object.keys(z))"` (expected output includes TextInput, TextArea, NumberInput, SelectInput, FileInput, DataTable); confirm `zenput` appears in `package.json` dependencies

**Checkpoint**: `zenput@1` is listed in `package.json` and the verify command succeeds — all user story phases can now begin.

---

## Phase 2: Foundational

_Not applicable for this feature. There are no shared infrastructure, database schema, or API changes
that block user stories. The sole blocking prerequisite is the zenput install in Phase 1._

---

## Phase 3: User Story 1 — Admin Creates or Edits a Product Using Standardised Form Fields (Priority: P1) 🎯 MVP

**Goal**: Replace all native form elements in `ProductFormModal.tsx` with zenput@1 components
(TextInput, TextArea, NumberInput, SelectInput, FileInput). Wire validation errors to
`validationState` / `errorMessage` props. No changes to `useProductForm`, API calls, or Redux.

**Independent Test**: Open the product form modal, submit with all fields blank, and confirm that
every field (name, description, price, currency, stock, category, image) renders as a zenput
component and shows an inline error beneath it. Confirm pre-populated values display correctly in
edit mode. Confirm `AdditionalImageRow` inputs are untouched.

### Implementation for User Story 1

- [ ] T002 [US1] Add zenput named imports (`TextInput`, `TextArea`, `NumberInput`, `SelectInput`, `FileInput`) and type import (`SelectOption`) at the top of `src/features/admin/components/ProductFormModal.tsx`; add `useMemo` to the React import; derive `currencyOptions: SelectOption[]` inside `useMemo` by mapping `Object.keys(CURRENCIES)` to `{ value: code, label: \`${code} (${CURRENCIES[code as keyof typeof CURRENCIES]})\` }`; derive `categoryOptions: SelectOption[]` inside `useMemo` as `[{ value: '', label: 'Select a category', disabled: true }, ...categoryList.map((c) => ({ value: c, label: c }))]`
- [ ] T003 [US1] In `src/features/admin/components/ProductFormModal.tsx`, replace the native `<input type="text">` for product name with `<TextInput label="Product Name" required fullWidth value={formData.name} onChange={(e) => { setFormData({ ...formData, name: e.target.value }); clearFieldError('name') }} validationState={fieldErrors.name ? 'error' : 'default'} errorMessage={fieldErrors.name} />`; replace the native `<textarea>` for description with `<TextArea label="Description" required fullWidth value={formData.description} onChange={(e) => { setFormData({ ...formData, description: e.target.value }); clearFieldError('description') }} validationState={fieldErrors.description ? 'error' : 'default'} errorMessage={fieldErrors.description} />`; remove the now-redundant inline error `<p>` elements for both fields
- [ ] T004 [US1] In `src/features/admin/components/ProductFormModal.tsx`, replace the native `<input type="number">` for price with `<NumberInput label="Price" required fullWidth min={0} step={0.01} value={formData.price} onChange={(v) => { setFormData({ ...formData, price: v ?? 0 }); clearFieldError('price') }} validationState={fieldErrors.price ? 'error' : 'default'} errorMessage={fieldErrors.price} />`; replace the adjacent native currency `<select>` with `<SelectInput label="Currency" required fullWidth options={currencyOptions} value={formData.priceCurrency} onChange={(e) => setFormData({ ...formData, priceCurrency: e.target.value })} validationState="default" />`; remove the now-redundant inline error `<p>` for price
- [ ] T005 [US1] In `src/features/admin/components/ProductFormModal.tsx`, replace the native `<input type="number">` for stock with `<NumberInput label="Stock" required fullWidth min={0} step={1} value={formData.stock} onChange={(v) => { setFormData({ ...formData, stock: v ?? 0 }); clearFieldError('stock') }} validationState={fieldErrors.stock ? 'error' : 'default'} errorMessage={fieldErrors.stock} />`; replace the native category `<select>` with `<SelectInput label="Category" required fullWidth options={categoryOptions} placeholder="Select a category" value={formData.category} onChange={(e) => { setFormData({ ...formData, category: e.target.value }); clearFieldError('category') }} validationState={fieldErrors.category ? 'error' : 'default'} errorMessage={fieldErrors.category} />`; remove the now-redundant inline error `<p>` elements for both fields
- [ ] T006 [US1] In `src/features/admin/components/ProductFormModal.tsx`, replace the native primary image `<input type="file">` with `<FileInput label="Product Image" fullWidth accept="image/jpeg,image/jpg,image/png,image/webp,image/gif" showFileNames onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPendingFile(f); clearFieldError('image') } }} validationState={fieldErrors.image ? 'error' : 'default'} errorMessage={fieldErrors.image} />`; confirm the `AdditionalImageRow` component and its native inputs are not modified; remove any now-redundant inline error `<p>` for the image field
- [ ] T007 [US1] Update `__tests__/features/admin/components/ProductFormModal.test.tsx` to query zenput components instead of native elements: update `getByRole('textbox')` and label-based queries to target the rendered TextInput and TextArea, update `<select>` queries for category and currency to target SelectInput, update `<input type="number">` queries to target NumberInput, update `<input type="file">` to target FileInput; verify all existing test scenarios (open modal, submit invalid, submit valid, edit pre-population) pass with no regressions

**Checkpoint**: `src/features/admin/components/ProductFormModal.tsx` contains zero native `<input>`,
`<textarea>`, or `<select>` elements in the product fields (AdditionalImageRow excepted).
`__tests__/features/admin/components/ProductFormModal.test.tsx` passes with no regressions.

---

## Phase 4: User Story 2 — Admin Creates or Edits a Product Variation Using Standardised Form Fields (Priority: P2)

**Goal**: Replace all native form elements in `VariationFormModal.tsx` with zenput@1 components
(TextInput, SelectInput, NumberInput, FileInput). Wire validation errors to `validationState` /
`errorMessage` props. No changes to submission logic or Redux.

**Independent Test**: Open the variation form modal, submit with blank required fields, and confirm
every field (name, designName, variationType, styleId, price, currency, stock, image) renders as a
zenput component with an inline error beneath it. Confirm edit mode pre-populates values correctly.
Confirm the style selector is only visible when `variationType === 'styling'`.

### Implementation for User Story 2

- [ ] T008 [US2] Add zenput named imports (`TextInput`, `NumberInput`, `SelectInput`, `FileInput`) and type import (`SelectOption`) at the top of `src/features/admin/components/VariationFormModal.tsx`; add `useMemo` to the React import; define module-scope constant `VARIATION_TYPE_OPTIONS: SelectOption[] = [{ value: 'styling', label: 'Styling' }, { value: 'colour', label: 'Colour' }]`; derive `currencyOptions: SelectOption[]` inside `useMemo` by mapping `Object.keys(CURRENCIES)` to `{ value: code, label: \`${code} (${CURRENCIES[code as keyof typeof CURRENCIES]})\` }`; derive `styleOptions: SelectOption[]` inside `useMemo` from the `styles` prop as `styles.map((s) => ({ value: s.id, label: s.name }))`
- [ ] T009 [US2] In `src/features/admin/components/VariationFormModal.tsx`, replace the native `<input type="text">` for variation name with `<TextInput label="Variation Name" required fullWidth value={formData.name} onChange={(e) => { setFormData({ ...formData, name: e.target.value }); clearError('name') }} validationState={errors.name ? 'error' : 'default'} errorMessage={errors.name} />`; replace the native `<input type="text">` for design name with the same pattern targeting `formData.designName` and `errors.designName`; remove the now-redundant inline error `<p>` elements for both fields
- [ ] T010 [US2] In `src/features/admin/components/VariationFormModal.tsx`, replace the native variation-type `<select>` with `<SelectInput label="Variation Type" required fullWidth options={VARIATION_TYPE_OPTIONS} value={formData.variationType} onChange={(e) => setFormData({ ...formData, variationType: e.target.value as 'styling' | 'colour', styleId: e.target.value === 'styling' ? '' : formData.styleId })} validationState={errors.variationType ? 'error' : 'default'} errorMessage={errors.variationType} />`; replace the conditionally-rendered native style `<select>` (shown when `formData.variationType === 'styling'`) with `<SelectInput label="Style" fullWidth options={styleOptions} value={formData.styleId} onChange={(e) => setFormData({ ...formData, styleId: e.target.value })} validationState={errors.styleId ? 'error' : 'default'} errorMessage={errors.styleId} />`; remove redundant error `<p>` elements for both fields
- [ ] T011 [US2] In `src/features/admin/components/VariationFormModal.tsx`, replace the native `<input type="number">` for price with `<NumberInput label="Price" required fullWidth min={0} step={0.01} value={formData.price} onChange={(v) => { setFormData({ ...formData, price: v ?? 0 }); clearError('price') }} validationState={errors.price ? 'error' : 'default'} errorMessage={errors.price} />`; replace the adjacent native currency `<select>` with `<SelectInput label="Currency" required fullWidth options={currencyOptions} value={formData.priceCurrency} onChange={(e) => setFormData({ ...formData, priceCurrency: e.target.value })} validationState="default" />`; remove the redundant inline error `<p>` for price
- [ ] T012 [US2] In `src/features/admin/components/VariationFormModal.tsx`, replace the native `<input type="number">` for stock with `<NumberInput label="Stock" required fullWidth min={0} step={1} value={formData.stock} onChange={(v) => { setFormData({ ...formData, stock: v ?? 0 }); clearError('stock') }} validationState={errors.stock ? 'error' : 'default'} errorMessage={errors.stock} />`; replace the native primary image `<input type="file">` with `<FileInput label="Variation Image" fullWidth accept="image/jpeg,image/jpg,image/png,image/webp,image/gif" showFileNames onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPendingFile(f); clearError('image') } }} validationState={errors.image ? 'error' : 'default'} errorMessage={errors.image} />`; confirm the `AdditionalImageRow` component and its native inputs are not modified; remove redundant error `<p>` elements
- [ ] T013 [US2] Update `__tests__/features/admin/components/VariationFormModal.test.tsx` to query zenput components instead of native elements: update native `<select>` queries for variationType, styleId, and currency to target SelectInput, update `<input type="number">` queries to target NumberInput, update `<input type="file">` to target FileInput, update text input queries to target TextInput; verify all existing test scenarios (open modal, submit invalid, submit valid, edit pre-population, conditional style selector) pass with no regressions

**Checkpoint**: `src/features/admin/components/VariationFormModal.tsx` contains zero native `<input>`,
`<textarea>`, or `<select>` elements (AdditionalImageRow excepted).
`__tests__/features/admin/components/VariationFormModal.test.tsx` passes with no regressions.

---

## Phase 5: User Story 3 — Admin Views and Filters the Product List as a Data Table (Priority: P3)

**Goal**: Replace the existing product card grid on the Products admin page with a zenput `DataTable`.
Define the `ProductRow` interface, `productColumns` with an actions column, and derive `productRows`
from the existing `products` state. Preserve search input, pagination controls, and edit/delete
actions.

**Independent Test**: Navigate to `/admin/products`. Confirm a DataTable renders with columns Product,
Category, Price, Stock, and Actions. Confirm no card grid is present. Confirm Edit opens the product
form modal pre-populated. Confirm Delete triggers deletion. Confirm the empty-state message appears
when no products exist.

### Implementation for User Story 3

- [ ] T014 [US3] In `src/app/admin/products/page.tsx`, add zenput import (`DataTable`) and type imports (`DataTableRecord`, `DataTableColumn`) from `'zenput'`; define `interface ProductRow extends DataTableRecord` with fields `id: string`, `name: string`, `category: string`, `price: string`, `stock: number`, `_raw: Product`; define `productColumns: DataTableColumn<ProductRow>[]` containing entries for `'name'` (header: `'Product'`, width: `'35%'`), `'category'` (header: `'Category'`, width: `'20%'`), `'price'` (header: `'Price'`, width: `'15%'`), `'stock'` (header: `'Stock'`, width: `'10%'`), and `'actions'` (header: `'Actions'`, width: `'20%'`, `render: (_value, row) => <div className="flex gap-2"><button onClick={() => handleEdit(row._raw)}>Edit</button><button onClick={() => handleDelete(row._raw.id)}>Delete</button></div>`)
- [ ] T015 [US3] In `src/app/admin/products/page.tsx`, derive `productRows: ProductRow[]` inside the component body before the return statement by mapping the existing `products` state array: `products.map((p) => ({ id: p.id, name: p.name, category: p.category, price: formatPrice(p.price), stock: p.stock, _raw: p }))`
- [ ] T016 [US3] In `src/app/admin/products/page.tsx`, remove the existing product card grid JSX (the `products.map(...)` block rendering card components) and replace it with `<DataTable<ProductRow> columns={productColumns} data={productRows} rowKey={(row) => row.id} emptyMessage="No products found." />`; confirm that the search input, cursor-based pagination controls, and total-count display remain present in the rendered output
- [ ] T017 [US3] Update `playwright-tests/admin/products.spec.ts` to verify the DataTable renders with column headers Product, Category, Price, Stock, and Actions using accessible role or column-header queries; verify product rows appear in the table body; verify the Edit action in the Actions column opens the product form modal; verify the Delete action removes the product; verify the empty-state message `"No products found."` appears when no products match the current search

**Checkpoint**: The Products admin page renders a zenput DataTable. The card grid is absent. Search,
pagination, and edit/delete actions remain functional. `playwright-tests/admin/products.spec.ts`
passes.

---

## Phase 6: User Story 4 — Admin Views and Filters the Order List as a Data Table (Priority: P4)

**Goal**: Replace the `AdminOrderCard` list on the Orders admin page with a read-only zenput
`DataTable`. Define the `OrderRow` interface, `orderColumns` with a "View" action, and derive
`orderRows` from the existing `orders` state. Retain `AdminOrderCard` for editing via the View
action. Preserve status filter, search, and pagination controls.

**Independent Test**: Navigate to `/admin/orders`. Confirm a DataTable renders with columns Order ID,
Customer, Status, Total, Date, and Actions. Confirm the inline card list is absent. Confirm the View
action sets `selectedOrder` and renders `AdminOrderCard` for editing. Confirm the status filter
narrows visible rows. Confirm the empty-state message appears when no orders match.

### Implementation for User Story 4

- [ ] T018 [US4] In `src/app/admin/orders/page.tsx`, add zenput import (`DataTable`) and type imports (`DataTableRecord`, `DataTableColumn`) from `'zenput'`; define `interface OrderRow extends DataTableRecord` with fields `id: string`, `customerName: string`, `status: string`, `totalAmount: string`, `createdAt: string`, `_raw: AdminOrder`; define `orderColumns: DataTableColumn<OrderRow>[]` containing entries for `'id'` (header: `'Order ID'`, width: `'15%'`), `'customerName'` (header: `'Customer'`, width: `'25%'`), `'status'` (header: `'Status'`, width: `'15%'`), `'totalAmount'` (header: `'Total'`, width: `'15%'`), `'createdAt'` (header: `'Date'`, width: `'15%'`), and `'actions'` (header: `'Actions'`, width: `'15%'`, `render: (_value, row) => <button onClick={() => setSelectedOrder(row._raw)}>View</button>`)
- [ ] T019 [US4] In `src/app/admin/orders/page.tsx`, derive `orderRows: OrderRow[]` inside the component body before the return statement by mapping the existing `orders` state array: `orders.map((o) => ({ id: o.id, customerName: o.customerName, status: o.status, totalAmount: formatPrice(o.totalAmount), createdAt: new Date(o.createdAt).toLocaleDateString(), _raw: o }))`
- [ ] T020 [US4] In `src/app/admin/orders/page.tsx`, remove the existing list of `<AdminOrderCard>` components that renders the full order list inline, and replace it with `<DataTable<OrderRow> columns={orderColumns} data={orderRows} rowKey={(row) => row.id} emptyMessage="No orders found." />`; retain the conditional rendering of `<AdminOrderCard>` controlled by `selectedOrder` state (`selectedOrder !== null` → render AdminOrderCard for editing, closing sets `selectedOrder` back to `null`); confirm status filter, search input, and cursor-based pagination controls remain present
- [ ] T021 [US4] Update `playwright-tests/admin/orders.spec.ts` to verify the DataTable renders with column headers Order ID, Customer, Status, Total, Date, and Actions; verify order rows appear in the table body; verify the View action in the Actions column opens or renders the AdminOrderCard for editing; verify the status filter dropdown narrows the visible order rows; verify the empty-state message `"No orders found."` appears when no orders match the search or filter

**Checkpoint**: The Orders admin page renders a read-only zenput DataTable. The inline card list is
absent. `AdminOrderCard` remains accessible via the View action. `playwright-tests/admin/orders.spec.ts`
passes.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: TypeScript strict-mode compliance, build verification, and full test-suite green.

- [ ] T022 [P] Run `npx tsc --noEmit` from repository root and resolve any TypeScript strict-mode errors introduced across `src/features/admin/components/ProductFormModal.tsx`, `src/features/admin/components/VariationFormModal.tsx`, `src/app/admin/products/page.tsx`, and `src/app/admin/orders/page.tsx`; pay particular attention to `NumberInput`'s custom `onChange: (value: number | undefined) => void` signature (not a `React.ChangeEvent`), `SelectOption` prop types on SelectInput, and `DataTableRecord`-compatible row shapes for `ProductRow` and `OrderRow`
- [ ] T023 [P] Run quickstart validation from `specs/004-zenput-admin-integration/quickstart.md`: execute `node -e "const z = require('zenput'); console.log(Object.keys(z))"` to confirm all six expected exports (TextInput, TextArea, NumberInput, SelectInput, FileInput, DataTable) are present; run `npm run lint` to confirm zero ESLint errors (constitution §Development Workflow — Lint MUST pass); run `npm run build` to confirm no build errors; run `npm test` to confirm all unit tests pass with no coverage regression (SC-008)
- [ ] T024 [P] Run SonarQube analysis on all four modified source files (`src/features/admin/components/ProductFormModal.tsx`, `src/features/admin/components/VariationFormModal.tsx`, `src/app/admin/products/page.tsx`, `src/app/admin/orders/page.tsx`) using `sonarqube_analyze_file`; resolve any Blocker or Critical issues before merge (constitution §Development Workflow — "Modified files MUST be analyzed with SonarQube"); document any accepted findings with rationale

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **User Story Phases (3–6)**: All depend on T001 (zenput install) — **BLOCKS all stories**
- **Polish (Phase 7)**: Depends on all desired user story phases being complete

### User Story Dependencies

- **User Story 1 (P1) — Phase 3**: Starts after T001. No dependency on US2, US3, US4.
- **User Story 2 (P2) — Phase 4**: Starts after T001. No dependency on US1, US3, US4.
- **User Story 3 (P3) — Phase 5**: Starts after T001. No dependency on US1, US2, US4.
- **User Story 4 (P4) — Phase 6**: Starts after T001. No dependency on US1, US2, US3.

All four user story phases are fully independent: they touch separate files and share no runtime state.

### Within Each User Story

1. Import / options prep task (T002, T008, T014, T018) — must complete first within its story
2. Field or column implementation tasks — sequential (same file, applied in order)
3. Test update task — begins after source implementation is complete

### Parallel Opportunities

- After T001 completes, Phase 3 through Phase 6 can all begin in parallel
- T022 and T023 and T024 in Phase 7 are marked [P] — type-check, build/test, and security scan operate on independent concerns
- Within the same story, sequential tasks in the same file cannot be parallelised

---

## Parallel Execution Example: All Four Stories After Setup

```bash
# After T001 completes, assign one story per developer and run concurrently:

# Developer A — User Story 1 (ProductFormModal)
T002 → T003 → T004 → T005 → T006 → T007

# Developer B — User Story 2 (VariationFormModal)
T008 → T009 → T010 → T011 → T012 → T013

# Developer C — User Story 3 (Products DataTable)
T014 → T015 → T016 → T017

# Developer D — User Story 4 (Orders DataTable)
T018 → T019 → T020 → T021

# All developers together — Polish
T022, T023, T024  (can run in parallel with each other)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 3: User Story 1 (T002–T007)
3. **STOP and VALIDATE**: Open product form modal, verify zenput fields render, submit invalid data,
   verify inline errors appear per field
4. Deploy/demo if ready

### Incremental Delivery

1. T001 (install zenput) → foundation ready
2. T002–T007 (US1) → Product form standardised → demo ✅
3. T008–T013 (US2) → Variation form standardised → demo ✅
4. T014–T017 (US3) → Products DataTable live → demo ✅
5. T018–T021 (US4) → Orders DataTable live → demo ✅
6. T022–T024 (Polish) → TypeScript clean, lint passes, all tests green, SonarQube scan clean → ship ✅

### Parallel Team Strategy

With four developers available after T001: assign each developer one user story phase. All four
phases can merge independently without file conflicts.

---

## Notes

- **`AdditionalImageRow`** native inputs are explicitly out of scope — do not replace them with
  zenput components (FR-006, FR-013, A-005)
- **`NumberInput` `onChange` signature** is `(value: number | undefined) => void`, **not**
  `React.ChangeEvent<HTMLInputElement>` — handle accordingly at T002 and T008 (research.md §1)
- **Currency options shape**: `Object.keys(CURRENCIES).map(code => ({ value: code, label: \`${code} (${CURRENCIES[code]})\` }))` — use this exact mapping (key implementation fact)
- **`_raw` field on row objects**: `DataTableRecord` is typed as `Record<string, any>` per plan.md
  Principle II, so `_raw: Product` and `_raw: AdminOrder` are valid row fields; if a strict
  constraint surfaces at T014/T018, move `_raw` outside the row and use a `Map<string, Product>`
  keyed by `id` for the actions render callback
- **All four modified files are already `'use client'`** — no new client boundary is needed
  (plan.md Principle I)
- **Tailwind CSS v4 compatibility**: zenput ships its own styles; if conflicts appear, isolate at
  the component boundary using a wrapper `className` (plan.md §Technical Context)
- Commit after each task or logical group; validate each story at its checkpoint before moving to
  the next priority
