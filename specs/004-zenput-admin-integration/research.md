# Research: Zenput Admin Integration

_Phase 0 output — all NEEDS CLARIFICATION items resolved._

---

## 1. zenput@1 Package API

**Decision**: Use zenput@1.0.0 as the sole source of replacement UI components.  
**Rationale**: The package is published on npm at v1.0.0, has no known security
advisories (confirmed via GitHub Advisory Database), and its peer dependencies
(`react >=17.0.0`, `react-dom >=17.0.0`) are satisfied by the project's React 19.  
**Alternatives considered**: None — the feature spec mandates this specific package.

### Resolved API surface

All types exported from `zenput` (`dist/index.d.ts`):

```ts
// Shared base props (all form components inherit these)
interface BaseInputProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'outlined' | 'filled' | 'underlined'
  validationState?: 'default' | 'error' | 'success' | 'warning'
  label?: string
  helperText?: string
  errorMessage?: string // shown when validationState === 'error'
  required?: boolean
  disabled?: boolean
  readOnly?: boolean
  fullWidth?: boolean
  wrapperClassName?: string
  inputClassName?: string
  // … label/helperText className/style overrides
}

// TextInput — extends React.InputHTMLAttributes (standard value/onChange)
import { TextInput } from 'zenput'

// TextArea — extends React.TextareaHTMLAttributes
import { TextArea } from 'zenput'

// NumberInput — custom onChange signature (NOT ChangeEvent)
interface NumberInputProps extends BaseInputProps {
  value?: number
  min?: number
  max?: number
  step?: number
  hideControls?: boolean
  onChange?: (value: number | undefined) => void // ← differs from native
}
import { NumberInput } from 'zenput'

// SelectInput — controlled native <select> with options array
interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}
interface SelectInputProps
  extends React.SelectHTMLAttributes<HTMLSelectElement>, BaseInputProps {
  options: SelectOption[]
  placeholder?: string
}
import { SelectInput } from 'zenput'

// FileInput — extends React.InputHTMLAttributes<HTMLInputElement> (standard onChange)
interface FileInputProps extends BaseInputProps {
  buttonLabel?: string
  showFileNames?: boolean
  dropzone?: boolean
}
import { FileInput } from 'zenput'

// DataTable
type DataTableRecord = Record<string, any>
interface DataTableColumn<T extends DataTableRecord = DataTableRecord> {
  key: string
  header: string
  filterable?: boolean
  render?: (value: unknown, row: T) => React.ReactNode
  width?: string | number
}
interface DataTableProps<T extends DataTableRecord = DataTableRecord> {
  columns: DataTableColumn<T>[]
  data: T[]
  rowKey?: (row: T, index: number) => string | number
  className?: string
  style?: React.CSSProperties
  emptyMessage?: string
}
import { DataTable } from 'zenput'
import type { DataTableRecord, DataTableColumn } from 'zenput'
```

---

## 2. NumberInput onChange Adapter

**Decision**: Wrap zenput `NumberInput.onChange` at each call site so it remains
compatible with the existing `useProductForm` and `VariationFormModal` state setters,
which expect a plain `number`.

**Rationale**: zenput's `NumberInput` calls `onChange(value: number | undefined)` —
not a `React.ChangeEvent`. The existing hooks store `number` (not `undefined`).
A one-line coercion `(v) => setter(v ?? 0)` at the call site avoids modifying the
hook and keeps the change isolated to the component layer.

**Pattern**:

```tsx
<NumberInput
  value={formData.price}
  onChange={(v) => {
    setFormData({ ...formData, price: v ?? 0 })
    clearFieldError('price')
  }}
  ...
/>
```

**Alternatives considered**: Modifying `useProductForm` to accept `number | undefined`
— rejected because FR-028 prohibits modifying form submission logic.

---

## 3. SelectInput Options Adapter

**Decision**: Convert string arrays (category lists, variation types, style IDs) to
`SelectOption[]` inline at each call site, or as a stable `useMemo` constant when the
source is static.

**Rationale**: zenput `SelectInput` requires `options: SelectOption[]` instead of
`<option>` children. Existing category arrays and the `['styling', 'colour']` tuple
map cleanly with `.map(v => ({ value: v, label: v }))` or typed literals.

**Pattern for static options**:

```tsx
const VARIATION_TYPE_OPTIONS: SelectOption[] = [
  { value: 'styling', label: 'Styling' },
  { value: 'colour', label: 'Colour' },
]
```

**Pattern for dynamic options** (e.g., category list from props):

```tsx
const categoryOptions = useMemo(
  () => categoryList.map((c) => ({ value: c, label: c })),
  [categoryList]
)
```

---

## 4. FileInput and File-Cancel Preservation

**Decision**: Use zenput `FileInput` for the primary image field only. Preserve the
"cancel preserves previous selection" behaviour by keeping the `pendingFile` state
unchanged when the file input's `onChange` fires with an empty `FileList`.

**Rationale**: Edge case from spec — "if file selection is cancelled mid-flow, the
previously selected file state must be preserved (not cleared)." The native
`<input type="file">` reports an empty `FileList` on cancel in most browsers.
zenput `FileInput` passes through the standard `React.ChangeEvent<HTMLInputElement>`,
so the existing guard `if (e.target.files?.[0])` already handles this correctly.

**Pattern**:

```tsx
<FileInput
  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
  onChange={(e) => {
    const file = e.target.files?.[0]
    if (file) {          // only update state when a file was actually selected
      setPendingFile(file)
      clearFieldError('image')
    }
    // no-op on cancel — preserves existing pendingFile
  }}
  ...
/>
```

---

## 5. Tailwind CSS v4 + zenput Style Isolation

**Decision**: No global style overrides. Rely on zenput's built-in styles, optionally
pass `wrapperClassName` to add Tailwind spacing utilities (e.g., `mb-4`) where
vertical rhythm differs from the existing layout.

**Rationale**: zenput ships its own component-scoped styles (not Tailwind). Tailwind
v4 uses `@layer` and JIT compilation — it will not conflict with zenput's internal
styles unless zenput defines clashing global resets. Per project assumption A-004,
any isolation is handled at the component boundary. If visual regression is detected
during Playwright verification, `inputClassName` / `wrapperClassName` props provide
opt-in Tailwind overrides per-component without touching `globals.css`.

**Alternatives considered**: Wrapping zenput components in a `<div>` with Tailwind
isolation classes — rejected as unnecessary complexity (YAGNI) until a regression is
confirmed.

---

## 6. DataTable Row Mapping Strategy

**Decision**: Map product and order objects to plain `Record<string, unknown>` rows
inline in the page component, typed with a local interface that extends
`DataTableRecord`.

**Rationale**: zenput's `DataTableRecord = Record<string, any>`. Projecting only the
columns that the table needs (name, category, price, stock, actions for products;
id, customerName, status, totalAmount, createdAt, actions for orders) avoids exposing
the full entity shape to the table and keeps type assertions minimal.

**Pattern**:

```ts
interface ProductRow extends DataTableRecord {
  id: string
  name: string
  category: string
  price: string // formatted via formatPrice()
  stock: number
  _raw: Product // non-displayed; accessed in render() for action callbacks
}
```

The `actions` column uses a `render` callback that receives `_raw` and returns JSX
edit/delete buttons, keeping onClick handlers out of the row data shape.

**Alternatives considered**: Passing the raw `Product[]` / `AdminOrder[]` directly
as `data` — valid but couples the table to the full type; the mapping approach is
explicit about what the table presents.

---

## 7. validationState Helper

**Decision**: Derive `validationState` inline as a ternary at each field call site.

**Rationale**: The pattern `error ? 'error' : 'default'` is a two-liner and appears
in only two files (ProductFormModal, VariationFormModal). It does not reach the
three-file DRY threshold from Constitution Principle VIII. If a third modal is added
in future, extract to `lib/form-utils.ts`.

**Pattern**:

```tsx
<TextInput
  validationState={fieldErrors.name ? 'error' : 'default'}
  errorMessage={fieldErrors.name}
  ...
/>
```

---

## 8. Orders DataTable — AdminOrderCard Retention

**Decision**: Retain `AdminOrderCard` in the codebase and open it on "View" action
click (via state-controlled render or modal, matching the existing pattern).

**Rationale**: Spec clarification (Session 2026-04-05) and FR-027 / A-006 are
explicit: orders DataTable is read-only; `AdminOrderCard` is the editing surface.
The orders `page.tsx` currently renders `AdminOrderCard` components in a list; that
list is replaced by the `DataTable`, but the card itself is preserved and rendered
when the admin clicks "View" on a row.

**Implementation note**: The existing `orders/page.tsx` already maintains a
selected-order modal pattern (it currently uses `AdminOrderCard` inline). The "View"
action column's `render` callback sets `selectedOrder` state to open the card in a
`<Suspense>`-wrapped modal, matching the existing `showModal` pattern used on the
products page.

---

## 9. Accessibility Compliance

**Decision**: Rely on zenput's built-in accessibility attributes. Verify with Playwright
`@axe-core/playwright` (already installed as a dev dependency) that all interactive
zenput components are keyboard-navigable and correctly labelled.

**Rationale**: zenput is described as "a production-ready, accessible React TypeScript
input components library". Its `BaseInputProps` includes `label`, `required`, and
`errorMessage` which map to `<label>`, `aria-required`, and `aria-describedby`
internally. FR-029 and SC-007 require no regression in keyboard/screen-reader
accessibility. Playwright tests must include a basic axe scan on the modified pages.

---

## 10. Bundle Size Impact

**Decision**: Accept zenput@1.0.0 as a production dependency. Monitor with `next build`
output size report before and after.

**Rationale**: zenput adds ~131 transitive packages (confirmed via `npm install
--dry-run`). It is tree-shakeable (ESM `dist/esm/` entry). Only the components
actually imported (TextInput, TextArea, NumberInput, SelectInput, FileInput,
DataTable) will be bundled. All 4 modified files are already in the client-side admin
bundle; the incremental cost is concentrated in one code-split chunk. SC-006 caps the
TTI regression at 10%.

---

## Summary of Resolved Unknowns

| Unknown                        | Resolution                                                          |
| ------------------------------ | ------------------------------------------------------------------- |
| zenput API surface             | Fully typed; confirmed from `dist/index.d.ts`                       |
| NumberInput onChange signature | `(v: number \| undefined) => void` — use `v ?? 0` adapter           |
| SelectInput options format     | `SelectOption[]` (`{value, label}`) — inline mapping                |
| FileInput cancel behaviour     | Standard ChangeEvent — existing `if (file)` guard suffices          |
| Tailwind v4 style conflicts    | No conflicts expected; `wrapperClassName` available as escape hatch |
| DataTable row typing           | Local `interface XRow extends DataTableRecord` per page             |
| AdminOrderCard fate            | Retained; opened via "View" action state in orders page             |
| Bundle size                    | Acceptable; tree-shaken admin-only import                           |
| Accessibility                  | zenput built-in; verify with axe in Playwright                      |
