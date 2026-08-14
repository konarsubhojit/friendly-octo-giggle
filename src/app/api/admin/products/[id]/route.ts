import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ProductUpdateSchema } from '@/features/product/validations'
import { ISO_DATETIME_REGEX } from '@/lib/validations/primitives'
import {
  apiSuccess,
  apiError,
  handleApiError,
  parseJsonBody,
} from '@/lib/api-utils'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { recordAdminAuditLog } from '@/features/admin/services/admin-audit-log'
import { invalidateProductCaches } from '@/lib/cache'
import { indexProduct, removeProduct } from '@/lib/search'

// FR-B07/FR-B08 (T069): when supplied, must match the product's current
// `updatedAt` or the request is rejected as stale.
const ProductUpdateWithConcurrencySchema = ProductUpdateSchema.extend({
  expectedUpdatedAt: z
    .string()
    .regex(ISO_DATETIME_REGEX, 'Invalid datetime format')
    .optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await checkAdminAuth('products:write')
  if (!authCheck.authorized) {
    return apiError(authCheck.error, authCheck.status)
  }

  try {
    const { id } = await params
    const { expectedUpdatedAt, ...validated } = await parseJsonBody(
      request,
      ProductUpdateWithConcurrencySchema
    )

    if (expectedUpdatedAt !== undefined) {
      const existing = await db.products.findById(id, false)
      if (!existing) {
        return apiError('Product not found', 404)
      }
      if (existing.updatedAt !== expectedUpdatedAt) {
        return apiError(
          'This product was changed by someone else. Reload and try again.',
          409,
          { reason: 'stale' }
        )
      }
    }

    const product = await db.products.update(id, validated)

    if (!product) {
      return apiError('Product not found', 404)
    }

    await invalidateProductCaches(id)

    await recordAdminAuditLog({
      userId: authCheck.userId,
      role: authCheck.role,
      entity: 'product',
      entityId: id,
      action: 'update',
      diff: validated,
    })

    void indexProduct(product)

    return apiSuccess({ product })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await checkAdminAuth('products:write')
  if (!authCheck.authorized) {
    return apiError(authCheck.error, authCheck.status)
  }

  try {
    const { id } = await params

    const deleted = await db.products.delete(id)

    if (!deleted) {
      return apiError('Product not found', 404)
    }

    await invalidateProductCaches(id)

    await recordAdminAuditLog({
      userId: authCheck.userId,
      role: authCheck.role,
      entity: 'product',
      entityId: id,
      action: 'delete',
    })

    void removeProduct(id)

    return apiSuccess({ message: 'Product deleted', id })
  } catch (error) {
    return handleApiError(error)
  }
}
