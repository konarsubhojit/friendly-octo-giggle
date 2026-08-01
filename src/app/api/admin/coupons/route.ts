import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { recordAdminAuditLog } from '@/features/admin/services/admin-audit-log'
import { CreateCouponSchema } from '@/features/admin/validations'
import {
  apiError,
  apiSuccess,
  handleApiError,
  isJsonBodyParseError,
  parseJsonBody,
} from '@/lib/api-utils'
import { serializeCoupon } from '@/features/admin/services/coupon-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const authCheck = await checkAdminAuth('coupons:manage')
  if (!authCheck.authorized) {
    return apiError(authCheck.error, authCheck.status)
  }

  try {
    const rows = await db.coupons.findAll()
    return apiSuccess({ coupons: rows.map(serializeCoupon) })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  const authCheck = await checkAdminAuth('coupons:manage')
  if (!authCheck.authorized) {
    return apiError(authCheck.error, authCheck.status)
  }

  try {
    const input = await parseJsonBody(request, CreateCouponSchema)

    const [existing] = await db.coupons.findManyByCodes([input.code])
    if (existing) {
      return apiError('A coupon with this code already exists', 409)
    }

    const created = await db.coupons.create({
      code: input.code,
      description: input.description ?? null,
      discountType: input.discountType,
      discountValue: input.discountValue,
      maxDiscountAmount: input.maxDiscountAmount ?? null,
      minCartValue: input.minCartValue,
      scopedCategories: input.scopedCategories,
      scopedProductIds: input.scopedProductIds,
      usageLimit: input.usageLimit ?? null,
      perUserLimit: input.perUserLimit ?? null,
      stackable: input.stackable,
      isActive: input.isActive,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
    })

    await recordAdminAuditLog({
      userId: authCheck.userId,
      entity: 'Coupon',
      entityId: created.id,
      action: 'create',
      diff: { code: created.code, discountType: created.discountType },
    })

    return apiSuccess({ coupon: serializeCoupon(created) }, 201)
  } catch (error) {
    if (isJsonBodyParseError(error)) {
      return apiError(error.message, error.status)
    }
    return handleApiError(error)
  }
}
