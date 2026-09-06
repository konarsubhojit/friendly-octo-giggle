import type { DataTableColumn } from 'zenput'
import type {
  ResourceListDefinition,
  BulkAction,
  RowAction,
  BulkSelection,
  BulkResult,
} from '../components/resource-list-definition'
import type { AdminPermission } from '@/lib/constants/roles'

export interface ReviewRow extends Record<string, unknown> {
  id: string
  product: string
  reviewer: string
  rating: string
  comment: string
  status: string
  createdAt: string
}

const REVIEW_COLUMNS: ReadonlyArray<DataTableColumn<ReviewRow>> = [
  { key: 'product', header: 'Product' },
  { key: 'reviewer', header: 'Reviewer' },
  { key: 'rating', header: 'Rating', sortable: true, align: 'center' },
  { key: 'status', header: 'Status', filterable: true },
  { key: 'createdAt', header: 'Date', sortable: true, align: 'right' },
]

export function createReviewsDefinition(
  permissions: readonly AdminPermission[],
  handlers: {
    onFeature: (row: ReviewRow) => void
    onHide: (row: ReviewRow) => void
    onRemove: (row: ReviewRow) => void
    onBulkRemove: (sel: BulkSelection) => Promise<BulkResult>
  }
): ResourceListDefinition<ReviewRow> {
  const canModerate = permissions.includes('reviews:moderate')

  const bulkActions: BulkAction[] = []
  if (canModerate) {
    bulkActions.push({
      key: 'remove',
      label: 'Remove',
      onApply: handlers.onBulkRemove,
      requiresTypedConfirmation: true,
    })
  }

  return {
    resource: 'reviews',
    columns: REVIEW_COLUMNS,
    filters: [
      {
        key: 'rating',
        label: 'Rating',
        kind: 'select',
        options: [
          { value: '1', label: '1 star' },
          { value: '2', label: '2 stars' },
          { value: '3', label: '3 stars' },
          { value: '4', label: '4 stars' },
          { value: '5', label: '5 stars' },
        ],
      },
      {
        key: 'hidden',
        label: 'Visibility',
        kind: 'select',
        options: [
          { value: 'visible', label: 'Visible' },
          { value: 'hidden', label: 'Hidden' },
        ],
      },
    ],
    searchable: true,
    sortOptions: [
      { field: 'rating', label: 'Rating' },
      { field: 'createdAt', label: 'Date' },
    ],
    rowActions: (_row: ReviewRow): ReadonlyArray<RowAction<ReviewRow>> => {
      if (!canModerate) return []
      return [
        {
          key: 'feature',
          label: 'Feature / Unfeature',
          onSelect: handlers.onFeature,
        },
        { key: 'hide', label: 'Hide / Unhide', onSelect: handlers.onHide },
        {
          key: 'remove',
          label: 'Remove',
          onSelect: handlers.onRemove,
          destructive: true,
        },
      ]
    },
    bulkActions,
    exportable: true,
    emptyMessage: 'No reviews yet.',
    filteredEmptyMessage: 'No reviews match the current filters.',
  }
}
