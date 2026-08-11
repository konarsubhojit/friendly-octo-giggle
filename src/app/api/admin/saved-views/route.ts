import { NextRequest } from 'next/server'
import {
  apiError,
  apiSuccess,
  handleApiError,
  parseJsonBody,
} from '@/lib/api-utils'
import {
  CreateSavedViewRequestSchema,
  SavedViewsListQuerySchema,
} from '@/lib/validations/admin'
import {
  createSavedView,
  listSavedViews,
} from '@/features/admin/services/saved-views'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { getRolePermissions } from '@/lib/constants/roles'
import { ADMIN_RESOURCE_READ_PERMISSIONS } from '@/features/admin/services/admin-resource-permissions'

export async function GET(request: NextRequest) {
  try {
    const resource = SavedViewsListQuerySchema.parse({
      resource: request.nextUrl.searchParams.get('resource'),
    }).resource

    const authCheck = await checkAdminAuth(
      ADMIN_RESOURCE_READ_PERMISSIONS[resource]
    )
    if (!authCheck.authorized) {
      return apiError(authCheck.error, authCheck.status)
    }

    const views = await listSavedViews({
      userId: authCheck.userId,
      permissions: getRolePermissions(authCheck.role),
      resource,
    })

    return apiSuccess({ views })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseJsonBody(request, CreateSavedViewRequestSchema)
    const authCheck = await checkAdminAuth(
      ADMIN_RESOURCE_READ_PERMISSIONS[body.resource]
    )
    if (!authCheck.authorized) {
      return apiError(authCheck.error, authCheck.status)
    }

    const view = await createSavedView({
      userId: authCheck.userId,
      resource: body.resource,
      input: body,
    })

    return apiSuccess({ view }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
