import type { DataTableColumn } from 'zenput'
import type {
  ResourceListDefinition,
  BulkAction,
  RowAction,
  BulkSelection,
  BulkResult,
} from '../components/resource-list-definition'
import type { AdminPermission } from '@/lib/constants/roles'

export interface UserRow extends Record<string, unknown> {
  id: string
  name: string
  email: string
  role: string
  orderCount: string
  createdAt: string
}

const USER_COLUMNS: ReadonlyArray<DataTableColumn<UserRow>> = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'email', header: 'Email', sortable: true },
  { key: 'role', header: 'Role', filterable: true },
  { key: 'orderCount', header: 'Orders', align: 'right' },
  { key: 'createdAt', header: 'Joined', sortable: true, align: 'right' },
]

export function createUsersDefinition(
  permissions: readonly AdminPermission[],
  handlers: {
    onViewDetail: (row: UserRow) => void
    onChangeRole: (row: UserRow) => void
    onBulkDelete: (sel: BulkSelection) => Promise<BulkResult>
  }
): ResourceListDefinition<UserRow> {
  const canManage = permissions.includes('users:manage')

  const bulkActions: BulkAction[] = []
  if (canManage) {
    bulkActions.push({
      key: 'delete',
      label: 'Delete',
      onApply: handlers.onBulkDelete,
      requiresTypedConfirmation: true,
    })
  }

  return {
    resource: 'users',
    columns: USER_COLUMNS,
    filters: [
      {
        key: 'role',
        label: 'Role',
        kind: 'select',
        options: [
          { value: 'ADMIN', label: 'Admin' },
          { value: 'SUPPORT', label: 'Support' },
          { value: 'FULFILMENT', label: 'Fulfilment' },
          { value: 'CUSTOMER', label: 'Customer' },
        ],
      },
    ],
    searchable: true,
    sortOptions: [
      { field: 'name', label: 'Name' },
      { field: 'email', label: 'Email' },
      { field: 'createdAt', label: 'Joined' },
    ],
    rowActions: (_row: UserRow): ReadonlyArray<RowAction<UserRow>> => {
      const actions: RowAction<UserRow>[] = [
        { key: 'view', label: 'View details', onSelect: handlers.onViewDetail },
      ]
      if (canManage) {
        actions.push({
          key: 'change_role',
          label: 'Change role',
          onSelect: handlers.onChangeRole,
        })
      }
      return actions
    },
    bulkActions,
    exportable: true,
    emptyMessage: 'No users found.',
    filteredEmptyMessage: 'No users match the current filters.',
  }
}
