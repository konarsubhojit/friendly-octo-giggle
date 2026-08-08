import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  apiError,
  apiSuccess,
  handleApiError,
  isJsonBodyParseError,
  parseJsonBody,
} from '@/lib/api-utils'
import { ApplyCouponSchema } from '@/features/cart/validations'
import {
  isCouponError,
  resolveCartDiscount,
  type DiscountCartItem,
} from '@/features/cart/services/coupon-service'

/**
 * Preview the discount a coupon would produce for the signed-in user's cart.
 *
 * The response is advisory only — the authoritative discount is recomputed
 * again when the order is created.
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return apiError('Authentication required', 401)
  }

  try {
    const { couponCode } = await parseJsonBody(request, ApplyCouponSchema)
    const cart = await db.carts.findWithRelationsByUserId(userId)

    const items: DiscountCartItem[] = (cart?.items ?? []).map((item) => ({
      productId: item.productId,
      category: item.product?.category ?? '',
      quantity: item.quantity,
      unitPrice: item.variant?.price ?? 0,
    }))

    if (items.length === 0) {
      return apiError('Your cart is empty', 400)
    }

    const breakdown = await resolveCartDiscount({
      codes: [couponCode],
      items,
      userId,
    })

    return apiSuccess({
      couponCode,
      subtotal: breakdown.subtotal,
      discountAmount: breakdown.discountAmount,
      total: breakdown.total,
      appliedCoupons: breakdown.appliedCoupons,
    })
  } catch (error) {
    if (isCouponError(error)) {
      return apiError(error.message, error.status)
    }
    if (isJsonBodyParseError(error)) {
      return apiError(error.message, error.status)
    }
    return handleApiError(error)
  }
}
