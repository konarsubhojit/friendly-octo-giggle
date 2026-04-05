# Quickstart: Zenput Admin Integration

_Phase 1 output — developer onboarding guide for implementing this feature._

---

## What This Feature Does

Replaces custom-styled native form elements in the admin section with components
from the **zenput@1** library, and replaces card-grid / card-list layouts with
**zenput DataTable**. No backend code changes.

**Files changed**:

| File                                                   | Change                                                 |
| ------------------------------------------------------ | ------------------------------------------------------ |
| `src/features/admin/components/ProductFormModal.tsx`   | 6 native inputs → zenput components                    |
| `src/features/admin/components/VariationFormModal.tsx` | 7 native inputs → zenput components                    |
| `src/app/admin/products/page.tsx`                      | card grid → zenput DataTable                           |
| `src/app/admin/orders/page.tsx`                        | AdminOrderCard list → zenput DataTable (card retained) |

---

## Prerequisites

- Node 18+ / npm 9+
- Repository cloned and `npm install` already run
- Working knowledge of the existing `useProductForm` hook and `fieldErrors` pattern

---

## Step 1 — Install zenput

```bash
npm install zenput@1
```

Verify the install:

```bash
node -e "const z = require('zenput'); console.log(Object.keys(z))"
# Expected output includes: TextInput, TextArea, NumberInput, SelectInput, FileInput, DataTable
```

---

## Step 2 — Import zenput components

Add to each modified file:

```ts
import {
  TextInput,
  TextArea,
  NumberInput,
  SelectInput,
  FileInput,
  DataTable,
} from 'zenput'
import type { SelectOption, DataTableRecord, DataTableColumn } from 'zenput'
```

---

## Step 3 — Replace form fields (ProductFormModal)

### 3a. Product name — `TextInput`

```tsx
// Before
;<input
  id="product-name"
  type="text"
  value={formData.name}
  onChange={(e) => {
    setFormData({ ...formData, name: e.target.value })
    clearFieldError('name')
  }}
  className={`... ${fieldErrors.name ? 'border-red-400' : 'border-gray-300'}`}
/>
{
  fieldErrors.name && <p id="product-name-error">{fieldErrors.name}</p>
}

// After
;<TextInput
  label="Product Name"
  value={formData.name}
  onChange={(e) => {
    setFormData({ ...formData, name: e.target.value })
    clearFieldError('name')
  }}
  validationState={fieldErrors.name ? 'error' : 'default'}
  errorMessage={fieldErrors.name}
  required
  fullWidth
/>
```

### 3b. Description — `TextArea`

```tsx
<TextArea
  label="Description"
  value={formData.description}
  onChange={(e) => {
    setFormData({ ...formData, description: e.target.value })
    clearFieldError('description')
  }}
  validationState={fieldErrors.description ? 'error' : 'default'}
  errorMessage={fieldErrors.description}
  required
  fullWidth
/>
```

### 3c. Price — `NumberInput` + native currency `<select>` (unchanged)

> **Important**: `NumberInput.onChange` receives `number | undefined`, not a
> `ChangeEvent`. Use `v ?? 0` to guard against `undefined`.

```tsx
<div className="flex gap-2 items-start">
  {/* Currency selector — native, unchanged */}
  <select
    aria-label="Price currency"
    value={priceCurrency}
    onChange={(e) => onCurrencyChange(e.target.value as CurrencyCode)}
  >
    {availableCurrencies.map((c) => (
      <option key={c} value={c}>
        {c}
      </option>
    ))}
  </select>

  {/* Price — zenput */}
  <NumberInput
    label="Price"
    value={formData.price}
    onChange={(v) => {
      setFormData({ ...formData, price: v ?? 0 })
      clearFieldError('price')
    }}
    min={0}
    step={0.01}
    validationState={fieldErrors.price ? 'error' : 'default'}
    errorMessage={fieldErrors.price}
    required
    fullWidth
  />
</div>
```

### 3d. Stock — `NumberInput`

```tsx
<NumberInput
  label="Stock"
  value={formData.stock}
  onChange={(v) => {
    setFormData({ ...formData, stock: v ?? 0 })
    clearFieldError('stock')
  }}
  min={0}
  step={1}
  validationState={fieldErrors.stock ? 'error' : 'default'}
  errorMessage={fieldErrors.stock}
  required
  fullWidth
/>
```

### 3e. Category — `SelectInput`

```tsx
// Build options once (stable reference)
const categoryOptions = useMemo<SelectOption[]>(
  () => [
    { value: '', label: 'Select a category', disabled: true },
    ...categoryList.map((c) => ({ value: c, label: c })),
  ],
  [categoryList]
)

<SelectInput
  label="Category"
  value={formData.category}
  onChange={(e) => { setFormData({...formData, category: e.target.value}); clearFieldError('category') }}
  options={categoryOptions}
  placeholder="Select a category"
  validationState={fieldErrors.category ? 'error' : 'default'}
  errorMessage={fieldErrors.category}
  required
  fullWidth
/>
```

### 3f. Primary image — `FileInput`

```tsx
<FileInput
  label="Product Image"
  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
  onChange={(e) => {
    const file = e.target.files?.[0]
    if (file) {   // guard: preserves state if file dialog is cancelled
      setPendingFile(file)
      clearFieldError('image')
    }
  }}
  showFileNames
  fullWidth
  validationState={fieldErrors.image ? 'error' : 'default'}
  errorMessage={fieldErrors.image}
/>
{/* Current image preview when editing — retain existing Image element */}
{formData.image && !pendingImageFile && (
  <Image src={formData.image} alt="Current product image" ... />
)}
```

---

## Step 4 — Replace form fields (VariationFormModal)

Follow the same patterns as Step 3. Key differences:

- **Variation type** uses `SelectInput` with static `VARIATION_TYPE_OPTIONS` constant;
  its `onChange` must also reset `styleId` when switching to `'styling'`.
- **Style selector** is conditionally rendered (`formData.variationType === 'colour'`),
  with options derived from the `styles` prop via `useMemo`.
- All other fields (name, designName, price, stock, image) follow the identical
  `TextInput` / `NumberInput` / `FileInput` pattern from ProductFormModal.

See `data-model.md §1.3` for the complete field-by-field table.

---

## Step 5 — Add DataTable to Products page

```tsx
import { DataTable } from 'zenput'
import type { DataTableRecord, DataTableColumn } from 'zenput'

interface ProductRow extends DataTableRecord {
  id: string; name: string; category: string
  price: string; stock: number; _raw: Product
}

// Inside the component:
const productRows: ProductRow[] = products.map((p) => ({
  id: p.id, name: p.name, category: p.category,
  price: formatPrice(p.price), stock: p.stock, _raw: p,
}))

const productColumns: DataTableColumn<ProductRow>[] = [
  { key: 'name',     header: 'Product',  width: '35%' },
  { key: 'category', header: 'Category', width: '20%' },
  { key: 'price',    header: 'Price',    width: '15%' },
  { key: 'stock',    header: 'Stock',    width: '10%' },
  {
    key: 'actions', header: 'Actions', width: '20%',
    render: (_, row) => (
      <div className="flex gap-2">
        <button onClick={() => handleEdit(row._raw)}>Edit</button>
        <button onClick={() => handleDeleteClick(row._raw.id)}>Delete</button>
      </div>
    ),
  },
]

// In JSX — replaces the card grid:
<DataTable<ProductRow>
  columns={productColumns}
  data={productRows}
  rowKey={(row) => row.id}
  emptyMessage="No products found."
/>
```

---

## Step 6 — Add DataTable to Orders page

```tsx
interface OrderRow extends DataTableRecord {
  id: string; customerName: string; status: string
  totalAmount: string; createdAt: string; _raw: AdminOrder
}

const orderRows: OrderRow[] = orders.map((o) => ({
  id: o.id, customerName: o.customerName, status: o.status,
  totalAmount: formatPrice(o.totalAmount),
  createdAt: new Date(o.createdAt).toLocaleDateString(),
  _raw: o,
}))

const orderColumns: DataTableColumn<OrderRow>[] = [
  { key: 'id',           header: 'Order ID',  width: '15%' },
  { key: 'customerName', header: 'Customer',  width: '25%' },
  { key: 'status',       header: 'Status',    width: '15%' },
  { key: 'totalAmount',  header: 'Total',     width: '15%' },
  { key: 'createdAt',    header: 'Date',      width: '15%' },
  {
    key: 'actions', header: 'Actions', width: '15%',
    render: (_, row) => (
      <button onClick={() => setSelectedOrder(row._raw)}>View</button>
    ),
  },
]

// AdminOrderCard opened via selectedOrder state — retain existing modal pattern
{selectedOrder && (
  <Suspense fallback={<LoadingSpinner />}>
    <AdminOrderCard
      order={selectedOrder}
      onClose={() => setSelectedOrder(null)}
      ...
    />
  </Suspense>
)}
```

---

## Step 7 — Update unit tests

In `__tests__/features/admin/components/ProductFormModal.test.tsx` and
`VariationFormModal.test.tsx`:

- Replace `screen.getByRole('textbox', { name: /product name/i })` with the same
  query — zenput `TextInput` renders a native `<input>` internally, so
  `getByRole('textbox')` queries continue to work.
- Replace `screen.getByRole('combobox')` queries for category/variation type —
  zenput `SelectInput` renders a native `<select>`, so `getByRole('combobox')` still
  applies.
- Replace `screen.getByRole('spinbutton')` for number inputs — zenput `NumberInput`
  renders `<input type="number">`, so `getByRole('spinbutton')` still applies.
- Remove direct CSS class assertions (e.g., `border-red-400`) — verify errors via
  `screen.getByText(errorMessage)` instead.

---

## Step 8 — Run quality gates

```bash
# 1. Type check
npx tsc --noEmit

# 2. Lint
npm run lint

# 3. Unit tests
npm run test

# 4. Playwright (UI verification + screenshots)
npx playwright test playwright-tests/admin/

# 5. Build size check
npm run build
```

All gates must pass before the PR is opened. See constitution §Development Workflow.

---

## Common Pitfalls

| Pitfall                                                           | Fix                                                                                       |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `NumberInput.onChange` receives `undefined` when field is cleared | Always use `v ?? 0` (or domain minimum)                                                   |
| File dialog cancel clears image state                             | Guard with `if (e.target.files?.[0])` before updating state                               |
| SelectInput `value` is `undefined` on mount                       | Initialize form state with `''` not `undefined` for select fields                         |
| `DataTable` `_raw` column visible in table                        | Do not add `_raw` as a `DataTableColumn`; it is row data only, accessed via `render`      |
| Tailwind classes on zenput wrapper conflict with layout           | Use `wrapperClassName` for spacing adjustments; avoid overriding zenput internals         |
| zenput CSS not loading in test environment                        | Ensure `vitest.config.mts` processes CSS or that zenput's styles don't affect RTL queries |
