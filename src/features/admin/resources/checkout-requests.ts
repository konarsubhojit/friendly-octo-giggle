import type { DataTableColumn } from 'zenput'
import type {
  ResourceListDefinition,
  RowAction,
} from '../components/resource-list-definition'
import type { AdminPermission } from '@/lib/constants/roles'

export interface CheckoutRequestRow extends Record<string, unknown> {
  id: string
  customer: string
  status: string
  itemCount: string
  orderId: string
  error: string
  createdAt: string
}

const CHECKOUT_REQUEST_COLUMNS: ReadonlyArray<
  DataTableColumn<CheckoutRequestRow>
> = [
  { key: 'id', header: 'Request ID' },
  { key: 'customer', header: 'Customer', sortable: true },
  { key: 'status', header: 'Status', filterable: true },
  { key: 'itemCount', header: 'Items', align: 'right' },
  { key: 'orderId', header: 'Order' },
  { key: 'createdAt', header: 'Created', sortable: true, align: 'right' },
]

export function createCheckoutRequestsDefinition(
  _permissions: readonly AdminPermission[],
  handlers: {
    onReleaseReservation: (row: CheckoutRequestRow) => void
    onViewOrder: (row: CheckoutRequestRow) => void
  }
): ResourceListDefinition<CheckoutRequestRow> {
  return {
    resource: 'checkout-requests',
    columns: CHECKOUT_REQUEST_COLUMNS,
    filters: [
      {
        key: 'status',
        label: 'Status',
        kind: 'select',
        options: [
          { value: 'PENDING', label: 'Pending' },
          { value: 'PROCESSING', label: 'Processing' },
          { value: 'FAILED', label: 'Failed' },
          { value: 'COMPLETED', label: 'Completed' },
        ],
      },
    ],
    searchable: true,
    sortOptions: [
      { field: 'customer', label: 'Customer' },
      { field: 'createdAt', label: 'Created' },
    ],
    rowActions: (
      row: CheckoutRequestRow
    ): ReadonlyArray<RowAction<CheckoutRequestRow>> => {
      const actions: RowAction<CheckoutRequestRow>[] = []
      if (row.orderId) {
        actions.push({
          key: 'view_order',
          label: 'View order',
          onSelect: handlers.onViewOrder,
        })
      }
      if (row.status === 'PENDING' || row.status === 'PROCESSING') {
        actions.push({
          key: 'release_reservation',
          label: 'Release reservation',
          onSelect: handlers.onReleaseReservation,
          destructive: true,
        })
      }
      return actions
    },
    bulkActions: [],
    exportable: false,
    emptyMessage: 'No checkout requests found.',
    filteredEmptyMessage: 'No checkout requests match the current filters.',
  }
}
