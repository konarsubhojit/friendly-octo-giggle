import { NextRequest } from 'next/server'
import { hasPermission } from '@/lib/constants/roles'
import {
  apiError,
  apiSuccess,
  handleApiError,
  parseJsonBody,
} from '@/lib/api-utils'
import {
  RenameSavedViewRequestSchema,
  type AdminResourceKey,
} from '@/lib/validations/admin'
import { checkAdminSessionAuth } from '@/features/admin/services/admin-auth'
import { ADMIN_RESOURCE_READ_PERMISSIONS } from '@/features/admin/services/admin-resource-permissions'
import {
  deleteSavedView,
  getOwnedSavedViewById,
  renameSavedView,
} from '@/features/admin/services/saved-views'
import { recordAdminAuditLog } from '@/features/admin/services/admin-audit-log'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionAuth = await checkAdminSessionAuth()
    if (!sessionAuth.authorized) {
      return apiError(sessionAuth.error, sessionAuth.status)
    }

    const { id } = await params
    const existing = await getOwnedSavedViewById({
      id,
      userId: sessionAuth.userId,
    })
    if (!existing) {
      return apiError('Saved view not found', 404)
    }

    if (
      !hasPermission(
        sessionAuth.role,
        ADMIN_RESOURCE_READ_PERMISSIONS[existing.resource as AdminResourceKey]
      )
    ) {
      return apiError('Not authorized', 403)
    }

    const body = await parseJsonBody(request, RenameSavedViewRequestSchema)
    const view = await renameSavedView({
      id,
      userId: sessionAuth.userId,
      input: body,
    })

    if (!view) {
      return apiError('Saved view not found', 404)
    }

    await recordAdminAuditLog({
      userId: sessionAuth.userId,
      role: sessionAuth.role,
      entity: 'saved_view',
      entityId: id,
      action: 'rename',
      diff: { name: body.name },
    })

    return apiSuccess({ view })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionAuth = await checkAdminSessionAuth()
    if (!sessionAuth.authorized) {
      return apiError(sessionAuth.error, sessionAuth.status)
    }

    const { id } = await params
    const existing = await getOwnedSavedViewById({
      id,
      userId: sessionAuth.userId,
    })
    if (!existing) {
      return apiError('Saved view not found', 404)
    }

    if (
      !hasPermission(
        sessionAuth.role,
        ADMIN_RESOURCE_READ_PERMISSIONS[existing.resource as AdminResourceKey]
      )
    ) {
      return apiError('Not authorized', 403)
    }

    const deleted = await deleteSavedView({ id, userId: sessionAuth.userId })
    if (!deleted) {
      return apiError('Saved view not found', 404)
    }

    await recordAdminAuditLog({
      userId: sessionAuth.userId,
      role: sessionAuth.role,
      entity: 'saved_view',
      entityId: id,
      action: 'delete',
      diff: { resource: existing.resource, name: existing.name },
    })

    return apiSuccess({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}
