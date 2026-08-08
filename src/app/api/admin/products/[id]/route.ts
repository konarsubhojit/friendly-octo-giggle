import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ProductUpdateSchema } from '@/features/product/validations'
import {
  apiSuccess,
  apiError,
  handleApiError,
  parseJsonBody,
} from '@/lib/api-utils'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { invalidateProductCaches } from '@/lib/cache'
import { indexProduct, removeProduct } from '@/lib/search'

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
    const validated = await parseJsonBody(request, ProductUpdateSchema)

    const product = await db.products.update(id, validated)

    if (!product) {
      return apiError('Product not found', 404)
    }

    await invalidateProductCaches(id)

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

    void removeProduct(id)

    return apiSuccess({ message: 'Product deleted', id })
  } catch (error) {
    return handleApiError(error)
  }
}
