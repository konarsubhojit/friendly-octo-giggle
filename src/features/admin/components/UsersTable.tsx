'use client'

import { Badge, type DataTableColumn } from 'zenput'
import { AdminDataView } from '@/features/admin/components/AdminDataView'
import { RoleAction } from '@/features/admin/components/RoleAction'
import { RoleBadge } from '@/features/admin/components/RoleBadge'
import { UserAvatar } from '@/features/admin/components/UserAvatar'

interface AdminUser {
  readonly id: string
  readonly name: string | null
  readonly email: string
  readonly image: string | null
  readonly role: string
  readonly orderCount?: number
  readonly createdAt: string
}

interface UsersTableProps {
  readonly users: readonly AdminUser[]
  readonly updatingUserId: string | null
  readonly onRoleChange: (userId: string, newRole: 'ADMIN' | 'CUSTOMER') => void
}

type UserDataRow = AdminUser & { [key: string]: unknown }

export function UsersTable({
  users,
  updatingUserId,
  onRoleChange,
}: UsersTableProps) {
  const rows: UserDataRow[] = users.map((user) => ({ ...user }))
  const columns: DataTableColumn<UserDataRow>[] = [
    {
      key: 'name',
      header: 'User',
      render: (_value, user) => (
        <div className="flex items-center gap-3">
          <UserAvatar name={user.name} email={user.email} image={user.image} />
          <span className="font-medium">{user.name || 'No name'}</span>
        </div>
      ),
    },
    { key: 'email', header: 'Email' },
    {
      key: 'role',
      header: 'Role',
      render: (_value, user) => <RoleBadge role={user.role} />,
    },
    { key: 'orderCount', header: 'Orders', align: 'right' },
    {
      key: 'createdAt',
      header: 'Joined',
      render: (_value, user) => new Date(user.createdAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: 'Actions',
      sticky: 'right',
      render: (_value, user) => (
        <RoleAction
          user={user}
          isUpdating={updatingUserId === user.id}
          onRoleChange={onRoleChange}
        />
      ),
    },
  ]

  return (
    <AdminDataView
      ariaLabel="Users"
      columns={columns}
      data={rows}
      rowKey={(user) => user.id}
      renderMobileCard={(user) => (
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <UserAvatar
              name={user.name}
              email={user.email}
              image={user.image}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-950 dark:text-slate-50">
                {user.name || 'No name'}
              </p>
              <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">
                {user.email}
              </p>
            </div>
            <Badge
              tone={user.role === 'ADMIN' ? 'warning' : 'neutral'}
              size="sm"
            >
              {user.role}
            </Badge>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 text-sm dark:border-slate-700">
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">
                Orders
              </dt>
              <dd className="mt-1 font-semibold text-slate-950 dark:text-slate-50">
                {user.orderCount ?? 0}
              </dd>
            </div>
            <div className="text-right">
              <dt className="text-xs text-slate-500 dark:text-slate-400">
                Joined
              </dt>
              <dd className="mt-1 text-slate-700 dark:text-slate-200">
                {new Date(user.createdAt).toLocaleDateString()}
              </dd>
            </div>
          </dl>
          <div className="mt-3 flex justify-end">
            <RoleAction
              user={user}
              isUpdating={updatingUserId === user.id}
              onRoleChange={onRoleChange}
            />
          </div>
        </div>
      )}
    />
  )
}
