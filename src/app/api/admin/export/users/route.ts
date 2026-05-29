import { asc } from 'drizzle-orm'
import { drizzleDb } from '@/lib/db'
import { users } from '@/lib/schema'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { streamCsvResponse } from '@/features/admin/services/admin-csv'
import { apiError, handleApiError } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export const GET = async () => {
  const authCheck = await checkAdminAuth()
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? 'Unauthorized', authCheck.status)
  }

  try {
    const rows = await drizzleDb.query.users.findMany({
      orderBy: [asc(users.createdAt)],
    })

    return streamCsvResponse(
      'users.csv',
      ['id', 'name', 'email', 'role', 'currencyPreference', 'createdAt'],
      rows.map((user) => [
        user.id,
        user.name,
        user.email,
        user.role,
        user.currencyPreference,
        user.createdAt.toISOString(),
      ])
    )
  } catch (error) {
    return handleApiError(error)
  }
}
