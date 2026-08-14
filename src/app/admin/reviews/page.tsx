import { connection } from 'next/server'
import { requireAdminPermission } from '@/features/admin/services/admin-page-auth'
import { getRolePermissions } from '@/lib/constants/roles'
import ReviewsManagementClient from './ReviewsManagementClient'

/**
 * Server-component permission gate for the reviews console.
 *
 * The list, filters, moderation actions, and bulk-action wiring live in
 * `createReviewsDefinition` (`@/features/admin/resources/reviews`), consumed
 * by `ReviewsManagementClient` via `AdminDataView`'s `definition` prop — this
 * page only resolves the signed-in staff member's permissions server-side so
 * client-only moderation controls render exactly as the role allows.
 */
export default async function ReviewsManagementPage() {
  // Admin screens are per-request; state that explicitly under Cache
  // Components rather than letting the prerenderer attempt this page.
  await connection()

  const { role } = await requireAdminPermission(
    'reviews:moderate',
    '/admin/reviews'
  )

  return <ReviewsManagementClient permissions={getRolePermissions(role)} />
}
