import { connection } from 'next/server'
import { requireAdminPermission } from '@/features/admin/services/admin-page-auth'
import { getRolePermissions } from '@/lib/constants/roles'
import ProductsManagementClient from './ProductsManagementClient'

/**
 * Server-component permission gate for the products console.
 *
 * The list, filters, and bulk-action wiring live in `createProductsDefinition`
 * (`@/features/admin/resources/products`), consumed by
 * `ProductsManagementClient` via `AdminDataView`'s `definition` prop — this
 * page only resolves the signed-in staff member's permissions server-side so
 * client-only actions (edit / delete / bulk delete) render exactly as the
 * role allows.
 */
export default async function ProductsManagementPage() {
  // Admin screens are per-request; state that explicitly under Cache
  // Components rather than letting the prerenderer attempt this page.
  await connection()

  const { role } = await requireAdminPermission('products:read')

  return <ProductsManagementClient permissions={getRolePermissions(role)} />
}
