import type { DataTableColumn } from 'zenput'
import type {
  ResourceListDefinition,
  BulkAction,
  BulkSelection,
  BulkResult,
  RowAction,
} from '../components/resource-list-definition'
import type { AdminPermission } from '@/lib/constants/roles'
import { OrderStatus } from '@/lib/types'

export interface OrderRow extends Record<string, unknown> {
  id: string
  customer: string
  status: string
  total: string
  date: string
}

const ORDER_COLUMNS: ReadonlyArray<DataTableColumn<OrderRow>> = [
  { key: 'id', header: 'Order ID' },
  { key: 'customer', header: 'Customer', sortable: true },
  { key: 'status', header: 'Status', filterable: true },
  { key: 'total', header: 'Total', sortable: true, align: 'right' },
  { key: 'date', header: 'Date', sortable: true, align: 'right' },
]

const ORDER_STATUS_OPTIONS = Object.values(OrderStatus).map((s) => ({
  value: s,
  label: s.charAt(0) + s.slice(1).toLowerCase(),
}))

export function createOrdersDefinition(
  permissions: readonly AdminPermission[],
  handlers: {
    onMarkShipped: (sel: BulkSelection) => Promise<BulkResult>
    onBulkCancel: (sel: BulkSelection) => Promise<BulkResult>
    onRefund: (row: OrderRow) => void
    onViewDetail: (row: OrderRow) => void
    onUpdateStatus: (row: OrderRow) => void
  }
): ResourceListDefinition<OrderRow> {
  const canUpdate = permissions.includes('orders:update')
  const canRefund = permissions.includes('orders:refund')

  const bulkActions: BulkAction[] = []
  if (canUpdate) {
    bulkActions.push({
      key: 'mark_shipped',
      label: 'Mark as shipped',
      onApply: handlers.onMarkShipped,
    })
    bulkActions.push({
      key: 'cancel',
      label: 'Cancel',
      onApply: handlers.onBulkCancel,
      requiresTypedConfirmation: true,
    })
  }

  return {
    resource: 'orders',
    columns: ORDER_COLUMNS,
    filters: [
      {
        key: 'status',
        label: 'Status',
        kind: 'select',
        options: ORDER_STATUS_OPTIONS,
      },
      {
        key: 'dateRange',
        label: 'Date range',
        kind: 'date-range',
      },
    ],
    searchable: true,
    sortOptions: [
      { field: 'customer', label: 'Customer' },
      { field: 'total', label: 'Total' },
      { field: 'date', label: 'Date' },
    ],
    rowActions: (_row: OrderRow): ReadonlyArray<RowAction<OrderRow>> => {
      const actions: RowAction<OrderRow>[] = [
        { key: 'view', label: 'View details', onSelect: handlers.onViewDetail },
      ]
      if (canUpdate) {
        actions.push({
          key: 'update_status',
          label: 'Update status',
          onSelect: handlers.onUpdateStatus,
        })
      }
      if (canRefund) {
        actions.push({
          key: 'refund',
          label: 'Issue refund',
          onSelect: handlers.onRefund,
          destructive: true,
        })
      }
      return actions
    },
    bulkActions,
    exportable: true,
    emptyMessage: 'No orders yet.',
    filteredEmptyMessage: 'No orders match the current filters.',
  }
}
