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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await checkAdminAuth('coupons:manage')
  if (!authCheck.authorized) {
    return apiError(authCheck.error, authCheck.status)
  }

  try {
    const { id } = await params
    const input = await parseJsonBody(request, UpdateCouponSchema)

    if (input.expectedUpdatedAt !== undefined) {
      const existing = await db.coupons.findById(id)
      if (!existing) {
        return apiError('Coupon not found', 404)
      }
      if (existing.updatedAt.toISOString() !== input.expectedUpdatedAt) {
        return apiError(
          'This coupon was changed by someone else. Reload and try again.',
          409,
          { reason: 'stale' }
        )
      }
    }

    if (input.code) {
      const [existing] = await db.coupons.findManyByCodes([input.code])
      if (existing && existing.id !== id) {
        return apiError('A coupon with this code already exists', 409, {
          reason: 'duplicate',
        })
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
  const authCheck = await checkAdminAuth('coupons:manage')
  if (!authCheck.authorized) {
    return apiError(authCheck.error, authCheck.status)
  }

  try {
    const { id } = await params

    // Deleting cascades CouponRedemption rows, which would erase the audit
    // trail behind the redemption report, so redeemed coupons are kept.
    const redemptions = await db.coupons.countRedemptions(id)
    if (redemptions > 0) {
      return apiError(
        'This coupon has been redeemed and cannot be deleted. Deactivate it instead.',
        409
      )
    }

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
