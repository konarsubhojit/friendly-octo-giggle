import type { DataTableColumn } from 'zenput'
import type {
  ResourceListDefinition,
  RowAction,
} from '../components/resource-list-definition'
import type { AdminPermission } from '@/lib/constants/roles'

const RETURN_STATUSES = [
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'RECEIVED',
  'REFUNDED',
  'COMPLETED',
] as const

export interface ReturnRow extends Record<string, unknown> {
  id: string
  orderId: string
  customer: string
  status: string
  reason: string
  createdAt: string
}

const RETURN_COLUMNS: ReadonlyArray<DataTableColumn<ReturnRow>> = [
  { key: 'id', header: 'Return ID' },
  { key: 'orderId', header: 'Order ID' },
  { key: 'customer', header: 'Customer', sortable: true },
  { key: 'status', header: 'Status', filterable: true },
  { key: 'reason', header: 'Reason' },
  { key: 'createdAt', header: 'Requested', sortable: true, align: 'right' },
]

export function createReturnsDefinition(
  permissions: readonly AdminPermission[],
  handlers: {
    onApprove: (row: ReturnRow) => void
    onReject: (row: ReturnRow) => void
    onMarkReceived: (row: ReturnRow) => void
    onRefund: (row: ReturnRow) => void
    onMarkCompleted: (row: ReturnRow) => void
    onViewOrder: (row: ReturnRow) => void
  }
): ResourceListDefinition<ReturnRow> {
  const canManageReturns = permissions.includes('orders:returns')
  const canRefund = permissions.includes('orders:refund')

  return {
    resource: 'returns',
    columns: RETURN_COLUMNS,
    filters: [
      {
        key: 'status',
        label: 'Status',
        kind: 'select',
        options: RETURN_STATUSES.map((s) => ({
          value: s,
          label: s.charAt(0) + s.slice(1).toLowerCase(),
        })),
      },
    ],
    searchable: true,
    sortOptions: [
      { field: 'customer', label: 'Customer' },
      { field: 'createdAt', label: 'Requested' },
    ],
    rowActions: (row: ReturnRow): ReadonlyArray<RowAction<ReturnRow>> => {
      const actions: RowAction<ReturnRow>[] = [
        {
          key: 'view_order',
          label: 'View order',
          onSelect: handlers.onViewOrder,
        },
      ]
      if (!canManageReturns) return actions

      if (row.status === 'REQUESTED') {
        actions.push(
          { key: 'approve', label: 'Approve', onSelect: handlers.onApprove },
          {
            key: 'reject',
            label: 'Reject',
            onSelect: handlers.onReject,
            destructive: true,
          }
        )
      }
      if (row.status === 'APPROVED') {
        actions.push({
          key: 'mark_received',
          label: 'Mark received',
          onSelect: handlers.onMarkReceived,
        })
      }
      if (row.status === 'RECEIVED' && canRefund) {
        actions.push({
          key: 'refund',
          label: 'Issue refund',
          onSelect: handlers.onRefund,
          destructive: true,
        })
      }
      if (row.status === 'REFUNDED') {
        actions.push({
          key: 'mark_completed',
          label: 'Mark completed',
          onSelect: handlers.onMarkCompleted,
        })
      }
      return actions
    },
    bulkActions: [],
    exportable: true,
    emptyMessage: 'No returns found.',
    filteredEmptyMessage: 'No returns match the current filters.',
  }
}
