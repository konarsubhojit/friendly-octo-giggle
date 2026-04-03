'use client'

import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface AdminUser {
  readonly id: string
  readonly name: string | null
  readonly email: string
  readonly role: string
}

interface RoleActionProps {
  readonly user: AdminUser
  readonly isUpdating: boolean
  readonly onRoleChange: (userId: string, newRole: 'ADMIN' | 'CUSTOMER') => void
}

export function RoleAction({
  user,
  isUpdating,
  onRoleChange,
}: RoleActionProps) {
  const [pendingRole, setPendingRole] = useState<'ADMIN' | 'CUSTOMER' | null>(
    null
  )

  if (isUpdating) {
    return <LoadingSpinner size="h-4 w-4" />
  }

  const handleSelectChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value as 'ADMIN' | 'CUSTOMER'
    if (newRole !== user.role) {
      setPendingRole(newRole)
    }
  }

  const handleConfirm = () => {
    if (pendingRole) {
      onRoleChange(user.id, pendingRole)
      setPendingRole(null)
    }
  }

  return (
    <>
      <ConfirmDialog
        isOpen={pendingRole !== null}
        title="Change User Role"
        message={`Change ${user.name || user.email}'s role from "${user.role}" to "${pendingRole ?? ''}"?`}
        confirmLabel="Yes, change role"
        variant="warning"
        loading={isUpdating}
        onConfirm={handleConfirm}
        onCancel={() => setPendingRole(null)}
      />
      <select
        value={user.role}
        onChange={handleSelectChange}
        className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label={`Change role for ${user.name || user.email}`}
      >
        <option value="CUSTOMER">Customer</option>
        <option value="ADMIN">Admin</option>
      </select>
    </>
  )
}
