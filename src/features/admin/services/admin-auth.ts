import { auth } from '@/lib/auth'
import {
  hasPermission,
  isStaffRole,
  type AdminPermission,
  type UserRole,
} from '@/lib/constants/roles'

type AdminAuthSuccess = {
  authorized: true
  userId: string
  role: UserRole
}
type AdminAuthFailure = { authorized: false; error: string; status: 401 | 403 }
export type AdminAuthResult = AdminAuthSuccess | AdminAuthFailure

/**
 * Guard an admin route by the permission it needs rather than by role.
 *
 * Passing the required permission is mandatory so that every admin route
 * declares its authorization contract explicitly; roles map to permissions in
 * `lib/constants/roles.ts`.
 */
export const checkAdminAuth = async (
  permission: AdminPermission
): Promise<AdminAuthResult> => {
  const session = await auth()
  if (!session?.user) {
    return { authorized: false, error: 'Not authenticated', status: 401 }
  }
  const role = session.user.role
  if (!hasPermission(role, permission)) {
    return {
      authorized: false,
      error: isStaffRole(role)
        ? `Not authorized - "${permission}" permission required`
        : 'Not authorized - Admin access required',
      status: 403,
    }
  }
  return { authorized: true, userId: session.user.id ?? '', role }
}
