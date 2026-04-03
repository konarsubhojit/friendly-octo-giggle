import { auth } from '@/lib/auth'

type AdminAuthSuccess = { authorized: true; userId: string }
type AdminAuthFailure = { authorized: false; error: string; status: 401 | 403 }
export type AdminAuthResult = AdminAuthSuccess | AdminAuthFailure

export const checkAdminAuth = async (): Promise<AdminAuthResult> => {
  const session = await auth()
  if (!session?.user) {
    return { authorized: false, error: 'Not authenticated', status: 401 }
  }
  if (session.user.role !== 'ADMIN') {
    return {
      authorized: false,
      error: 'Not authorized - Admin access required',
      status: 403,
    }
  }
  return { authorized: true, userId: session.user.id ?? '' }
}
