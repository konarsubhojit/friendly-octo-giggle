# Data Model: Zenput Admin Integration

_Phase 1 output — entity shapes, prop contracts, and state transitions for the
UI-layer migration. No database schema or API changes._

---

## Overview

This feature modifies the rendered output of four existing client components. There
are no new entities, no schema migrations, and no new API surfaces. This document
captures:

1. The **zenput component prop contracts** — what each component expects and how the
   existing form state maps to it.
2. The **DataTable row shapes** — the typed record objects that the Products and
   Orders DataTable instances consume.
3. **State transitions** — how existing form and modal state machines remain unchanged.

---

## 1. Zenput Form Component Prop Contracts

### 1.1 Shared validation-state pattern

All zenput form components receive two props derived from the existing validation
error map:

```ts
validationState: fieldErrors.FIELD ? 'error' : 'default'
errorMessage:    fieldErrors.FIELD           // string | undefined
```

The existing hooks (`useProductForm`, inline state in `VariationFormModal`) produce
`fieldErrors: Partial<Record<keyof FormData, string>>`. This shape maps directly —
no hook changes required.

---

### 1.2 ProductFormModal — field-by-field contract

| Field | zenput Component | Key props | Source state |
|-------|-----------------|-----------|--------------|
| Product name | `TextInput` | `value={formData.name}` `onChange={e => { setFormData({...formData, name: e.target.value}); clearFieldError('name') }}` `label="Product Name"` `required` `fullWidth` `validationState` `errorMessage` | `formData.name`, `fieldErrors.name` |
| Description | `TextArea` | `value={formData.description}` `onChange={e => { ... clearFieldError('description') }}` `label="Description"` `required` `fullWidth` `validationState` `errorMessage` | `formData.description`, `fieldErrors.description` |
| Price (numeric only) | `NumberInput` | `value={formData.price}` `onChange={(v) => { setFormData({...formData, price: v ?? 0}); clearFieldError('price') }}` `min={0}` `step={0.01}` `label="Price"` `required` `fullWidth` `validationState` `errorMessage` | `formData.price`, `fieldErrors.price` |
| Price currency | `SelectInput` | `value={priceCurrency}` `onChange={e => handlePriceCurrencyChange(e.target.value as CurrencyCode)}` `options={currencyOptions}` `label="Currency"` — mapped from `availableCurrencies` as `{ value: code, label: \`${code} (${symbol})\` }` | `priceCurrency`, `availableCurrencies` |
| Stock quantity | `NumberInput` | `value={formData.stock}` `onChange={(v) => { setFormData({...formData, stock: v ?? 0}); clearFieldError('stock') }}` `min={0}` `step={1}` `label="Stock"` `required` `fullWidth` `validationState` `errorMessage` | `formData.stock`, `fieldErrors.stock` |
| Category | `SelectInput` | `value={formData.category}` `onChange={e => { setFormData({...formData, category: e.target.value}); clearFieldError('category') }}` `options={categoryOptions}` `placeholder="Select a category"` `label="Category"` `required` `fullWidth` `validationState` `errorMessage` | `formData.category`, `fieldErrors.category`, `categoryList` prop |
| Primary image | `FileInput` | `accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"` `onChange={e => { const f = e.target.files?.[0]; if (f) { setPendingFile(f); clearFieldError('image') } }}` `label="Product Image"` `showFileNames` `fullWidth` `validationState` `errorMessage` | `pendingImageFile`, `fieldErrors.image` |
| Additional images | `AdditionalImageRow` (native) | **Out of scope — unchanged** (FR-006, A-005) | — |

**SelectInput options derivation** (computed once, stable via `useMemo`):

```ts
const categoryOptions = useMemo<SelectOption[]>(
  () => [
    { value: '', label: 'Select a category', disabled: true },
    ...categoryList.map((c) => ({ value: c, label: c })),
  ],
  [categoryList]
)
```

---

### 1.3 VariationFormModal — field-by-field contract

| Field | zenput Component | Key props | Source state |
|-------|-----------------|-----------|--------------|
| Variation name | `TextInput` | `value={formData.name}` `onChange={e => { setFormData({...formData, name: e.target.value}); clearError('name') }}` `label="Variation Name"` `required` `fullWidth` `validationState` `errorMessage` | `formData.name`, `errors.name` |
| Design name | `TextInput` | Same pattern for `designName` field | `formData.designName`, `errors.designName` |
| Variation type | `SelectInput` | `value={formData.variationType}` `onChange={e => setFormData({...formData, variationType: e.target.value as 'styling' \| 'colour', styleId: e.target.value === 'styling' ? '' : formData.styleId})}` `options={VARIATION_TYPE_OPTIONS}` `label="Variation Type"` `required` `fullWidth` `validationState` `errorMessage` | `formData.variationType`, `errors.variationType` |
| Style selector (styling only) | `SelectInput` | Conditionally rendered when `formData.variationType === 'colour'`; `options={styleOptions}` derived from `styles` prop | `formData.styleId`, `errors.styleId`, `styles` prop |
| Price (numeric only) | `NumberInput` | Same as product price pattern, `min={0}` `step={0.01}` | `formData.price`, `errors.price` |
| Price currency | `SelectInput` | `value={formData.priceCurrency}` `onChange={e => setFormData({...formData, priceCurrency: e.target.value as CurrencyCode})}` `options={currencyOptions}` `label="Currency"` — mapped from `Object.keys(CURRENCIES)` | `formData.priceCurrency` (or `priceCurrency` state) |
| Stock | `NumberInput` | `min={0}` `step={1}` | `formData.stock`, `errors.stock` |
| Primary image | `FileInput` | Same as product image pattern | `pendingFile`, `errors.image` |
| Additional images | `AdditionalImageRow` (native) | **Out of scope — unchanged** (FR-013, A-005) | — |

**Static options constants** (defined at module scope):

```ts
import type { SelectOption } from 'zenput'

const VARIATION_TYPE_OPTIONS: SelectOption[] = [
  { value: 'styling', label: 'Styling' },
  { value: 'colour',  label: 'Colour'  },
]
```

**Style options derivation** (from `styles` prop — `ProductVariation[]`):

```ts
const styleOptions = useMemo<SelectOption[]>(
  () => styles.map((s) => ({ value: s.id, label: s.name })),
  [styles]
)
```

---

## 2. DataTable Row Shapes

### 2.1 Products DataTable (`src/app/admin/products/page.tsx`)

```ts
import type { DataTableRecord, DataTableColumn } from 'zenput'

interface ProductRow extends DataTableRecord {
  id: string          // used as rowKey; not displayed as a column
  name: string        // column: "Product"
  category: string    // column: "Category"
  price: string       // column: "Price" — formatted via formatPrice()
  stock: number       // column: "Stock"
  _raw: Product       // column: hidden; used in actions render callback only
}
```

**Row mapper** (applied inside the existing `products` state map):

```ts
const productRows: ProductRow[] = products.map((p) => ({
  id: p.id,
  name: p.name,
  category: p.category,
  price: formatPrice(p.price),
  stock: p.stock,
  _raw: p,
}))
```

**Column definitions**:

```ts
const productColumns: DataTableColumn<ProductRow>[] = [
  { key: 'name',     header: 'Product',  width: '35%' },
  { key: 'category', header: 'Category', width: '20%' },
  { key: 'price',    header: 'Price',    width: '15%' },
  { key: 'stock',    header: 'Stock',    width: '10%' },
  {
    key: 'actions',
    header: 'Actions',
    width: '20%',
    render: (_value, row) => (
      <div className="flex gap-2">
        <button onClick={() => handleEdit(row._raw)}>Edit</button>
        <button onClick={() => handleDelete(row._raw.id)}>Delete</button>
      </div>
    ),
  },
]
```

**DataTable usage**:

```tsx
<DataTable<ProductRow>
  columns={productColumns}
  data={productRows}
  rowKey={(row) => row.id}
  emptyMessage="No products found."
/>
```

---

### 2.2 Orders DataTable (`src/app/admin/orders/page.tsx`)

```ts
import type { DataTableRecord, DataTableColumn } from 'zenput'

interface OrderRow extends DataTableRecord {
  id: string            // column: "Order ID"
  customerName: string  // column: "Customer"
  status: string        // column: "Status"
  totalAmount: string   // column: "Total" — formatted via formatPrice()
  createdAt: string     // column: "Date" — formatted as locale date string
  _raw: AdminOrder      // hidden; used in View action render callback only
}
```

**Row mapper**:

```ts
const orderRows: OrderRow[] = orders.map((o) => ({
  id: o.id,
  customerName: o.customerName,
  status: o.status,
  totalAmount: formatPrice(o.totalAmount),
  createdAt: new Date(o.createdAt).toLocaleDateString(),
  _raw: o,
}))
```

**Column definitions**:

```ts
const orderColumns: DataTableColumn<OrderRow>[] = [
  { key: 'id',           header: 'Order ID',  width: '15%' },
  { key: 'customerName', header: 'Customer',  width: '25%' },
  { key: 'status',       header: 'Status',    width: '15%' },
  { key: 'totalAmount',  header: 'Total',     width: '15%' },
  { key: 'createdAt',    header: 'Date',      width: '15%' },
  {
    key: 'actions',
    header: 'Actions',
    width: '15%',
    render: (_value, row) => (
      <button onClick={() => setSelectedOrder(row._raw)}>View</button>
    ),
  },
]
```

**DataTable usage**:

```tsx
<DataTable<OrderRow>
  columns={orderColumns}
  data={orderRows}
  rowKey={(row) => row.id}
  emptyMessage="No orders found."
/>
```

**AdminOrderCard integration**: `selectedOrder` state (type `AdminOrder | null`)
controls whether `AdminOrderCard` is rendered. Setting it from the "View" action
opens the card. Closing the card sets `selectedOrder` back to `null`. The `AdminOrderCard`
component is not removed — it is decoupled from the list view.

---

## 3. State Transitions

### 3.1 ProductFormModal — validation error lifecycle

```
User interaction
      │
      ▼
  onChange on field
      │
      ├─ clearFieldError(fieldName)    ← via useProductForm
      │                                  (clears error immediately on correction — FR-016 ✅)
      ▼
  formData updated
      │
      ▼
  onSubmit triggered
      │
      ├─ validateAll() → fieldErrors populated
      │
      ├─ fieldErrors non-empty?
      │   YES → render each zenput field with validationState='error' + errorMessage
      │   NO  → proceed with API call
      ▼
  API success → onSuccess() → modal close
```

No changes to this state machine. The only change is the rendering layer: native
elements are swapped for zenput components that consume the same `fieldErrors` map.

### 3.2 Orders page — selected order lifecycle

```
orders DataTable rendered
      │
      ▼
  Admin clicks "View" on row
      │
      ▼
  setSelectedOrder(row._raw)
      │
      ▼
  AdminOrderCard rendered (Suspense-wrapped, as modal or inline panel)
      │
      ▼
  Admin edits status / shipping → existing dispatch logic (unchanged)
      │
      ▼
  Admin closes card
      │
      ▼
  setSelectedOrder(null) → AdminOrderCard unmounted
```

---

## 4. Out-of-Scope Entities

The following are explicitly **not modified** by this feature:

- `AdditionalImageRow` — native inputs, out of scope (A-005, FR-006, FR-013)
- `useProductForm` hook — form submission logic, API calls, Redux dispatches
- `adminSlice` and all Redux state
- All API route handlers (`/api/admin/products`, `/api/admin/variations`, etc.)
- `AdminOrderCard` component internals — retained unchanged
- `lib/types.ts` — entity types are consumed but not modified
- Drizzle schema — no DB changes

---

## 5. Dependency Installation

```bash
npm install zenput@1
```

- Adds `"zenput": "^1.0.0"` to `dependencies` in `package.json`
- No peer dependency conflicts (React 19 satisfies `>=17.0.0`)
- No advisory vulnerabilities (verified against GitHub Advisory Database)
- Import in components: `import { TextInput, TextArea, NumberInput, SelectInput, FileInput, DataTable } from 'zenput'`
- Import types: `import type { SelectOption, DataTableRecord, DataTableColumn } from 'zenput'`
