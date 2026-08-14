import type { DataTableColumn } from 'zenput'
import type {
  ResourceListDefinition,
  RowAction,
} from '../components/resource-list-definition'
import type { AdminPermission } from '@/lib/constants/roles'

export interface EmailFailureRow extends Record<string, unknown> {
  id: string
  recipient: string
  subject: string
  emailType: string
  attempts: string
  status: string
  lastError: string
  createdAt: string
}

const EMAIL_FAILURE_COLUMNS: ReadonlyArray<DataTableColumn<EmailFailureRow>> = [
  { key: 'recipient', header: 'Recipient', sortable: true },
  { key: 'subject', header: 'Subject' },
  { key: 'emailType', header: 'Type', filterable: true },
  { key: 'attempts', header: 'Attempts', align: 'right' },
  { key: 'status', header: 'Status', filterable: true },
  { key: 'createdAt', header: 'Date', sortable: true, align: 'right' },
]

export function createEmailFailuresDefinition(
  _permissions: readonly AdminPermission[],
  handlers: {
    onRetry: (row: EmailFailureRow) => void
  }
): ResourceListDefinition<EmailFailureRow> {
  return {
    resource: 'email-failures',
    columns: EMAIL_FAILURE_COLUMNS,
    filters: [
      {
        key: 'status',
        label: 'Status',
        kind: 'select',
        options: [
          { value: 'pending', label: 'Pending' },
          { value: 'failed', label: 'Failed' },
        ],
      },
    ],
    searchable: true,
    sortOptions: [
      { field: 'recipient', label: 'Recipient' },
      { field: 'createdAt', label: 'Date' },
    ],
    rowActions: (
      row: EmailFailureRow
    ): ReadonlyArray<RowAction<EmailFailureRow>> => {
      if (row.status === 'sent') return []
      return [
        {
          key: 'retry',
          label: 'Retry delivery',
          onSelect: handlers.onRetry,
        },
      ]
    },
    bulkActions: [],
    exportable: false,
    emptyMessage: 'No failed emails.',
    filteredEmptyMessage: 'No failed emails match the current filters.',
  }
}
