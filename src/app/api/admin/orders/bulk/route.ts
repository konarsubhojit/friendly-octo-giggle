import { z } from 'zod'
import { inArray } from 'drizzle-orm'
import { drizzleDb } from '@/lib/db'
import { orders } from '@/lib/schema'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { recordAdminAuditLog } from '@/features/admin/services/admin-audit-log'
import {
  apiError,
  apiSuccess,
  handleApiError,
  parseJsonBody,
} from '@/lib/api-utils'
import { OrderStatus } from '@/lib/types'

export const dynamic = 'force-dynamic'

const BulkOrderSchema = z.object({
  orderIds: z.array(z.string().min(1)).min(1).max(1000),
  status: z.nativeEnum(OrderStatus),
})

export const POST = async (request: Request) => {
  const authCheck = await checkAdminAuth()
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? 'Unauthorized', authCheck.status)
  }

  try {
    const payload = await parseJsonBody(request, BulkOrderSchema)

    const result = await drizzleDb
      .update(orders)
      .set({ status: payload.status, updatedAt: new Date() })
      .where(inArray(orders.id, payload.orderIds))

    await recordAdminAuditLog({
      userId: authCheck.userId,
      entity: 'order',
      entityId: payload.orderIds.join(','),
      action: 'bulk_status_update',
      diff: payload,
    })

    return apiSuccess({
      updatedCount: result.rowCount ?? 0,
      status: payload.status,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
