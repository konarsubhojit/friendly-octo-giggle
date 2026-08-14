import type { DataTableColumn } from 'zenput'

export interface FilterDefinition {
  readonly key: string
  readonly label: string
  readonly kind: 'select' | 'date-range' | 'text'
  readonly options?: ReadonlyArray<{
    readonly value: string
    readonly label: string
  }>
}

export interface RowAction<T extends Record<string, unknown>> {
  readonly key: string
  readonly label: string
  readonly onSelect: (row: T) => void
  readonly destructive?: boolean
}

export type BulkSelection =
  | { scope: 'loaded_page'; rowIds: ReadonlyArray<string | number> }
  | {
      scope: 'entire_filtered_result'
      filterSnapshot: Record<string, unknown>
    }

export interface BulkResult {
  readonly succeeded: ReadonlyArray<string | number>
  readonly failed: ReadonlyArray<{
    readonly rowId: string | number
    readonly reason: string
  }>
  readonly jobId?: string
}

export interface BulkAction {
  readonly key: string
  readonly label: string
  readonly onApply: (selection: BulkSelection) => Promise<BulkResult>
  readonly requiresTypedConfirmation?: boolean
}

export interface ResourceListDefinition<T extends Record<string, unknown>> {
  readonly resource: string
  readonly columns: ReadonlyArray<DataTableColumn<T>>
  readonly filters: ReadonlyArray<FilterDefinition>
  readonly searchable: boolean
  readonly sortOptions?: ReadonlyArray<{
    readonly field: string
    readonly label: string
  }>
  readonly rowActions: (row: T) => ReadonlyArray<RowAction<T>>
  readonly bulkActions: ReadonlyArray<BulkAction>
  readonly exportable: boolean
  readonly emptyMessage: string
  readonly filteredEmptyMessage: string
}
