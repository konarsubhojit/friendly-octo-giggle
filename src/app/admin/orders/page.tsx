import { connection } from 'next/server'
import { requireAdminPermission } from '@/features/admin/services/admin-page-auth'
import { getRolePermissions } from '@/lib/constants/roles'
import OrdersManagementClient from './OrdersManagementClient'

/**
 * Server-component permission gate for the orders console.
 *
 * The list, filters, and bulk-action wiring live in `createOrdersDefinition`
 * (`@/features/admin/resources/orders`), consumed by `OrdersManagementClient`
 * via `AdminDataView`'s `definition` prop — this page only resolves the
 * signed-in staff member's permissions server-side so client-only bulk
 * actions (mark shipped / cancel) render exactly as the role allows.
 */
export default async function OrdersManagementPage() {
  // Admin screens are per-request; state that explicitly under Cache
  // Components rather than letting the prerenderer attempt this page.
  await connection()

  const { role } = await requireAdminPermission('orders:read')

  return <OrdersManagementClient permissions={getRolePermissions(role)} />
}
