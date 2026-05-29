import { z } from 'zod'
import { and, inArray, isNull, sql } from 'drizzle-orm'
import { revalidateTag } from 'next/cache'
import { drizzleDb } from '@/lib/db'
import { products, productVariants } from '@/lib/schema'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { recordAdminAuditLog } from '@/features/admin/services/admin-audit-log'
import { invalidateProductCaches } from '@/lib/cache'
import {
  apiError,
  apiSuccess,
  handleApiError,
  parseJsonBody,
} from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

const ProductBulkSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('bulk_price_update'),
    productIds: z.array(z.string().min(1)).min(1).max(1000),
    mode: z.enum(['set', 'increment']),
    amount: z.number(),
  }),
  z.object({
    operation: z.literal('bulk_category_assign'),
    productIds: z.array(z.string().min(1)).min(1).max(1000),
    category: z.string().min(1).max(100),
  }),
  z.object({
    operation: z.literal('bulk_stock_adjust'),
    productIds: z.array(z.string().min(1)).min(1).max(1000),
    mode: z.enum(['set', 'increment']),
    amount: z.number().int(),
  }),
  z.object({
    operation: z.literal('bulk_soft_delete'),
    productIds: z.array(z.string().min(1)).min(1).max(1000),
  }),
  z.object({
    operation: z.literal('bulk_restore'),
    productIds: z.array(z.string().min(1)).min(1).max(1000),
  }),
])

export const POST = async (request: Request) => {
  const authCheck = await checkAdminAuth()
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? 'Unauthorized', authCheck.status)
  }

  try {
    const payload = await parseJsonBody(request, ProductBulkSchema)
    const now = new Date()

    let affectedProducts = 0
    let affectedVariants = 0

    if (payload.operation === 'bulk_price_update') {
      const result = await drizzleDb
        .update(productVariants)
        .set({
          price:
            payload.mode === 'set'
              ? payload.amount
              : sql`GREATEST(0, ${productVariants.price} + ${payload.amount})`,
          updatedAt: now,
        })
        .where(inArray(productVariants.productId, payload.productIds))
      affectedVariants = result.rowCount ?? 0
      affectedProducts = payload.productIds.length
    }

    if (payload.operation === 'bulk_stock_adjust') {
      const result = await drizzleDb
        .update(productVariants)
        .set({
          stock:
            payload.mode === 'set'
              ? Math.max(0, payload.amount)
              : sql`GREATEST(0, ${productVariants.stock} + ${payload.amount})`,
          updatedAt: now,
        })
        .where(inArray(productVariants.productId, payload.productIds))
      affectedVariants = result.rowCount ?? 0
      affectedProducts = payload.productIds.length
    }

    if (payload.operation === 'bulk_category_assign') {
      const result = await drizzleDb
        .update(products)
        .set({ category: payload.category, updatedAt: now })
        .where(
          and(
            inArray(products.id, payload.productIds),
            isNull(products.deletedAt)
          )
        )
      affectedProducts = result.rowCount ?? 0
    }

    if (payload.operation === 'bulk_soft_delete') {
      const result = await drizzleDb
        .update(products)
        .set({ deletedAt: now, updatedAt: now })
        .where(
          and(
            inArray(products.id, payload.productIds),
            isNull(products.deletedAt)
          )
        )
      const variantResult = await drizzleDb
        .update(productVariants)
        .set({ deletedAt: now, updatedAt: now })
        .where(
          and(
            inArray(productVariants.productId, payload.productIds),
            isNull(productVariants.deletedAt)
          )
        )
      affectedProducts = result.rowCount ?? 0
      affectedVariants = variantResult.rowCount ?? 0
    }

    if (payload.operation === 'bulk_restore') {
      const result = await drizzleDb
        .update(products)
        .set({ deletedAt: null, updatedAt: now })
        .where(inArray(products.id, payload.productIds))
      const variantResult = await drizzleDb
        .update(productVariants)
        .set({ deletedAt: null, updatedAt: now })
        .where(inArray(productVariants.productId, payload.productIds))
      affectedProducts = result.rowCount ?? 0
      affectedVariants = variantResult.rowCount ?? 0
    }

    await recordAdminAuditLog({
      userId: authCheck.userId,
      entity: 'product',
      entityId: payload.productIds.join(','),
      action: payload.operation,
      diff: payload,
    })

    await invalidateProductCaches()
    revalidateTag('products', 'max')

    return apiSuccess({
      operation: payload.operation,
      affectedProducts,
      affectedVariants,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
