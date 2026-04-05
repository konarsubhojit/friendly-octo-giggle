# UX Gaps: What zenput@1 Lacks for the Admin Section

_Authored as part of spec 004-zenput-admin-integration. Captures missing features in
zenput@1.0.0 that would have materially improved the admin UX if they were available.
Each gap references the affected admin screen and describes an ideal alternative._

---

## 1. FileInput — No Image Preview

**Affected**: Product form (primary image), Variation form (primary image)

**The gap**: `FileInput` exposes `showFileNames` (shows the selected filename as text)
and `dropzone` (drag-and-drop zone), but provides **no thumbnail preview of the
selected or currently-saved image**. After picking a file the admin has no visual
confirmation of which image they chose.

**What we want**: An `ImagePreview` prop or a `previewSrc` prop that renders a
thumbnail of the current image (when editing) and updates to a live `object-url`
preview as soon as a new file is picked — without leaving the form. This is the
standard pattern in Cloudinary Upload Widget, Mantine's Dropzone, and Filepond.

**Current workaround**: We retain the `<Image>` thumbnail block from Next.js
alongside the zenput `FileInput`, adding manual JavaScript to create an object-URL
preview on change. This is extra glue code that a proper component would absorb.

---

## 2. FileInput — No Multi-Image Manager

**Affected**: Product form (additional images), Variation form (additional images)

**The gap**: `FileInput` manages a single upload interaction. There is no
`MultiFileInput`, `ImageGalleryInput`, or similar component that renders a
list of upload slots with individual previews and per-slot remove buttons.

**What we want**: A compound component that:

- Renders _N_ image slots (add / remove dynamically)
- Shows a thumbnail per slot (existing URL or local preview)
- Reports the full resolved list via `onChange`

**Current workaround**: The custom `AdditionalImageRow` component is kept
entirely out of scope because there is no zenput equivalent. This means the
product and variation forms use two different styling systems side-by-side
(zenput fields + hand-rolled image slots), creating visual inconsistency.

---

## 3. No Compound Currency+Price Input

**Affected**: Product form (price), Variation form (price)

**The gap**: There is no `CurrencyInput` or `MoneyInput` compound component that
pairs a currency-selector with a numeric amount inside a single cohesive widget.
`NumberInput` and `SelectInput` are two separate components that must be placed
inside a `<div className="flex gap-2">` wrapper to approximate the look of a
single field.

**What we want**: A single `MoneyInput` component that:

- Renders a leading currency selector (SelectInput) fused visually to the numeric field
- Exposes `currency`, `onCurrencyChange`, `value`, `onChange` as a unified API
- Shares one `label` and one `errorMessage` across both sub-inputs
- Has a `currencies` prop accepting `{ code, symbol, label }[]`

**Current workaround**: Two separate zenput components are laid out in a flex row.
The `label` and `errorMessage` belong to the wrapper `<div>`, not to either zenput
component, so screen readers see two unlabelled inputs unless we wire `aria-label`
manually.

---

## 4. DataTable — No Built-in Pagination

**Affected**: Products list page, Orders list page

**The gap**: `DataTableProps` has no `pagination` configuration. There is no
`currentPage`, `pageSize`, `totalCount`, or `onPageChange` API. The component
renders all rows passed to it with no pagination controls.

**What we want**: A `pagination` prop accepting:

```ts
{
  currentPage: number
  pageSize: number
  totalCount: number
  onPageChange: (page: number) => void
}
```

This is the standard pattern in Tanstack Table, AG Grid, and Ant Design Table.

**Current workaround**: The existing `CursorPaginationBar` component is rendered
below the `DataTable` as a sibling element. This works but the pagination controls
are visually detached from the table.

---

## 5. DataTable — No Sortable Columns

**Affected**: Products list page, Orders list page

**The gap**: `DataTableColumn` has no `sortable` or `onSort` prop. Clicking a column
header does nothing. Admins cannot re-sort products by stock level or orders by date
without a server-side fetch.

**What we want**: A `sortable?: boolean` flag per column and a table-level
`onSort?: (key: string, direction: 'asc' | 'desc') => void` callback so the admin
can sort client-side (or trigger a re-fetch server-side for large datasets).

**Current workaround**: Not possible within the current zenput API. Sort is omitted
entirely from the DataTable integration.

---

## 6. DataTable — No Row-Level Loading / Skeleton State

**Affected**: Products list page, Orders list page

**The gap**: `DataTableProps` has no `loading` or `skeleton` prop. During data
fetches the entire table disappears and is replaced by the `<LoadingSpinner>` wrapper
we supply outside the component, causing layout shift.

**What we want**: A `loading?: boolean` prop that renders shimmer skeleton rows in
place of real data while the fetch is in progress, keeping the table chrome (headers,
pagination chrome) stable.

**Current workaround**: `LoadingSpinner` is conditionally rendered above the
DataTable. When data arrives the spinner is replaced by the table, causing a visible
layout jump.

---

## 7. DataTable — No Row Click / Expandable Rows

**Affected**: Orders list page (primary impact)

**The gap**: `DataTableProps` has no `onRowClick` handler and no expandable-row
pattern. Clicking a row does nothing by default. There is no way to expand a row
inline to reveal the `AdminOrderCard` editing controls.

**What we want**: An `onRowClick?: (row: T) => void` prop and/or an
`expandedRowRender?: (row: T) => React.ReactNode` prop for in-place row expansion.
This would allow an admin to click an order row and see the status/shipping editor
without leaving the page or navigating to a separate route.

**Current workaround**: A "View" action button is added in a dedicated column. It
opens a state-driven overlay/panel rendering `AdminOrderCard`. This requires more
client state (selected order, panel-open boolean) and is a less fluid UX than
click-to-expand.

---

## 8. DataTable — No Bulk Selection / Bulk Actions

**Affected**: Products list page (potential future need)

**The gap**: `DataTableProps` has no `selectable`, `selectedRows`, or
`onSelectionChange` prop. There are no row checkboxes or "select all" controls. Bulk
delete, bulk category re-assignment, and bulk status changes are not possible through
the DataTable.

**What we want**: A `selectable?: boolean` prop that adds a leading checkbox column,
plus `selectedRows` / `onSelectionChange` for controlled selection and a
`bulkActions` render slot for contextual bulk-action buttons.

**Current workaround**: Not applicable for the current feature scope, but any future
bulk-operation requirement will need a custom overlay on top of the zenput DataTable
or a different table library.

---

## 9. SelectInput — No Multi-Select Mode

**Affected**: Orders list page (status filter), potential category filter

**The gap**: `SelectInputProps` extends `React.SelectHTMLAttributes<HTMLSelectElement>`
but the component UI is a single-value select. There is no `multiple` mode with a
chip/tag display for selecting several values at once (e.g. "show PENDING and
PROCESSING orders").

**What we want**: A `MultiSelectInput` or `SelectInput` with a `multiple` prop that
renders selected values as dismissible chips inside the input, with a dropdown for
adding more. Standard in Mantine's MultiSelect, Chakra UI's Select, and
React-Select.

**Current workaround**: The status filter in the Orders page uses a row of toggle
buttons (`<button aria-pressed>`) outside the DataTable — a functional pattern but
visually inconsistent with the zenput SelectInput used in forms.

---

## 10. TextArea — No Rich-Text / Markdown Editor

**Affected**: Product description field

**The gap**: `TextArea` is a plain multi-line text input. There is no `RichTextArea`,
`MarkdownInput`, or WYSIWYG editor component. Product descriptions that would benefit
from bold/italic, bullet lists, or embedded links cannot be authored with formatting
through the current zenput surface.

**What we want**: A `TextEditor` component wrapping a WYSIWYG engine (Tiptap,
ProseMirror, or Slate) that emits markdown or HTML, consistent with the rest of the
zenput theming API.

**Current workaround**: A plain `TextArea` with `autoResize` and `showCharCount` is
used. Admins must write raw text with no formatting.

---

## 11. FileInput — No Upload Progress Indicator

**Affected**: Product form (primary image), Variation form (primary image)

**The gap**: `FileInputProps` has no `uploading`, `uploadProgress`, or async
lifecycle props. Once a file is selected and the form is submitted, the upload to
Vercel Blob happens asynchronously but the `FileInput` component cannot reflect that
state.

**What we want**: An `uploadProgress?: number` (0–100) prop and an
`uploading?: boolean` prop so the component can render a progress bar or spinner
inside the field boundary while the file is being transferred.

**Current workaround**: The parent form disables the submit button and shows a
spinner next to it during upload. The `FileInput` itself gives no feedback, so the
admin cannot tell if it was the image upload or the metadata save that is pending.

---

## 12. NumberInput — No Currency Formatting / Locale Awareness

**Affected**: Product price field, Variation price field

**The gap**: `NumberInput` renders and accepts raw floating-point numbers. It has no
`locale`, `currencyCode`, or `formatValue` prop. Prices display as plain numbers
(`1234.5`) rather than locale-formatted amounts (`₹1,234.50` or `$1,234.50`).

**What we want**: A `formatValue?: (value: number) => string` prop (similar to
`RangeInput.formatValue`) so the displayed value can be formatted as a currency
string while the underlying model value remains a raw number.

**Current workaround**: `NumberInput` renders the raw number. Currency formatting is
only applied when displaying the price in the table/list view through the
`useCurrency()` hook, not inside the input itself.

---

## Summary Table

| #   | Gap                                        | Severity | Affected Components                  |
| --- | ------------------------------------------ | -------- | ------------------------------------ |
| 1   | FileInput — no image preview               | High     | ProductFormModal, VariationFormModal |
| 2   | FileInput — no multi-image manager         | High     | ProductFormModal, VariationFormModal |
| 3   | No compound currency+price input           | Medium   | ProductFormModal, VariationFormModal |
| 4   | DataTable — no built-in pagination         | High     | Products page, Orders page           |
| 5   | DataTable — no sortable columns            | Medium   | Products page, Orders page           |
| 6   | DataTable — no loading/skeleton state      | Medium   | Products page, Orders page           |
| 7   | DataTable — no row click / expandable rows | Medium   | Orders page                          |
| 8   | DataTable — no bulk selection              | Low      | Products page (future)               |
| 9   | SelectInput — no multi-select mode         | Medium   | Orders page (status filter)          |
| 10  | TextArea — no rich-text / markdown editor  | Low      | ProductFormModal                     |
| 11  | FileInput — no upload progress indicator   | Medium   | ProductFormModal, VariationFormModal |
| 12  | NumberInput — no currency formatting       | Low      | ProductFormModal, VariationFormModal |
