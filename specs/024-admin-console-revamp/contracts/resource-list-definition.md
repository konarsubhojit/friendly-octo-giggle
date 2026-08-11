# Contract: Resource List Definition

Internal, in-repository contract between an admin resource screen and the
extended `AdminDataView` component. Not a network API. This is the mechanism
by which FR-A01/FR-A02/FR-A15/FR-A15a are satisfied: every list screen
supplies one of these, and `AdminDataView` alone is responsible for
rendering search, filters, sort, pagination, selection, bulk toolbar, and
the four list states from it.

## Shape

```ts
interface ResourceListDefinition<T extends Record<string, unknown>> {
  /** Stable resource key; matches AdminSavedView.resource and the entity
   *  string used in AdminAuditLog / the activity API. */
  resource: string

  /** zenput DataTable column definitions. */
  columns: DataTableColumn<T>[]

  /** Declarative filters available for this resource. Rendered as
   *  individually removable indicator chips once applied (FR-A04). */
  filters: ReadonlyArray<{
    key: string
    label: string
    kind: 'select' | 'date-range' | 'text'
    options?: ReadonlyArray<{ value: string; label: string }>
  }>

  /** Whether free-text search applies to this resource (FR-A03). */
  searchable: boolean

  /** Sortable columns, if any (FR-A05). */
  sortOptions?: ReadonlyArray<{ field: string; label: string }>

  /** Row-level actions, permission-filtered by the caller before being
   *  passed to AdminDataView — an action the viewer cannot perform MUST
   *  already be absent from this array (FR-A14). */
  rowActions: (row: T) => ReadonlyArray<{
    key: string
    label: string
    onSelect: (row: T) => void
    destructive?: boolean
  }>

  /** Bulk actions available for the current selection, already
   *  permission-filtered by the caller (FR-A09). Empty array renders no
   *  bulk toolbar. */
  bulkActions: ReadonlyArray<{
    key: string
    label: string
    onApply: (selection: BulkSelection) => Promise<BulkResult>
    requiresTypedConfirmation?: boolean // FR-C03
  }>

  /** Whether a CSV export control is shown (FR-A12). */
  exportable: boolean

  /** Distinct messaging for "no records at all" vs "no records match the
   *  current filters" (FR-A11). */
  emptyMessage: string
  filteredEmptyMessage: string
}

type BulkSelection =
  | { scope: 'loaded_page'; rowIds: ReadonlyArray<string | number> }
  | { scope: 'entire_filtered_result'; filterSnapshot: Record<string, unknown> }

interface BulkResult {
  succeeded: ReadonlyArray<string | number>
  failed: ReadonlyArray<{ rowId: string | number; reason: string }>
  /** Present only when the operation was executed as a tracked background
   *  job rather than completing synchronously (NFR-005). */
  jobId?: string
}
```

## Consumer obligations

- Every list screen named in FR-A15/FR-A15a (products, orders, users,
  reviews, coupons, categories, email-failures, returns, checkout-requests)
  MUST supply exactly one `ResourceListDefinition` and render exclusively
  through `AdminDataView` — no bespoke table, pagination, or filter markup
  alongside it (FR-A01).
- `rowActions` and `bulkActions` MUST be computed from the current viewer's
  permission set before being handed to `AdminDataView`; `AdminDataView`
  itself renders whatever it is given and performs no permission logic
  (keeps authorization server-authoritative per NFR-010 — the screen's
  server component already knows the viewer's permissions from
  `requireAdminPermission` and passes down only what's allowed).
- `BulkSelection.scope: 'entire_filtered_result'` MUST only be reachable
  through an explicit opt-in control per FR-A16; it must never be the
  default when "select all" is checked.

## Provider obligations (`AdminDataView`)

- Renders loading / empty / filtered-empty / failed(+retry) as four visually
  distinct states derived from the definition's messages and its own
  fetch-status prop (FR-A11).
- Reflects the current search/filter/sort/page combination into the URL via
  `useAdminListState` (FR-A07).
- Surfaces a "Save this view" affordance that calls the saved-views API
  (see `saved-views-api.md`) with the current `criteria`, and a picker that
  recalls a saved view by re-applying its stored `criteria` (FR-A17).
