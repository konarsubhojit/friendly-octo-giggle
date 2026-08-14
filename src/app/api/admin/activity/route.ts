import { NextRequest } from 'next/server'
import { getRolePermissions } from '@/lib/constants/roles'
import { apiError, apiSuccess, handleApiError } from '@/lib/api-utils'
import { AdminActivityQuerySchema } from '@/lib/validations/admin'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import {
  getActivityRequiredPermission,
  queryAdminActivity,
} from '@/features/admin/services/admin-activity-query'

export async function GET(request: NextRequest) {
  try {
    const query = AdminActivityQuerySchema.parse({
      entity: request.nextUrl.searchParams.get('entity') ?? undefined,
      entityId: request.nextUrl.searchParams.get('entityId') ?? undefined,
      action: request.nextUrl.searchParams.get('action') ?? undefined,
      actorId: request.nextUrl.searchParams.get('actorId') ?? undefined,
      dateFrom: request.nextUrl.searchParams.get('dateFrom') ?? undefined,
      dateTo: request.nextUrl.searchParams.get('dateTo') ?? undefined,
      cursor: request.nextUrl.searchParams.get('cursor') ?? undefined,
      limit: request.nextUrl.searchParams.get('limit') ?? undefined,
    })

    const permission = getActivityRequiredPermission(query.entity)
    if (!permission) {
      return apiError('Unsupported activity entity', 400)
    }

    const authCheck = await checkAdminAuth(permission)
    if (!authCheck.authorized) {
      return apiError(authCheck.error, authCheck.status)
    }

    const result = await queryAdminActivity({
      query,
      permissions: getRolePermissions(authCheck.role),
    })

    return apiSuccess({
      ...result,
      retentionWindowMonths: 24,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
