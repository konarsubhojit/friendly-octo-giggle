import { NextRequest } from 'next/server'
import { primaryDrizzleDb as drizzleDb } from '@/lib/db'
import { productVariants } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { ReorderVariantsSchema } from '@/features/product/validations'
import {
  apiSuccess,
  apiError,
  handleApiError,
  parseJsonBody,
} from '@/lib/api-utils'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { recordAdminAuditLog } from '@/features/admin/services/admin-audit-log'
import { invalidateProductCaches } from '@/lib/cache'

export const PATCH = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const authCheck = await checkAdminAuth('products:write')
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? 'Unauthorized', authCheck.status)
  }

  try {
    const { id: productId } = await params
    const { items } = await parseJsonBody(request, ReorderVariantsSchema)
    const now = new Date()

    await drizzleDb.transaction(async (tx) => {
      await Promise.all(
        items.map(({ id, sortOrder }) =>
          tx
            .update(productVariants)
            .set({ sortOrder, updatedAt: now })
            .where(eq(productVariants.id, id))
        )
      )
    })

    await invalidateProductCaches(productId)

    await recordAdminAuditLog({
      userId: authCheck.userId,
      role: authCheck.role,
      entity: 'variant',
      entityId: items.map((item) => item.id).join(','),
      action: 'reorder',
      diff: { productId, items },
    })

    return apiSuccess({ reordered: true })
  } catch (error) {
    return handleApiError(error)
  }
}
