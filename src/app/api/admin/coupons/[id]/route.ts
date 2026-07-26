import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { recordAdminAuditLog } from '@/features/admin/services/admin-audit-log'
import { UpdateCouponSchema } from '@/features/admin/validations'
import {
  apiError,
  apiSuccess,
  handleApiError,
  isJsonBodyParseError,
  parseJsonBody,
} from '@/lib/api-utils'
import {
  buildCouponUpdateValues,
  serializeCoupon,
} from '@/features/admin/services/coupon-admin'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await checkAdminAuth()
  if (!authCheck.authorized) {
    return apiError(authCheck.error, authCheck.status)
  }

  try {
    const { id } = await params
    const input = await parseJsonBody(request, UpdateCouponSchema)

    if (input.code) {
      const [existing] = await db.coupons.findManyByCodes([input.code])
      if (existing && existing.id !== id) {
        return apiError('A coupon with this code already exists', 409)
      }
    }

    const updated = await db.coupons.update(id, buildCouponUpdateValues(input))
    if (!updated) {
      return apiError('Coupon not found', 404)
    }

    await recordAdminAuditLog({
      userId: authCheck.userId,
      entity: 'Coupon',
      entityId: id,
      action: 'update',
      diff: { ...input },
    })

    return apiSuccess({ coupon: serializeCoupon(updated) })
  } catch (error) {
    if (isJsonBodyParseError(error)) {
      return apiError(error.message, error.status)
    }
    return handleApiError(error)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await checkAdminAuth()
  if (!authCheck.authorized) {
    return apiError(authCheck.error, authCheck.status)
  }

  try {
    const { id } = await params
    const deleted = await db.coupons.delete(id)
    if (!deleted) {
      return apiError('Coupon not found', 404)
    }

    await recordAdminAuditLog({
      userId: authCheck.userId,
      entity: 'Coupon',
      entityId: id,
      action: 'delete',
    })

    return apiSuccess({ id: deleted.id })
  } catch (error) {
    return handleApiError(error)
  }
}
