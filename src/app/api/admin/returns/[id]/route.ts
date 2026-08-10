import { NextRequest } from 'next/server'
import {
  apiSuccess,
  apiError,
  handleApiError,
  parseJsonBody,
} from '@/lib/api-utils'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import {
  invalidateAdminOrderCaches,
  invalidateProductCaches,
} from '@/lib/cache'
import { DecideReturnSchema } from '@/features/orders/validations'
import type { AdminPermission } from '@/lib/constants/roles'
import type { ReturnAction } from '@/lib/constants/returns'
import { decideReturn } from '@/features/orders/services/return-admin-service'
import { ReturnTransitionError } from '@/features/orders/services/return-state-machine'
import { ReturnRequestError } from '@/features/orders/services/return-service'
import { isRefundRequestError } from '@/features/orders/services/refund-service'

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' } as const

/**
 * Permission per action.
 *
 * Triage and receipt move inventory at most, so they sit with the returns
 * permission. Anything that moves money — issuing a refund, or marking a Cash
 * on Delivery obligation paid — requires `orders:refund`, matching the
 * existing gate on admin refunds.
 */
const ACTION_PERMISSIONS: Record<ReturnAction, AdminPermission> = {
  approve: 'orders:returns',
  reject: 'orders:returns',
  receive: 'orders:returns',
  refund: 'orders:refund',
  settle: 'orders:refund',
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Authenticate before reading the body. Parsing first would let an
    // anonymous caller trigger a Zod failure and read the full admin action
    // surface out of the 400 response, and would answer unauthenticated
    // requests with 400 rather than 401.
    const baseAuth = await checkAdminAuth('orders:returns')
    if (!baseAuth.authorized) {
      return apiError(baseAuth.error, baseAuth.status)
    }

    const body = await parseJsonBody(request, DecideReturnSchema)

    // Authorize against the specific action too: a support agent may triage a
    // claim without being able to move money.
    const authCheck = await checkAdminAuth(ACTION_PERMISSIONS[body.action])
    if (!authCheck.authorized) {
      return apiError(authCheck.error, authCheck.status)
    }

    const result = await decideReturn(
      id,
      body.action,
      { userId: authCheck.userId, role: authCheck.role },
      'decisionReason' in body ? body.decisionReason : undefined
    )

    // Invalidate the admin return/order caches for this return ID.
    await invalidateAdminOrderCaches(id)

    // Receiving a return puts units back on the shelf. Without this the
    // storefront keeps rendering the variant as out of stock for the life of
    // the product cache entry, so inventory that physically exists cannot be
    // bought.
    const restockedProductIds = result.restockedProductIds ?? []
    if (restockedProductIds.length > 0) {
      await invalidateProductCaches(restockedProductIds)
    }

    return apiSuccess(result, 200, PRIVATE_HEADERS)
  } catch (error) {
    if (error instanceof ReturnTransitionError) {
      // 409 with the current state, so the client can re-render rather than
      // guess why the action was refused.
      return apiError(error.message, 409, {
        currentStatus: error.currentStatus,
        action: error.action,
      })
    }
    if (error instanceof ReturnRequestError) {
      return apiError(error.message, error.status)
    }
    if (isRefundRequestError(error)) {
      // The gateway rejected the refund. The return stays at RECEIVED with
      // `refundId` unset, so `refund` can be retried once the underlying
      // problem is fixed.
      return apiError(error.message, error.status)
    }
    return handleApiError(error)
  }
}
