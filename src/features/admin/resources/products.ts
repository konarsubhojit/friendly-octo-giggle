import type { DataTableColumn } from 'zenput'
import type {
  ResourceListDefinition,
  BulkAction,
  RowAction,
  BulkSelection,
  BulkResult,
} from '../components/resource-list-definition'
import type { AdminPermission } from '@/lib/constants/roles'

export interface ProductRow extends Record<string, unknown> {
  id: string
  name: string
  category: string
  price: string
  stock: number
}

const PRODUCT_COLUMNS: ReadonlyArray<DataTableColumn<ProductRow>> = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'category', header: 'Category', sortable: true },
  { key: 'price', header: 'Price', sortable: true, align: 'right' },
  {
    key: 'stock',
    header: 'Stock',
    filterable: true,
    sortable: true,
    align: 'right',
  },
]

export function createProductsDefinition(
  permissions: readonly AdminPermission[],
  handlers: {
    onEdit: (row: ProductRow) => void
    onViewDetail: (row: ProductRow) => void
    onDelete: (row: ProductRow) => void
    onBulkDelete: (sel: BulkSelection) => Promise<BulkResult>
  }
): ResourceListDefinition<ProductRow> {
  const canWrite = permissions.includes('products:write')

  const bulkActions: BulkAction[] = []
  if (canWrite) {
    bulkActions.push({
      key: 'delete',
      label: 'Delete',
      onApply: handlers.onBulkDelete,
      requiresTypedConfirmation: true,
    })
  }

  return {
    resource: 'products',
    columns: PRODUCT_COLUMNS,
    filters: [],
    searchable: true,
    sortOptions: [
      { field: 'name', label: 'Name' },
      { field: 'category', label: 'Category' },
      { field: 'price', label: 'Price' },
      { field: 'stock', label: 'Stock' },
    ],
    rowActions: (_row: ProductRow): ReadonlyArray<RowAction<ProductRow>> => {
      const actions: RowAction<ProductRow>[] = [
        {
          key: 'view',
          label: 'View details',
          onSelect: handlers.onViewDetail,
        },
      ]
      if (canWrite) {
        actions.push({
          key: 'edit',
          label: 'Edit',
          onSelect: handlers.onEdit,
        })
        actions.push({
          key: 'delete',
          label: 'Delete',
          onSelect: handlers.onDelete,
          destructive: true,
        })
      }
      return actions
    },
    bulkActions,
    exportable: true,
    emptyMessage: 'No products yet.',
    filteredEmptyMessage: 'No products match the current filters.',
  }
}
