'use client'

import { useMemo, useState } from 'react'
import { useDispatch } from 'react-redux'
import { updateAdminUserRole } from '@/features/admin/store/adminSlice'
import type { AdminDispatch } from '@/lib/store'
import { logError } from '@/lib/logger'
import { AlertBanner } from '@/components/ui/AlertBanner'
import {
  AdminPageShell,
  AdminPanel,
} from '@/features/admin/components/AdminPageShell'
import { AdminDataView } from '@/features/admin/components/AdminDataView'
import { EntityActivitySection } from '@/features/admin/components/EntityActivitySection'
import { RoleAction } from '@/features/admin/components/RoleAction'
import { RoleBadge } from '@/features/admin/components/RoleBadge'
import { UserAvatar } from '@/features/admin/components/UserAvatar'
import { AdminSearchForm } from '@/features/admin/components/AdminSearchForm'
import { useCursorPagination } from '@/hooks/useCursorPagination'
import { isStaffRole, type UserRole } from '@/lib/constants/roles'
import {
  createUsersDefinition,
  type UserRow as UserDefinitionRow,
} from '@/features/admin/resources/users'
import type {
  BulkResult,
  BulkSelection,
} from '@/features/admin/components/resource-list-definition'
import type { AdminPermission } from '@/lib/constants/roles'
import type { DataTableColumn } from 'zenput'

const PAGE_SIZE = 10

interface AdminUser {
  readonly id: string
  readonly name: string | null
  readonly email: string
  readonly image: string | null
  readonly role: string
  readonly orderCount?: number
  readonly createdAt: string
  readonly _count?: { orders: number }
}

const normalizeUser = (user: AdminUser): AdminUser => ({
  ...user,
  orderCount: user._count?.orders ?? user.orderCount ?? 0,
})

type UserRow = UserDefinitionRow

interface UsersManagementClientProps {
  readonly permissions: readonly AdminPermission[]
}

export default function UsersManagementClient({
  permissions,
}: UsersManagementClientProps) {
  const dispatch = useDispatch<AdminDispatch>()
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)

  const {
    items: users,
    loading,
    error,
    search,
    searchInput,
    currentPage,
    totalCount,
    setSearchInput,
    handleSearch,
    handlePageSelect,
    handleRefresh,
  } = useCursorPagination<AdminUser>({
    url: '/api/admin/users',
    pageSize: PAGE_SIZE,
    dataKey: 'users',
    transform: normalizeUser,
  })

  const canManage = permissions.includes('users:manage')

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdatingUserId(userId)
    try {
      await dispatch(
        updateAdminUserRole({ id: userId, role: newRole })
      ).unwrap()
      handleRefresh()
    } catch (err) {
      logError({ error: err, context: 'handleRoleChange' })
    } finally {
      setUpdatingUserId(null)
    }
  }

  // Bulk deletion has no backing API route yet for admin users — report a
  // clear per-row failure rather than a silent no-op or a network error, so
  // the resource definition can still declare the action (gated on
  // `users:manage`) without a broken/misleading success state.
  const applyBulkDelete = useMemo(
    () =>
      async (selection: BulkSelection): Promise<BulkResult> => {
        const rowIds = selection.scope === 'loaded_page' ? selection.rowIds : []
        return {
          succeeded: [],
          failed: rowIds.map((rowId) => ({
            rowId,
            reason: 'Bulk user deletion is not supported yet.',
          })),
        }
      },
    []
  )

  const usersDefinition = useMemo(
    () =>
      createUsersDefinition(permissions, {
        // View detail and change-role affordances render inline via the
        // appended "actions" column below (row actions aren't rendered by
        // AdminDataView yet — only columns and bulk actions are consumed
        // today). `handleRoleChange` is the single source of truth for the
        // role-change mutation, shared between this definition and the
        // inline `RoleAction` control. See
        // specs/024-admin-console-revamp/tasks.md for tracked follow-up.
        onViewDetail: () => {},
        onChangeRole: () => {},
        onBulkDelete: applyBulkDelete,
      }),
    [permissions, applyBulkDelete]
  )

  const userColumns: DataTableColumn<UserRow>[] = [
    ...usersDefinition.columns,
    {
      key: 'actions',
      header: 'Actions',
      sticky: 'right',
      render: (_value, row) => {
        const user = users.find((candidate) => candidate.id === row.id)
        if (!user || !canManage) return null
        return (
          <RoleAction
            user={user}
            isUpdating={updatingUserId === user.id}
            onRoleChange={handleRoleChange}
          />
        )
      },
    },
  ]

  const userRows: UserRow[] = users.map((user) => ({
    id: user.id,
    name: user.name || 'No name',
    email: user.email,
    role: user.role,
    orderCount: String(user.orderCount ?? 0),
    createdAt: new Date(user.createdAt).toLocaleDateString('en-GB'),
  }))

  const usersListContent = (
    <AdminDataView
      ariaLabel="Users"
      definition={{ ...usersDefinition, columns: userColumns }}
      data={userRows}
      rowKey={(row) => row.id}
      loading={loading}
      skeletonRowCount={PAGE_SIZE}
      emptyMessage={search ? 'No users match your search.' : 'No users found.'}
      pagination={{
        currentPage,
        pageSize: PAGE_SIZE,
        totalCount,
        onPageChange: handlePageSelect,
      }}
      filterSnapshot={{ search }}
      expandedRowRender={(row) => (
        <div className="px-4 pb-4">
          <EntityActivitySection entity="user" entityId={row.id} />
        </div>
      )}
      renderMobileCard={(row) => {
        const user = users.find((candidate) => candidate.id === row.id)
        return (
          <div className="min-w-0">
            <div className="flex items-start gap-3">
              <UserAvatar
                name={user?.name ?? null}
                email={row.email}
                image={user?.image ?? null}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-950 dark:text-slate-50">
                  {row.name}
                </p>
                <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">
                  {row.email}
                </p>
              </div>
              <RoleBadge role={row.role} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 text-sm dark:border-slate-700">
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">
                  Orders
                </dt>
                <dd className="mt-1 font-semibold text-slate-950 dark:text-slate-50">
                  {row.orderCount}
                </dd>
              </div>
              <div className="text-right">
                <dt className="text-xs text-slate-500 dark:text-slate-400">
                  Joined
                </dt>
                <dd className="mt-1 text-slate-700 dark:text-slate-200">
                  {row.createdAt}
                </dd>
              </div>
            </dl>
            {user && canManage ? (
              <div className="mt-3 flex justify-end">
                <RoleAction
                  user={user}
                  isUpdating={updatingUserId === user.id}
                  onRoleChange={handleRoleChange}
                />
              </div>
            ) : null}
            <div className="-mx-4 mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
              <EntityActivitySection entity="user" entityId={row.id} />
            </div>
          </div>
        )
      }}
    />
  )

  const staffCount = users.filter((user) => isStaffRole(user.role)).length
  const customerCount = users.filter((user) => user.role === 'CUSTOMER').length

  return (
    <AdminPageShell
      breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Users' }]}
      eyebrow="Access control"
      title="User Management"
      description="Search accounts and manage user roles and permissions."
      actions={
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          Refresh
        </button>
      }
      metrics={[
        {
          label: 'Total users',
          value: String(totalCount),
          hint: 'Total registered accounts.',
          tone: 'sky',
        },
        {
          label: 'Staff shown',
          value: String(staffCount),
          hint: 'Admin, support and fulfilment accounts on current page.',
          tone: 'amber',
        },
        {
          label: 'Customers shown',
          value: String(customerCount),
          hint: 'Customers on current page.',
          tone: 'emerald',
        },
      ]}
    >
      <AdminPanel title="Search" description="Filter by name or email.">
        <AdminSearchForm
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          search={search}
          onSearch={handleSearch}
          onClear={handleRefresh}
          placeholder="Search by name or email…"
          ariaLabel="Search users"
        />
      </AdminPanel>

      {error ? (
        <AlertBanner message={error} variant="error" className="mb-0" />
      ) : null}

      <AdminPanel title="Users" description="">
        {usersListContent}
      </AdminPanel>
    </AdminPageShell>
  )
}
