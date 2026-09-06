import { connection } from 'next/server'
import { requireAdminPermission } from '@/features/admin/services/admin-page-auth'
import { getRolePermissions } from '@/lib/constants/roles'
import UsersManagementClient from './UsersManagementClient'

/**
 * Server-component permission gate for the users console.
 *
 * The list, filters, and bulk-action wiring live in `createUsersDefinition`
 * (`@/features/admin/resources/users`), consumed by `UsersManagementClient`
 * via `AdminDataView`'s `definition` prop — this page only resolves the
 * signed-in staff member's permissions server-side so the client-only
 * role-change control renders exactly as the role allows.
 */
export default async function UsersManagementPage() {
  // Admin screens are per-request; state that explicitly under Cache
  // Components rather than letting the prerenderer attempt this page.
  await connection()

  const { role } = await requireAdminPermission('users:read')

  return <UsersManagementClient permissions={getRolePermissions(role)} />
}
