import { redirect } from 'next/navigation'
import type { AdminPermission } from '@/lib/constants/roles'
import { checkAdminAuth, type AdminAuthResult } from './admin-auth'

/**
 * Server-component guard for admin pages.
 *
 * Unauthenticated visitors are sent to sign-in; signed-in staff without the
 * permission are sent back to the admin dashboard, which every staff role can
 * reach. Mirrors the permission enforced by the matching API routes so the UI
 * never renders a screen whose actions would be rejected.
 */
export const requireAdminPermission = async (
  permission: AdminPermission,
  callbackUrl = '/admin'
): Promise<Extract<AdminAuthResult, { authorized: true }>> => {
  const authCheck = await checkAdminAuth(permission)

  if (!authCheck.authorized) {
    if (authCheck.status === 401) {
      redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`)
    }
    redirect('/admin')
  }

  return authCheck
}
